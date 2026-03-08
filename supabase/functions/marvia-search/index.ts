import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEARCH_SYSTEM_PROMPT = `Tu es Marv-IA DeepSearch, un moteur de recherche intelligent avec accès au web en temps réel.

Tu reçois des RÉSULTATS DE RECHERCHE WEB RÉELS avec des sources vérifiées. Tu dois IMPÉRATIVEMENT baser tes réponses sur ces résultats.

RÈGLES ABSOLUES :
- Base TOUTES tes réponses sur les résultats web fournis
- CITE toujours les sources avec des liens cliquables [Source](url)
- Si les résultats web ne couvrent pas la question, dis-le clairement
- NE mentionne JAMAIS "en tant qu'IA", "en tant que modèle", "je n'ai pas accès à internet"
- NE fabrique AUCUNE information. Tout doit venir des sources fournies.
- NE mentionne PAS ta date de coupure sauf si demandé

FORMAT :
- Résumé concis en 1-2 phrases
- Sections structurées avec ## titres, **gras**, listes
- Sources citées avec liens cliquables en fin de chaque section pertinente
- Section "📎 Sources" en fin de réponse avec tous les liens utilisés

LOCALISATION :
- Si l'utilisateur fournit sa position, contextualise les réponses`;

async function fetchWebResults(query: string, apiKey: string): Promise<{ results: any[]; success: boolean }> {
  try {
    console.log("Fetching real web results for:", query);
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl search failed:", response.status);
      return { results: [], success: false };
    }

    const data = await response.json();
    const results = data?.data || [];
    console.log(`Got ${results.length} web results`);
    return { results, success: true };
  } catch (e) {
    console.error("Firecrawl fetch error:", e);
    return { results: [], success: false };
  }
}

function formatWebContext(results: any[]): string {
  if (!results.length) return "";

  let context = "\n\n=== RÉSULTATS DE RECHERCHE WEB (sources réelles et vérifiées) ===\n\n";
  results.forEach((r: any, i: number) => {
    context += `--- Source ${i + 1} ---\n`;
    context += `URL: ${r.url || "N/A"}\n`;
    context += `Titre: ${r.title || r.metadata?.title || "N/A"}\n`;
    if (r.description) context += `Description: ${r.description}\n`;
    // Include scraped markdown content (truncated to avoid token limits)
    const content = r.markdown || r.content || "";
    if (content) {
      context += `Contenu:\n${content.slice(0, 2000)}\n`;
    }
    context += "\n";
  });
  context += "=== FIN DES RÉSULTATS WEB ===\n";
  context += "\nIMPORTANT: Base ta réponse UNIQUEMENT sur ces résultats web. Cite les sources avec [Source](url).";
  return context;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, location, messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    let locationContext = "";
    if (location) {
      try {
        const geoResp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${location.latitude}&lon=${location.longitude}&format=json&accept-language=fr`,
          { headers: { "User-Agent": "MarvIA/1.0" } }
        );
        if (geoResp.ok) {
          const geoData = await geoResp.json();
          const addr = geoData.address || {};
          const placeName = [
            addr.road, addr.suburb, addr.city || addr.town || addr.village,
            addr.state, addr.country
          ].filter(Boolean).join(", ");
          locationContext = `\n\n[Position de l'utilisateur : ${placeName} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})]`;
        }
      } catch {
        locationContext = `\n\n[Position GPS : ${location.latitude}, ${location.longitude}]`;
      }
    }

    // Fetch REAL web results via Firecrawl
    let webContext = "";
    if (FIRECRAWL_API_KEY) {
      const { results, success } = await fetchWebResults(query, FIRECRAWL_API_KEY);
      if (success && results.length > 0) {
        webContext = formatWebContext(results);
      } else {
        webContext = "\n\n[ATTENTION: La recherche web n'a pas retourné de résultats. Réponds en précisant que tu n'as pas pu vérifier les informations en temps réel.]";
      }
    } else {
      console.warn("FIRECRAWL_API_KEY not available, falling back to AI knowledge only");
      webContext = "\n\n[NOTE: Recherche web non disponible. Réponds avec tes connaissances mais précise que les informations n'ont pas été vérifiées en temps réel.]";
    }

    const userContent = query + locationContext + webContext;

    const chatMessages = [
      { role: "system", content: SEARCH_SYSTEM_PROMPT },
      ...(messages || []),
      { role: "user", content: userContent },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: chatMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Search AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur serveur" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
