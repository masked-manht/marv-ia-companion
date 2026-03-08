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

    // Strategy 1: /v1/images/generations endpoint
    console.log("Trying /v1/images/generations...");
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

    console.log("images/generations status:", imgResponse.status);
    const imgText = await imgResponse.text();
    console.log("images/generations response:", imgText.slice(0, 500));

    if (imgResponse.ok) {
      try {
        const imgData = JSON.parse(imgText);
        const url = imgData.data?.[0]?.url;
        const b64 = imgData.data?.[0]?.b64_json;
        const imageUrl = b64 ? `data:image/png;base64,${b64}` : url;
        if (imageUrl) {
          return new Response(JSON.stringify({ imageUrl, text: "Image générée ✨" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Parse error for images/generations:", e);
      }
    }

    // Strategy 2: chat completions with gemini-2.5-flash-image
    console.log("Trying chat completions with gemini-2.5-flash-image...");
    const chatResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: `Generate an image of: ${prompt}` }],
        modalities: ["image", "text"],
      }),
    });

    console.log("chat completions flash-image status:", chatResponse.status);
    const chatText = await chatResponse.text();
    console.log("chat completions flash-image response:", chatText.slice(0, 1000));

    if (chatResponse.ok) {
      try {
        const chatData = JSON.parse(chatText);
        const imageUrl = chatData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        const text = chatData.choices?.[0]?.message?.content || "Image générée ✨";
        if (imageUrl) {
          return new Response(JSON.stringify({ imageUrl, text }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log("No image in chat response. Full keys:", JSON.stringify(Object.keys(chatData.choices?.[0]?.message || {})));
      } catch (e) {
        console.error("Parse error for chat completions:", e);
      }
    }

    // Strategy 3: gemini-3-pro-image-preview
    console.log("Trying gemini-3-pro-image-preview...");
    const proResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: `Generate an image of: ${prompt}` }],
        modalities: ["image", "text"],
      }),
    });

    console.log("gemini-3-pro status:", proResponse.status);
    const proText = await proResponse.text();
    console.log("gemini-3-pro response:", proText.slice(0, 1000));

    if (proResponse.ok) {
      try {
        const proData = JSON.parse(proText);
        const imageUrl = proData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        const text = proData.choices?.[0]?.message?.content || "Image générée ✨";
        if (imageUrl) {
          return new Response(JSON.stringify({ imageUrl, text }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log("No image in pro response. Message keys:", JSON.stringify(Object.keys(proData.choices?.[0]?.message || {})));
        console.log("Full pro message:", JSON.stringify(proData.choices?.[0]?.message).slice(0, 500));
      } catch (e) {
        console.error("Parse error for pro:", e);
      }
    }

    if (chatResponse.status === 429 || proResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (chatResponse.status === 402 || proResponse.status === 402) {
      return new Response(JSON.stringify({ error: "Crédits épuisés." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Aucune image n'a pu être générée. Essayez un prompt différent." }), {
      status: 500,
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
