import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, ImagePlus, Copy, Check, StopCircle, Volume2, Share2, Crown, ArrowLeft, Sparkles, Image as ImageIcon, Camera, MapPin, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { streamChat, streamSearch, generateImage, saveMessage, createConversation, getMessages, type ChatMessage } from "@/lib/marvia-api";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useVoice } from "@/hooks/useVoice";
import { useLocation } from "@/hooks/useLocation";
import { useCamera } from "@/hooks/useCamera";
import { toast } from "sonner";

type UIMessage = ChatMessage & { id: string; isGeneratedImage?: boolean };

interface ProChatViewProps {
  conversationId: string | null;
  onConversationCreated: (id: string) => void;
  credits: number;
  onConsumeCredit: () => Promise<boolean>;
  onRefreshCredits: () => void;
  onBack: () => void;
}

const PRO_MODEL = "google/gemini-2.5-pro";

export default function ProChatView({ conversationId, onConversationCreated, credits, onConsumeCredit, onRefreshCredits, onBack }: ProChatViewProps) {
  const { user } = useAuth();
  const { voiceEnabled, voiceTone, responseStyle } = useSettings();
  const { speak, startListening } = useVoice();
  const { location, requestLocation } = useLocation();
  const { capture } = useCamera();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [locationActive, setLocationActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (conversationId) {
      getMessages(conversationId).then(({ data }) => {
        if (data) setMessages(data.map(m => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, image_url: m.image_url || undefined })));
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

  const handleShare = async (text: string) => {
    const cleanText = text.replace(/[#*_`]/g, "").slice(0, 1000);
    if (navigator.share) {
      try { await navigator.share({ title: "Marv-IA Pro", text: cleanText }); } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(cleanText)}`, "_blank");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleVoice = () => {
    if (isListening) { stopListeningRef.current?.(); setIsListening(false); return; }
    setIsListening(true);
    stopListeningRef.current = startListening(
      (text) => { setInput(prev => prev + text); },
      () => setIsListening(false)
    );
  };

  const handleCamera = async () => {
    const photo = await capture();
    if (photo) setImagePreview(photo);
  };

  const handleLocation = async () => {
    const loc = await requestLocation();
    if (loc) {
      setLocationActive(true);
      toast.success(`📍 Position activée (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`);
    } else {
      toast.error("Impossible d'obtenir la position.");
    }
  };

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed && !imagePreview) return;
    if (isLoading) return;

    const isImageGen = trimmed.toLowerCase().startsWith("/image ") || trimmed.toLowerCase().startsWith("/img ");

    // Always consume credit in Pro mode
    if (credits <= 0) {
      toast.error("Crédits Pro épuisés ! Revenez demain ou passez en mode gratuit.", { icon: "⚡" });
      return;
    }
    const success = await onConsumeCredit();
    if (!success) { toast.error("Crédits Pro épuisés !", { icon: "⚡" }); return; }

    let currentConvId = conversationId;
    if (!currentConvId && user) {
      const title = `⚡ ${trimmed.slice(0, 45)}` || "⚡ Conversation Pro";
      const { data } = await createConversation(user.id, title, true);
      if (data) { currentConvId = data.id; onConversationCreated(data.id); }
    }

    const userMsgId = crypto.randomUUID();
    const userContent = imagePreview ? `[Image envoyée]\n${trimmed}` : trimmed;
    const userMsg: UIMessage = { id: userMsgId, role: "user", content: userContent, image_url: imagePreview || undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    const sentImage = imagePreview;
    setImagePreview(null);

    if (currentConvId && user) saveMessage(currentConvId, user.id, "user", userContent, sentImage || undefined);

    if (isImageGen) {
      setIsLoading(true);
      const prompt = trimmed.replace(/^\/(image|img)\s+/i, "");
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "🎨 Génération en cours...", isGeneratedImage: true }]);
      const result = await generateImage(prompt);
      if (result.error) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `❌ ${result.error}` } : m));
      } else if (result.imageUrl) {
        const content = result.text || "Image générée :";
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content, image_url: result.imageUrl } : m));
        if (currentConvId && user) saveMessage(currentConvId, user.id, "assistant", content, result.imageUrl);
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
      apiMessages.push({ role: "user", content: [{ type: "image_url", image_url: { url: sentImage } }, { type: "text", text: trimmed || "Analyse cette image." }] });
    } else {
      let stylePrefix = "";
      if (responseStyle === "precise") stylePrefix = "[Réponds de manière concise et précise] ";
      else if (responseStyle === "creative") stylePrefix = "[Réponds de manière détaillée et créative] ";
      apiMessages.push({ role: "user", content: stylePrefix + trimmed });
    }

    await streamChat({
      messages: apiMessages,
      model: PRO_MODEL,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) return prev.map(m => m.id === assistantId ? { ...m, content: assistantSoFar } : m);
          return [...prev, { id: assistantId, role: "assistant", content: assistantSoFar }];
        });
      },
      onDone: () => {
        setIsLoading(false);
        if (currentConvId && user && assistantSoFar) saveMessage(currentConvId, user.id, "assistant", assistantSoFar);
        if (voiceEnabled && assistantSoFar) speak(assistantSoFar.replace(/[#*_`]/g, "").slice(0, 500), voiceTone);
        onRefreshCredits();
      },
      onError: (err) => {
        setIsLoading(false);
        toast.error(err);
        setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: `❌ ${err}` }]);
      },
    });
  }, [input, imagePreview, isLoading, conversationId, user, messages, responseStyle, voiceEnabled, voiceTone, speak, onConversationCreated, credits, onConsumeCredit, onRefreshCredits]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full bg-pro-bg">
      {/* Pro Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-pro-card border-b border-pro-border flex-shrink-0">
        <button onClick={onBack} className="text-pro-accent hover:opacity-80 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 bg-pro-accent/15 rounded-full flex items-center justify-center">
            <Crown className="w-4 h-4 text-pro-accent" />
          </div>
          <div>
            <p className="text-sm font-bold text-pro-fg leading-tight">Marv-IA Pro</p>
            <p className="text-[11px] text-pro-accent leading-tight">Gemini 2.5 Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-pro-accent/10 px-2.5 py-1 rounded-full border border-pro-accent/20">
          <Crown className="w-3.5 h-3.5 text-pro-accent" />
          <span className="text-xs font-bold text-pro-accent">{credits}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 pt-2 pb-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-20 h-20 bg-pro-accent/10 rounded-2xl flex items-center justify-center border border-pro-accent/20">
              <Crown className="w-10 h-10 text-pro-accent" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-bold text-pro-fg">Marv-IA Pro</p>
              <p className="text-sm text-pro-muted max-w-[280px]">Modèle Gemini 2.5 Pro • Raisonnement avancé • Génération d'images</p>
            </div>
            <div className="flex gap-2">
              {[
                { icon: <Sparkles className="w-3.5 h-3.5" />, label: "Raisonnement" },
                { icon: <ImageIcon className="w-3.5 h-3.5" />, label: "Images" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-1.5 bg-pro-accent/10 text-pro-accent text-xs px-3 py-1.5 rounded-full border border-pro-accent/20">
                  {f.icon}
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}>
            <div className={`relative max-w-[85%] rounded-2xl px-4 py-2.5 ${
              msg.role === "user"
                ? "bg-pro-accent text-pro-bg rounded-br-md"
                : "bg-pro-card text-pro-fg rounded-bl-md border border-pro-border"
            }`}>
              {msg.image_url && (
                <img src={msg.image_url} alt="Image" className="rounded-lg mb-2 max-w-full max-h-64 object-contain" />
              )}
              <div className="prose prose-sm prose-invert max-w-none break-words text-[15px] leading-relaxed [&_p]:mb-1 [&_ul]:mb-1 [&_ol]:mb-1">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {msg.role === "assistant" && (
                <div className="flex gap-2 mt-1.5 -mb-0.5">
                  <button onClick={() => handleCopy(msg.content, msg.id)} className="text-pro-muted hover:text-pro-accent transition-colors p-0.5">
                    {copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => handleShare(msg.content)} className="text-pro-muted hover:text-pro-accent transition-colors p-0.5">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  {voiceEnabled && (
                    <button onClick={() => speak(msg.content.replace(/[#*_`]/g, "").slice(0, 500), voiceTone)} className="text-pro-muted hover:text-pro-accent transition-colors p-0.5">
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
            <div className="bg-pro-card rounded-2xl rounded-bl-md px-4 py-3 border border-pro-border">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-pro-accent rounded-full" style={{ animation: "typing-dot 1.4s infinite 0s" }} />
                <span className="w-2 h-2 bg-pro-accent rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.2s" }} />
                <span className="w-2 h-2 bg-pro-accent rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.4s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="px-3 pb-1">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-16 rounded-lg border border-pro-border" />
            <button onClick={() => setImagePreview(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center">×</button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 pb-3 safe-bottom">
        <div className="flex items-end gap-2 bg-pro-card rounded-2xl px-3 py-2 border border-pro-border">
          <label className="cursor-pointer text-pro-muted hover:text-pro-accent transition-colors flex-shrink-0 self-end pb-1">
            <ImagePlus className="w-5 h-5" />
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Pro..."
            rows={1}
            className="flex-1 bg-transparent text-pro-fg placeholder:text-pro-muted resize-none outline-none text-[15px] max-h-32 py-1 select-text"
            style={{ minHeight: "24px" }}
          />
          <button onClick={handleVoice} className={`flex-shrink-0 self-end pb-1 transition-colors ${isListening ? "text-destructive" : "text-pro-muted hover:text-pro-accent"}`}>
            {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button onClick={send} disabled={isLoading || (!input.trim() && !imagePreview)} className="flex-shrink-0 self-end pb-0.5 w-8 h-8 bg-pro-accent text-pro-bg rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
