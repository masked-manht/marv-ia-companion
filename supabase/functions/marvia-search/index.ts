import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEARCH_SYSTEM_PROMPT = `Tu es Marv-IA Search, un moteur de recherche intelligent alimenté par les derniers modèles d'IA (mars 2026).

CAPACITÉS :
- Tu as accès à des connaissances actualisées jusqu'à début mars 2026.
- Tu peux répondre sur l'actualité récente, les résultats sportifs, les événements mondiaux, la politique, la technologie, les tendances.
- Tu peux analyser des tendances et faire des projections basées sur les données disponibles.

RÈGLES :
- Réponds avec assurance sur les faits que tu connais. Ne dis PAS "mes données s'arrêtent à..." sauf si on te demande un événement très récent (dernières 24h).
- Si l'utilisateur fournit sa position GPS, contextualise (ville, météo locale probable, événements locaux).
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

    let userContent = query;
    if (location) {
      userContent += `\n\n[Position GPS : latitude ${location.latitude}, longitude ${location.longitude}]`;
    }

    const chatMessages = [
      { role: "system", content: SEARCH_SYSTEM_PROMPT },
      ...(messages || []),
      { role: "user", content: userContent },
    ];

    // Use the most capable model for search queries
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
