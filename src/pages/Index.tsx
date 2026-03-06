import React, { useState, useEffect, useCallback } from "react";
import { Menu, Sparkles, Settings, Search } from "lucide-react";
import ChatView from "@/components/ChatView";
import SidebarDrawer from "@/components/SidebarDrawer";
import SettingsView from "@/components/SettingsView";
import CreditsDisplay from "@/components/CreditsDisplay";
import AuthPage from "@/components/AuthPage";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/hooks/useCredits";
import { getConversations, deleteConversation } from "@/lib/marvia-api";
import { toast } from "sonner";

type View = "chat" | "settings";

const Index = () => {
  const { user, loading } = useAuth();
  const { credits, consumeCredit, refreshCredits } = useCredits(user?.id);
  const [view, setView] = useState<View>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await getConversations(user.id);
    if (data) setConversations(data);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setView("chat");
  };

  const handleDeleteConversation = async (id: string) => {
    const error = await deleteConversation(id);
    if (error) {
      toast.error("Erreur de suppression");
    } else {
      if (activeConversationId === id) setActiveConversationId(null);
      loadConversations();
    }
  };

  const handleConversationCreated = (id: string) => {
    setActiveConversationId(id);
    setTimeout(loadConversations, 500);
  };

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

  if (!user) {
    return <AuthPage />;
  }

  if (view === "settings") {
    return <SettingsView onBack={() => setView("chat")} credits={credits} />;
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
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
            <p className="text-[11px] text-primary leading-tight">En ligne</p>
          </div>
        </div>
        <CreditsDisplay credits={credits} />
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

      {/* Sidebar Drawer */}
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
