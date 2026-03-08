import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, user_id, messages, memory_id } = await req.json();

    // --- GET: Return all memories for a user ---
    if (action === "get") {
      const { data, error } = await supabase
        .from("user_memories")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ memories: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DELETE: Remove a specific memory ---
    if (action === "delete") {
      const { error } = await supabase
        .from("user_memories")
        .delete()
        .eq("id", memory_id)
        .eq("user_id", user_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DELETE ALL: Clear all memories ---
    if (action === "clear") {
      const { error } = await supabase
        .from("user_memories")
        .delete()
        .eq("user_id", user_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- EXTRACT: Extract memories from conversation messages ---
    if (action === "extract") {
      if (!messages || messages.length < 2) {
        return new Response(JSON.stringify({ extracted: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get existing memories to avoid duplicates
      const { data: existing } = await supabase
        .from("user_memories")
        .select("content")
        .eq("user_id", user_id);

      const existingSet = new Set((existing || []).map((m: any) => m.content.toLowerCase()));

      // Build conversation text (last few exchanges)
      const recentMessages = messages.slice(-6);
      const convText = recentMessages
        .filter((m: any) => typeof m.content === "string")
        .map((m: any) => `${m.role}: ${m.content.slice(0, 500)}`)
        .join("\n");

      // Use AI to extract key facts
      const extractPrompt = `Analyse cette conversation et extrais les informations importantes sur l'UTILISATEUR (pas sur l'assistant).

Extrais :
- Prénom / nom de l'utilisateur
- Lieu de résidence, pays, ville, quartier
- Profession / métier / études / compétences
- Préférences (langues parlées, sujets d'intérêt, hobbies, goûts)
- Projets en cours mentionnés
- Relations (famille, amis, collègues mentionnés)
- Style de communication (ex: "utilise beaucoup d'emojis", "parle en créole haïtien", "ton familier", "messages courts", "aime l'humour")
- Humeur ou personnalité générale observée (ex: "enthousiaste", "curieux", "direct")
- Toute autre information personnelle partagée

Règles :
- UNIQUEMENT des faits EXPLICITEMENT présents dans la conversation
- NE déduis PAS d'informations non dites
- NE retourne PAS d'informations sur l'assistant
- Chaque fait = une phrase courte et claire
- Si rien de personnel → tableau vide
- Évite les doublons avec des faits trop similaires

Conversation :
${convText}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: extractPrompt }],
          tools: [{
            type: "function",
            function: {
              name: "save_memories",
              description: "Save extracted user facts as memories",
              parameters: {
                type: "object",
                properties: {
                  facts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", enum: ["identite", "lieu", "profession", "preference", "projet", "relation"] },
                        content: { type: "string" }
                      },
                      required: ["category", "content"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["facts"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "save_memories" } },
        }),
      });

      if (!aiResponse.ok) {
        console.error("AI extraction failed:", aiResponse.status);
        return new Response(JSON.stringify({ extracted: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      let facts: any[] = [];

      try {
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          facts = parsed.facts || [];
        }
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }

      // Save new unique facts
      let inserted = 0;
      for (const fact of facts) {
        if (!fact.content || existingSet.has(fact.content.toLowerCase())) continue;

        const { error } = await supabase
          .from("user_memories")
          .upsert({
            user_id,
            category: fact.category || "general",
            content: fact.content,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,content" });

        if (!error) {
          inserted++;
          existingSet.add(fact.content.toLowerCase());
        }
      }

      console.log(`Extracted ${inserted} new memories for user ${user_id}`);
      return new Response(JSON.stringify({ extracted: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
