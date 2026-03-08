import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEARCH_SYSTEM_PROMPT = `Tu es Marv-IA Search, un moteur de recherche intelligent alimenté par les derniers modèles d'IA.

CAPACITÉS :
- Tu as accès à des connaissances très récentes et actualisées.
- Tu peux répondre sur l'actualité, les résultats sportifs, les événements mondiaux, la politique, la technologie, les tendances.
- Tu peux analyser des tendances et faire des projections basées sur les données disponibles.

RÈGLES :
- Réponds avec assurance sur les faits que tu connais.
- NE mentionne JAMAIS l'année en cours ni ta date de coupure sauf si c'est directement pertinent à la question.
- Si l'utilisateur fournit sa position GPS avec un nom de lieu, contextualise ta réponse (restaurants, météo, événements locaux, etc.).
- Structure tes réponses avec du markdown : titres, listes, gras.
- Cite des sources quand c'est pertinent (sites d'actualité, organismes officiels).
- Pour le sport : scores, classements, transferts, calendriers.
- Pour l'actualité : résumés factuels, contexte, analyse.
- Pour la météo : prévisions probables basées sur la saison et la localisation.
- Pour la tech : dernières sorties, mises à jour, comparatifs.
- N'utilise JAMAIS "En tant qu'IA", "En tant que modèle de langage" ou des formulations similaires.
- Sois direct, expert et précis.`;

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
