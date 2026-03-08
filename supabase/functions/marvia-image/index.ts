import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Try the images/generations endpoint first
    let imageUrl: string | undefined;
    let text = "";

    try {
      const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          prompt,
          n: 1,
          size: "1024x1024",
        }),
      });

      if (imgResponse.ok) {
        const imgData = await imgResponse.json();
        imageUrl = imgData.data?.[0]?.url || imgData.data?.[0]?.b64_json
          ? `data:image/png;base64,${imgData.data[0].b64_json}`
          : imgData.data?.[0]?.url;
        text = "Image générée avec succès ✨";
      } else {
        // Fallback: use chat completions with image modality
        console.log("images/generations failed, falling back to chat completions:", imgResponse.status);
        const chatResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!chatResponse.ok) {
          if (chatResponse.status === 429) {
            return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez." }), {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (chatResponse.status === 402) {
            return new Response(JSON.stringify({ error: "Crédits épuisés." }), {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const t = await chatResponse.text();
          console.error("Chat image gen error:", chatResponse.status, t);
          throw new Error("Erreur de génération d'image");
        }

        const chatData = await chatResponse.json();
        imageUrl = chatData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        text = chatData.choices?.[0]?.message?.content || "Image générée ✨";
      }
    } catch (innerErr) {
      console.error("Primary generation failed:", innerErr);
      
      // Final fallback: try google/gemini-3-pro-image-preview model
      const fallbackResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content: `Generate an image: ${prompt}` }],
          modalities: ["image", "text"],
        }),
      });

      if (!fallbackResponse.ok) {
        const t = await fallbackResponse.text();
        console.error("Fallback image gen error:", fallbackResponse.status, t);
        return new Response(JSON.stringify({ error: "Erreur de génération d'image. Réessayez." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fallbackData = await fallbackResponse.json();
      imageUrl = fallbackData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      text = fallbackData.choices?.[0]?.message?.content || "Image générée ✨";
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Aucune image n'a pu être générée. Essayez un prompt différent." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ imageUrl, text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image gen error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
