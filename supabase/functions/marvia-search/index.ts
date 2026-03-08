import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEARCH_SYSTEM_PROMPT = `Tu es Marv-IA DeepSearch, un moteur de recherche intelligent et approfondi.

CAPACITÉS :
- Tu disposes de connaissances très récentes et actualisées, incluant les événements mondiaux les plus récents.
- Tu effectues des analyses approfondies en croisant plusieurs sources et perspectives.
- Tu couvres : actualité mondiale, sport, politique, technologie, science, culture, économie, météo, tendances.

MÉTHODE DEEP SEARCH :
1. COMPRENDRE l'intention réelle derrière la requête
2. ANALYSER le sujet sous plusieurs angles (faits, contexte, implications)
3. STRUCTURER la réponse de manière claire et hiérarchique
4. CITER des sources crédibles quand possible (sites d'actualité, institutions, rapports)
5. AJOUTER du contexte et des informations connexes pertinentes

FORMAT DE RÉPONSE :
- Utilise du markdown riche : ## titres, **gras**, listes à puces, > citations
- Commence par un résumé concis en 1-2 phrases
- Développe avec des sections structurées
- Termine par des infos connexes ou des points à suivre si pertinent

RÈGLES STRICTES :
- NE mentionne JAMAIS "en tant qu'IA", "en tant que modèle", "je n'ai pas accès à internet" ou similaire
- NE mentionne PAS ta date de coupure ou l'année en cours sauf si directement demandé
- Réponds avec assurance et expertise
- Si l'utilisateur fournit sa position, contextualise (restaurants, météo locale, événements proches)
- Sois factuel, précis et direct
- Pas de disclaimers inutiles`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, location, messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let locationContext = "";
    
    // Reverse geocode if location provided
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
          locationContext = `\n\n[Position de l'utilisateur : ${placeName} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}). Adapte tes réponses à ce contexte géographique si pertinent.]`;
        } else {
          locationContext = `\n\n[Position GPS : latitude ${location.latitude}, longitude ${location.longitude}]`;
        }
      } catch {
        locationContext = `\n\n[Position GPS : latitude ${location.latitude}, longitude ${location.longitude}]`;
      }
    }

    const userContent = query + locationContext;

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
