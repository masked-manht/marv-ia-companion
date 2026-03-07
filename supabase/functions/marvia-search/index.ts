import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEARCH_SYSTEM_PROMPT = `Tu es Marv-IA Search, un assistant spécialisé dans la recherche d'informations actuelles.

RÈGLES :
- Fournis des réponses structurées et factuelles sur l'actualité, le sport, la météo, les événements.
- Si l'utilisateur fournit sa position GPS (latitude/longitude), utilise-la pour contextualiser ta réponse (ville proche, météo locale, événements locaux).
- Indique toujours la date de tes connaissances si tu n'es pas sûr d'avoir l'info la plus récente.
- Utilise le markdown pour structurer tes réponses.
- Ne dis jamais "En tant qu'IA" ni ne mentionne tes limitations de manière répétitive.
- Sois direct et utile.
- Mentionne que tes informations sont basées sur tes données d'entraînement quand pertinent.`;

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
      userContent += `\n\n[Position GPS de l'utilisateur : latitude ${location.latitude}, longitude ${location.longitude}]`;
    }

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
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte." }), {
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
