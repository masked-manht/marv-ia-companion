import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Menu, Sparkles, Settings, Crown, Code2, Shield } from "lucide-react";
import ChatView from "@/components/ChatView";
import ProChatView from "@/components/ProChatView";
import SidebarDrawer from "@/components/SidebarDrawer";
import SettingsView from "@/components/SettingsView";
import CreditsDisplay from "@/components/CreditsDisplay";
import AuthPage from "@/components/AuthPage";
import ProfileCompletion from "@/components/ProfileCompletion";
import SplashScreen from "@/components/SplashScreen";
import VoiceIndicator from "@/components/VoiceIndicator";
import PermissionsRequest from "@/components/PermissionsRequest";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { useVoice } from "@/hooks/useVoice";
import { useSettings } from "@/contexts/SettingsContext";
import { getConversations, deleteConversation } from "@/lib/marvia-api";
import { toast } from "sonner";

const IDEView = lazy(() => import("@/components/ide/IDEView"));

type View = "chat" | "pro" | "settings" | "ide" | "studio";

const Index = () => {
  const { user, loading, profileComplete, isOwner, checkProfile } = useAuth();
  const { credits, consumeCredit, refreshCredits } = useCredits(user?.id);
  const { isSpeaking, stopSpeaking } = useVoice();
  const { ideMode } = useSettings();
  const [view, setView] = useState<View>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showPermissions, setShowPermissions] = useState(false);

  // Detect desktop for Studio mode hint
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;

  useEffect(() => {
    if (user && !localStorage.getItem("marvia-permissions-asked")) {
      setShowPermissions(true);
    }
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await getConversations(user.id);
    if (data) setConversations(data);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    if (view === "settings") setView("chat");
  };

  const handleDeleteConversation = async (id: string) => {
    const error = await deleteConversation(id);
    if (error) { toast.error("Erreur de suppression"); return; }
    if (activeConversationId === id) setActiveConversationId(null);
    toast.success("Conversation déplacée dans la corbeille");
    loadConversations();
  };

  const handleConversationCreated = (id: string) => {
    setActiveConversationId(id);
    setTimeout(loadConversations, 500);
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="w-10 h-10 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  if (!profileComplete) {
    return <ProfileCompletion userId={user.id} onComplete={() => checkProfile()} />;
  }

  if (showPermissions) {
    return <PermissionsRequest onComplete={() => setShowPermissions(false)} />;
  }

  // IDE fullscreen
  if (view === "ide") {
    return (
      <Suspense fallback={
        <div className="h-screen flex items-center justify-center" style={{ background: "#0A0E14" }}>
          <div className="flex flex-col items-center gap-3">
            <Code2 className="w-10 h-10 text-[#007BFF] animate-pulse" />
            <p className="text-sm text-[#4A5568]">Chargement du Mode IDE...</p>
          </div>
        </div>
      }>
        <IDEView onBack={() => setView("chat")} />
      </Suspense>
    );
  }

  // Studio mode: Chat + IDE side by side (desktop only)
  if (view === "studio") {
    return (
      <div className="h-screen flex overflow-hidden bg-background">
        {/* Chat panel */}
        <div className="w-[45%] min-w-[360px] flex flex-col border-r border-border">
          {/* Studio Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-card border-b border-border flex-shrink-0">
            <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <div className="w-7 h-7 bg-primary/15 rounded-full flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">Marv-IA Studio</p>
                <p className="text-[10px] text-primary leading-tight">v2.0.0</p>
              </div>
            </div>
            <button onClick={() => setView("chat")} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">
              Quitter Studio
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatView
              conversationId={activeConversationId}
              onConversationCreated={handleConversationCreated}
              credits={credits}
              onConsumeCredit={consumeCredit}
              onRefreshCredits={refreshCredits}
            />
          </div>
        </div>

        {/* IDE panel */}
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="h-full flex items-center justify-center" style={{ background: "#0A0E14" }}>
              <Code2 className="w-8 h-8 text-[#007BFF] animate-pulse" />
            </div>
          }>
            <IDEView onBack={() => setView("chat")} />
          </Suspense>
        </div>

        <VoiceIndicator isSpeaking={isSpeaking} onStop={stopSpeaking} />

        <SidebarDrawer
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={(id) => { setActiveConversationId(id); }}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          onOpenSettings={() => setView("settings")}
        />
      </div>
    );
  }

  if (view === "settings") {
    return <SettingsView onBack={() => setView("chat")} credits={credits} onConversationsChanged={loadConversations} />;
  }

  if (view === "pro") {
    return (
      <div className="h-screen flex flex-col overflow-hidden" style={{ background: "hsl(240 15% 6%)" }}>
        <ProChatView
          conversationId={activeConversationId}
          onConversationCreated={handleConversationCreated}
          credits={credits}
          onConsumeCredit={consumeCredit}
          onRefreshCredits={refreshCredits}
          onBack={() => setView("chat")}
        />
        <VoiceIndicator isSpeaking={isSpeaking} onStop={stopSpeaking} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Owner badge */}
      {isOwner && (
        <div className="flex items-center justify-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/30">
          <Shield className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Owner Mode</span>
        </div>
      )}

      {/* App Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 bg-primary/15 rounded-full flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Marv-IA</p>
            <p className="text-[11px] text-primary leading-tight">v2.0.0 — En ligne</p>
          </div>
        </div>
        <button
          onClick={() => setView("pro")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-lg hover:shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
        >
          <Crown className="w-3.5 h-3.5" />
          <span>PRO</span>
          <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{credits}</span>
        </button>
        {ideMode && (
          <>
            <button
              onClick={() => setView("ide")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#007BFF]/15 text-[#007BFF] text-xs font-bold hover:bg-[#007BFF]/25 transition-all"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>IDE</span>
            </button>
            {isDesktop && (
              <button
                onClick={() => setView("studio")}
                className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-[#007BFF]/15 to-primary/15 text-[#007BFF] text-xs font-bold hover:from-[#007BFF]/25 hover:to-primary/25 transition-all"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Studio</span>
              </button>
            )}
          </>
        )}
        <button onClick={() => setView("settings")} className="text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatView
          conversationId={activeConversationId}
          onConversationCreated={handleConversationCreated}
          credits={credits}
          onConsumeCredit={consumeCredit}
          onRefreshCredits={refreshCredits}
        />
      </div>

      <VoiceIndicator isSpeaking={isSpeaking} onStop={stopSpeaking} />

      {/* Sidebar */}
      <SidebarDrawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={(id) => { setActiveConversationId(id); setView("chat"); }}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        onOpenSettings={() => setView("settings")}
      />
    </div>
  );
};

export default Index;
