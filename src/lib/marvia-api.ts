import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marvia-chat`;
const MEMORY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marvia-memory`;
const IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marvia-image`;
const SEARCH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marvia-search`;

export type ChatMessage = { role: "user" | "assistant"; content: string; image_url?: string };

export async function streamChat({
  messages,
  model,
  timezone,
  userId,
  onDelta,
  onDone,
  onError,
}: {
  messages: ChatMessage[];
  model?: string;
  timezone?: string;
  userId?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, model, timezone: tz, user_id: userId }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: "Erreur réseau" }));
      onError(errData.error || `Erreur ${resp.status}`);
      return;
    }

    if (!resp.body) { onError("Pas de réponse"); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Erreur inconnue");
  }
}

export async function streamSearch({
  query,
  location,
  onDelta,
  onDone,
  onError,
}: {
  query: string;
  location?: { latitude: number; longitude: number } | null;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ query, location }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: "Erreur réseau" }));
      onError(errData.error || `Erreur ${resp.status}`);
      return;
    }

    if (!resp.body) { onError("Pas de réponse"); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Erreur inconnue");
  }
}

export async function generateImage(prompt: string): Promise<{ imageUrl?: string; text?: string; error?: string }> {
  try {
    const resp = await fetch(IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: "Erreur" }));
      return { error: err.error };
    }

    return await resp.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

// Save message to DB
export async function saveMessage(conversationId: string, userId: string, role: string, content: string, imageUrl?: string) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
    image_url: imageUrl || null,
  });
  return error;
}

export async function createConversation(userId: string, title: string, isPro: boolean = false) {
  const { data, error } = await supabase.from("conversations").insert({ user_id: userId, title, is_pro: isPro } as any).select().single();
  return { data, error };
}

export async function getConversations(userId: string) {
  const { data, error } = await supabase.from("conversations").select("*").eq("user_id", userId).is("deleted_at" as any, null).order("updated_at", { ascending: false });
  return { data, error };
}

export async function getDeletedConversations(userId: string) {
  const { data, error } = await supabase.from("conversations").select("*").eq("user_id", userId).not("deleted_at" as any, "is", null).order("deleted_at" as any, { ascending: false });
  return { data, error };
}

export async function getMessages(conversationId: string) {
  const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  return { data, error };
}

// Soft delete
export async function deleteConversation(conversationId: string) {
  const { error } = await supabase.from("conversations").update({ deleted_at: new Date().toISOString() } as any).eq("id", conversationId);
  return error;
}

// Restore from trash
export async function restoreConversation(conversationId: string) {
  const { error } = await supabase.from("conversations").update({ deleted_at: null } as any).eq("id", conversationId);
  return error;
}

// Permanent delete
export async function permanentlyDeleteConversation(conversationId: string) {
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  return error;
}

// --- Memory API ---
const memoryHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

export async function extractMemories(userId: string, messages: ChatMessage[]) {
  try {
    await fetch(MEMORY_URL, {
      method: "POST",
      headers: memoryHeaders,
      body: JSON.stringify({ action: "extract", user_id: userId, messages }),
    });
  } catch (e) {
    console.error("Memory extraction failed:", e);
  }
}

export async function getUserMemories(userId: string) {
  try {
    const resp = await fetch(MEMORY_URL, {
      method: "POST",
      headers: memoryHeaders,
      body: JSON.stringify({ action: "get", user_id: userId }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.memories || [];
  } catch {
    return [];
  }
}

export async function deleteMemory(userId: string, memoryId: string) {
  await fetch(MEMORY_URL, {
    method: "POST",
    headers: memoryHeaders,
    body: JSON.stringify({ action: "delete", user_id: userId, memory_id: memoryId }),
  });
}

export async function clearAllMemories(userId: string) {
  await fetch(MEMORY_URL, {
    method: "POST",
    headers: memoryHeaders,
    body: JSON.stringify({ action: "clear", user_id: userId }),
  });
}

// --- Content Report ---
export async function reportContent(userId: string, messageContent: string, reason: string, conversationId?: string) {
  const { error } = await supabase.from("content_reports").insert({
    user_id: userId,
    message_content: messageContent.slice(0, 2000),
    reason,
    conversation_id: conversationId || null,
  });
  return { error };
}
