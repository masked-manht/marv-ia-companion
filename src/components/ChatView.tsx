import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, ImagePlus, Sparkles, Copy, Check, StopCircle, Volume2, Crown, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { streamChat, generateImage, saveMessage, createConversation, getMessages, type ChatMessage } from "@/lib/marvia-api";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useVoice } from "@/hooks/useVoice";
import { isProModel } from "@/hooks/useCredits";
import { toast } from "sonner";

type UIMessage = ChatMessage & { id: string; isGeneratedImage?: boolean };

interface ChatViewProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  credits: number;
  onConsumeCredit: () => Promise<boolean>;
  onRefreshCredits: () => void;
}

export default function ChatView({ conversationId, onConversationCreated, credits, onConsumeCredit, onRefreshCredits }: ChatViewProps) {
  const { user } = useAuth();
  const { aiModel, voiceEnabled, voiceTone, responseStyle } = useSettings();
  const { speak, startListening } = useVoice();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (conversationId) {
      getMessages(conversationId).then(({ data }) => {
        if (data) {
          setMessages(data.map(m => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, image_url: m.image_url || undefined })));
        }
      });
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copié !");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleShare = async (text: string) => {
    const cleanText = text.replace(/[#*_`]/g, "").slice(0, 1000);
    const shareData = { title: "Marv-IA", text: cleanText };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch { /* cancelled */ }
    } else {
      // Fallback: WhatsApp link
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(cleanText)}`;
      window.open(whatsappUrl, "_blank");
    }
  };

  const handleVoice = () => {
    if (isListening) {
      stopListeningRef.current?.();
      setIsListening(false);
      return;
    }
    setIsListening(true);
    stopListeningRef.current = startListening(
      (text) => { setInput(prev => prev + text); },
      () => setIsListening(false)
    );
  };

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed && !imagePreview) return;
    if (isLoading) return;

    const isImageGen = trimmed.toLowerCase().startsWith("/image ") || trimmed.toLowerCase().startsWith("/img ");
    const needsCredit = isImageGen || isProModel(aiModel);

    // Check credits for pro features
    if (needsCredit) {
      if (credits <= 0) {
        toast.error("Crédits Pro épuisés ! Utilisez un modèle gratuit ou attendez demain.", { icon: "⚡" });
        return;
      }
      const success = await onConsumeCredit();
      if (!success) {
        toast.error("Crédits Pro épuisés !", { icon: "⚡" });
        return;
      }
    }

    let currentConvId = conversationId;

    if (!currentConvId && user) {
      const title = trimmed.slice(0, 50) || "Nouvelle conversation";
      const { data } = await createConversation(user.id, title);
      if (data) {
        currentConvId = data.id;
        onConversationCreated(data.id);
      }
    }

    const userMsgId = crypto.randomUUID();
    const userContent = imagePreview ? `[Image envoyée]\n${trimmed}` : trimmed;
    const userMsg: UIMessage = { id: userMsgId, role: "user", content: userContent, image_url: imagePreview || undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    const sentImage = imagePreview;
    setImagePreview(null);

    if (currentConvId && user) {
      saveMessage(currentConvId, user.id, "user", userContent, sentImage || undefined);
    }

    if (isImageGen) {
      setIsLoading(true);
      const prompt = trimmed.replace(/^\/(image|img)\s+/i, "");
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "🎨 Génération de l'image en cours...", isGeneratedImage: true }]);

      const result = await generateImage(prompt);
      if (result.error) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `❌ ${result.error}` } : m));
      } else if (result.imageUrl) {
        const content = result.text || "Voici l'image générée :";
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content, image_url: result.imageUrl } : m));
        if (currentConvId && user) {
          saveMessage(currentConvId, user.id, "assistant", content, result.imageUrl);
        }
      }
      setIsLoading(false);
      onRefreshCredits();
      return;
    }

    setIsLoading(true);
    let assistantSoFar = "";
    const assistantId = crypto.randomUUID();

    const apiMessages: any[] = messages.map(m => ({ role: m.role, content: m.content }));
    
    if (sentImage) {
      apiMessages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: sentImage } },
          { type: "text", text: trimmed || "Analyse cette image." },
        ],
      });
    } else {
      let stylePrefix = "";
      if (responseStyle === "precise") stylePrefix = "[Réponds de manière concise et précise] ";
      else if (responseStyle === "creative") stylePrefix = "[Réponds de manière détaillée et créative] ";
      apiMessages.push({ role: "user", content: stylePrefix + trimmed });
    }

    await streamChat({
      messages: apiMessages,
      model: aiModel,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) {
            return prev.map(m => m.id === assistantId ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { id: assistantId, role: "assistant", content: assistantSoFar }];
        });
      },
      onDone: () => {
        setIsLoading(false);
        if (currentConvId && user && assistantSoFar) {
          saveMessage(currentConvId, user.id, "assistant", assistantSoFar);
        }
        if (voiceEnabled && assistantSoFar) {
          speak(assistantSoFar.replace(/[#*_`]/g, "").slice(0, 500), voiceTone);
        }
        if (needsCredit) onRefreshCredits();
      },
      onError: (err) => {
        setIsLoading(false);
        toast.error(err);
        setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `❌ ${err}` }]);
      },
    });
  }, [input, imagePreview, isLoading, conversationId, user, messages, aiModel, responseStyle, voiceEnabled, voiceTone, speak, onConversationCreated, startListening, credits, onConsumeCredit, onRefreshCredits]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const currentIsProModel = isProModel(aiModel);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Pro model indicator */}
      {currentIsProModel && (
        <div className="flex items-center justify-center gap-1.5 py-1 bg-yellow-500/10 border-b border-yellow-500/20">
          <Crown className="w-3 h-3 text-yellow-500" />
          <span className="text-[11px] text-yellow-500 font-medium">Mode Pro • 1 crédit/message</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 pt-2 pb-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-60 space-y-3">
            <Sparkles className="w-12 h-12 text-primary" />
            <p className="text-lg font-semibold text-foreground">Marv-IA</p>
            <p className="text-sm text-muted-foreground text-center max-w-[260px]">Posez votre question ou envoyez /image pour générer une image.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}>
            <div className={`relative max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-secondary text-secondary-foreground rounded-bl-md"
            }`}>
              {msg.image_url && (
                <img src={msg.image_url} alt="Image" className="rounded-lg mb-2 max-w-full max-h-64 object-contain" />
              )}
              <div className="prose prose-sm prose-invert max-w-none break-words text-[15px] leading-relaxed [&_p]:mb-1 [&_ul]:mb-1 [&_ol]:mb-1">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {msg.role === "assistant" && (
                <div className="flex gap-2 mt-1.5 -mb-0.5">
                  <button onClick={() => handleCopy(msg.content, msg.id)} className="text-muted-foreground hover:text-primary transition-colors p-0.5">
                    {copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => handleShare(msg.content)} className="text-muted-foreground hover:text-primary transition-colors p-0.5">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  {voiceEnabled && (
                    <button onClick={() => speak(msg.content.replace(/[#*_`]/g, "").slice(0, 500), voiceTone)} className="text-muted-foreground hover:text-primary transition-colors p-0.5">
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start animate-slide-up">
            <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-primary rounded-full" style={{ animation: "typing-dot 1.4s infinite 0s" }} />
                <span className="w-2 h-2 bg-primary rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.2s" }} />
                <span className="w-2 h-2 bg-primary rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.4s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-3 pb-1">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-16 rounded-lg border border-border" />
            <button onClick={() => setImagePreview(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center">×</button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 pb-3 safe-bottom">
        <div className="flex items-end gap-2 bg-secondary rounded-2xl px-3 py-2 border border-border">
          <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors flex-shrink-0 self-end pb-1">
            <ImagePlus className="w-5 h-5" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Marv-IA..."
            rows={1}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-[15px] max-h-32 py-1 select-text"
            style={{ minHeight: "24px" }}
          />
          <button onClick={handleVoice} className={`flex-shrink-0 self-end pb-1 transition-colors ${isListening ? "text-destructive" : "text-muted-foreground hover:text-primary"}`}>
            {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button onClick={send} disabled={isLoading || (!input.trim() && !imagePreview)} className="flex-shrink-0 self-end pb-0.5 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
