import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractImageUrl(data: any): string | undefined {
  // Try chat completions format: choices[0].message.images[0].image_url.url
  const chatImage = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (chatImage) return chatImage;
  // Try images/generations format with choices: choices[0].images[0].image_url.url
  const genImage = data?.choices?.[0]?.images?.[0]?.image_url?.url;
  if (genImage) return genImage;
  // Try standard OpenAI format: data[0].url or data[0].b64_json
  const stdUrl = data?.data?.[0]?.url;
  if (stdUrl) return stdUrl;
  const b64 = data?.data?.[0]?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;
  return undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Enhance the prompt for better image quality
    const enhancedPrompt = `Create a high-quality, detailed image: ${prompt}. Professional quality, vivid colors, sharp details.`;

    // Use chat completions with image modality (most reliable)
    const chatResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: enhancedPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!chatResponse.ok) {
      const status = chatResponse.status;
      const errText = await chatResponse.text();
      console.error("Image gen failed:", status, errText);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans quelques secondes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Erreur de génération (${status}). Réessayez.` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatData = await chatResponse.json();
    console.log("Image gen response keys:", JSON.stringify(Object.keys(chatData)));
    
    const imageUrl = extractImageUrl(chatData);
    if (imageUrl) {
      const text = chatData?.choices?.[0]?.message?.content || "Image générée ✨";
      return new Response(JSON.stringify({ imageUrl, text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.error("No image in response:", JSON.stringify(chatData).slice(0, 500));

    return new Response(JSON.stringify({ error: "Aucune image générée. Essayez un prompt différent." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image gen error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
