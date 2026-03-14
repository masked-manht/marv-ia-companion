import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, User, Palette, Volume2, Wrench, Info, Moon, Sun, Monitor, Zap, Crown, Bell, RefreshCw, CheckCircle, Code2, Trash2, RotateCcw, AlertTriangle, ChevronRight, Brain, X, Search, Tag, Shield, Activity, Clock, Hash, Users, MessageSquareWarning, HeartPulse } from "lucide-react";
import { useSettings, ACCENT_OPTIONS, type AccentColor } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { Switch } from "@/components/ui/switch";
import { isProModel } from "@/hooks/useCredits";
import { getDeletedConversations, restoreConversation, permanentlyDeleteConversation, getUserMemories, deleteMemory, clearAllMemories } from "@/lib/marvia-api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ACCENT_LABELS: Record<AccentColor, { label: string; preview: string }> = {
  green:  { label: "Vert",   preview: "bg-[hsl(120,100%,55%)]" },
  blue:   { label: "Bleu",   preview: "bg-[hsl(217,91%,60%)]" },
  purple: { label: "Violet", preview: "bg-[hsl(270,76%,62%)]" },
  orange: { label: "Orange", preview: "bg-[hsl(25,95%,53%)]" },
  pink:   { label: "Rose",   preview: "bg-[hsl(330,81%,60%)]" },
  cyan:   { label: "Cyan",   preview: "bg-[hsl(187,85%,53%)]" },
};

interface SettingsViewProps {
  onBack: () => void;
  credits: number;
  onConversationsChanged?: () => void;
}

const MODEL_LABELS: Record<string, { label: string; pro: boolean }> = {
  "google/gemini-3-flash-preview": { label: "Gemini 3 Flash (Rapide)", pro: false },
  "google/gemini-2.5-flash": { label: "Gemini 2.5 Flash (Équilibré)", pro: false },
  "google/gemini-2.5-pro": { label: "Gemini 2.5 Pro (Puissant)", pro: true },
};

const CAT_ICONS: Record<string, string> = {
  identite: "👤", lieu: "📍", profession: "💼",
  preference: "⭐", projet: "📋", relation: "👥", general: "📝",
  style: "🎭", humeur: "💭",
};

export default function SettingsView({ onBack, credits, onConversationsChanged }: SettingsViewProps) {
  const { theme, setTheme, responseStyle, setResponseStyle, voiceEnabled, setVoiceEnabled, voiceTone, setVoiceTone, aiModel, setAiModel, accentColor, setAccentColor, ideMode, setIdeMode, ideAutoSave, setIdeAutoSave, ideTheme, setIdeTheme } = useSettings();
  const { user, signOut, isOwner } = useAuth();
  const { permission, supported, requestPermission, sendLocalNotification } = useNotifications();
  const { updateAvailable, checking, checkForUpdate, applyUpdate } = useServiceWorker();

  // Trash state
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashConversations, setTrashConversations] = useState<any[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Memory state
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memories, setMemories] = useState<any[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [confirmClearMemory, setConfirmClearMemory] = useState(false);
  const [memorySearch, setMemorySearch] = useState("");
  const [memoryFilter, setMemoryFilter] = useState<string | null>(null);
  const [monitorData, setMonitorData] = useState({ promptTokens: 0, responseTokens: 0, latency: 0 });
  const [ownerStats, setOwnerStats] = useState({ userCount: 0, messageCount: 0, reports: [] as any[] });

  // Owner monitoring polling
  useEffect(() => {
    if (!isOwner) return;
    const interval = setInterval(() => {
      const data = (window as any).__marviaMonitoring;
      if (data) setMonitorData({ promptTokens: data.promptTokens || 0, responseTokens: data.responseTokens || 0, latency: data.latency || 0 });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOwner]);

  // Owner: Load admin stats
  useEffect(() => {
    if (!isOwner) return;
    const loadStats = async () => {
      try {
        const [profilesRes, messagesRes, reportsRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("messages").select("id", { count: "exact", head: true }),
          supabase.from("content_reports").select("*").order("created_at", { ascending: false }).limit(20),
        ]);
        setOwnerStats({
          userCount: profilesRes.count || 0,
          messageCount: messagesRes.count || 0,
          reports: reportsRes.data || [],
        });
      } catch { /* ignore */ }
    };
    loadStats();
  }, [isOwner]);

  const loadTrash = useCallback(async () => {
    if (!user) return;
    setTrashLoading(true);
    const { data } = await getDeletedConversations(user.id);
    setTrashConversations(data || []);
    setTrashLoading(false);
  }, [user]);

  useEffect(() => {
    if (trashOpen) loadTrash();
  }, [trashOpen, loadTrash]);

  const loadMemories = useCallback(async () => {
    if (!user) return;
    setMemoryLoading(true);
    const data = await getUserMemories(user.id);
    setMemories(data);
    setMemoryLoading(false);
  }, [user]);

  useEffect(() => {
    if (memoryOpen) loadMemories();
  }, [memoryOpen, loadMemories]);

  const handleDeleteMemory = async (id: string) => {
    if (!user) return;
    await deleteMemory(user.id, id);
    setMemories(prev => prev.filter(m => m.id !== id));
    toast.success("Souvenir supprimé");
  };

  const handleClearAllMemories = async () => {
    if (!user) return;
    await clearAllMemories(user.id);
    setMemories([]);
    setConfirmClearMemory(false);
    toast.success("Mémoire effacée");
  };

  const handleRestore = async (id: string) => {
    const error = await restoreConversation(id);
    if (error) { toast.error("Erreur de restauration"); return; }
    toast.success("Conversation restaurée !");
    loadTrash();
    onConversationsChanged?.();
  };

  const handlePermanentDelete = async (id: string) => {
    const error = await permanentlyDeleteConversation(id);
    if (error) { toast.error("Erreur de suppression"); return; }
    toast.success("Supprimée définitivement");
    setConfirmDeleteId(null);
    loadTrash();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  // Filtered memories
  const filteredMemories = memories.filter(m => {
    const matchesSearch = !memorySearch || m.content?.toLowerCase().includes(memorySearch.toLowerCase());
    const matchesFilter = !memoryFilter || m.category === memoryFilter;
    return matchesSearch && matchesFilter;
  });

  const uniqueCategories = [...new Set(memories.map((m: any) => m.category))];

  const Section: React.FC<{ icon: React.ReactNode; title: React.ReactNode; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="bg-secondary rounded-xl border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );

  const Row: React.FC<{ label: React.ReactNode; value?: string; children?: React.ReactNode; onClick?: () => void }> = ({ label, value, children, onClick }) => (
    <div
      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <span className="text-sm text-foreground">{label}</span>
      {children || <span className="text-sm text-muted-foreground">{value}</span>}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={onBack} className="text-primary"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-lg font-semibold text-foreground flex-1">Paramètres</h2>
        {isOwner && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] font-bold text-amber-400 uppercase">Owner</span>
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
        {/* Owner Monitoring - Only rendered if isOwner */}
        {isOwner && (
          <Section icon={<Activity className="w-4 h-4" />} title={
            <span className="flex items-center gap-2">
              Monitorage & Tokens
              <span className="text-[9px] font-bold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">OWNER</span>
            </span>
          }>
            <Row label={<span className="flex items-center gap-2"><Hash className="w-3.5 h-3.5 text-muted-foreground" />Prompt Tokens (estimé)</span>}>
              <span className="text-xs font-mono text-primary">{monitorData.promptTokens > 0 ? `~${monitorData.promptTokens.toLocaleString()}` : "—"}</span>
            </Row>
            <Row label={<span className="flex items-center gap-2"><Hash className="w-3.5 h-3.5 text-muted-foreground" />Response Tokens (estimé)</span>}>
              <span className="text-xs font-mono text-primary">{monitorData.responseTokens > 0 ? `~${monitorData.responseTokens.toLocaleString()}` : "—"}</span>
            </Row>
            <Row label={<span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground" />Latence API (dernier appel)</span>}>
              <span className={`text-xs font-mono ${monitorData.latency > 0 ? (monitorData.latency < 1000 ? "text-primary" : monitorData.latency < 3000 ? "text-yellow-500" : "text-destructive") : "text-primary"}`}>
                {monitorData.latency > 0 ? `${monitorData.latency}ms` : "—"}
              </span>
            </Row>
            <Row label="Version système" value="v2.0.0" />
            <div className="px-4 py-2 text-[10px] text-muted-foreground">
              Données de monitoring en temps réel. Les tokens sont estimés (~4 caractères = 1 token).
            </div>
          </Section>
        )}

        {/* Crédits */}
        <Section icon={<Zap className="w-4 h-4" />} title="Crédits Pro">
          <Row label="Crédits restants">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${credits <= 5 ? "text-destructive" : "text-primary"}`}>{credits}/25</span>
            </div>
          </Row>
          <Row label="Renouvellement" value="Chaque jour à minuit (heure locale)" />
          <div className="px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 mb-1">
              <Crown className="w-3.5 h-3.5 text-yellow-500" />
              <span className="font-medium text-foreground">Fonctionnalités Pro (1 crédit)</span>
            </div>
            <p>• Modèles IA avancés (Gemini 2.5 Pro)</p>
            <p>• Génération d'images (/image)</p>
            <div className="flex items-center gap-1.5 mt-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-foreground">Gratuit illimité</span>
            </div>
            <p>• Gemini 3 Flash & Gemini 2.5 Flash</p>
            <p>• Analyse d'images envoyées</p>
            <p>• Mode vocal</p>
          </div>
        </Section>

        {/* Compte */}
        <Section icon={<User className="w-4 h-4" />} title="Compte">
          <Row label="Utilisateur" value={user?.email || "Non connecté"} />
          {user && (
            <div className="px-4 py-3">
              <button onClick={signOut} className="text-sm text-destructive hover:underline">Se déconnecter</button>
            </div>
          )}
        </Section>

        {/* Personnalisation */}
        <Section icon={<Palette className="w-4 h-4" />} title="Personnalisation">
          <Row label="Thème">
            <div className="flex gap-1.5">
              {(["dark", "light", "auto"] as const).map(t => (
                <button key={t} onClick={() => setTheme(t)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${theme === t ? "bg-primary text-primary-foreground neon-glow" : "bg-muted text-muted-foreground"}`}>
                  {t === "dark" ? <Moon className="w-3.5 h-3.5 inline mr-1" /> : t === "light" ? <Sun className="w-3.5 h-3.5 inline mr-1" /> : <Monitor className="w-3.5 h-3.5 inline mr-1" />}
                  {t === "dark" ? "Sombre" : t === "light" ? "Clair" : "Auto"}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Style de réponse">
            <div className="flex gap-1.5">
              {(["precise", "standard", "creative"] as const).map(s => (
                <button key={s} onClick={() => setResponseStyle(s)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${responseStyle === s ? "bg-primary text-primary-foreground neon-glow" : "bg-muted text-muted-foreground"}`}>
                  {s === "precise" ? "Précis" : s === "standard" ? "Standard" : "Créatif"}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Couleur d'accent">
            <div className="flex gap-1.5">
              {(Object.keys(ACCENT_LABELS) as AccentColor[]).map(c => (
                <button
                  key={c}
                  onClick={() => setAccentColor(c)}
                  className={`w-7 h-7 rounded-full ${ACCENT_LABELS[c].preview} transition-all ${accentColor === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : "opacity-70 hover:opacity-100"}`}
                  title={ACCENT_LABELS[c].label}
                />
              ))}
            </div>
          </Row>
        </Section>

        {/* Mode IDE */}
        <Section icon={<Code2 className="w-4 h-4" />} title="Mode IDE">
          <Row label="Activer le Mode IDE">
            <Switch checked={ideMode} onCheckedChange={setIdeMode} />
          </Row>
          {ideMode && (
            <Row label="Sauvegarde automatique">
              <Switch checked={ideAutoSave} onCheckedChange={setIdeAutoSave} />
            </Row>
          )}
          {ideMode && (
            <Row label="Thème IDE">
              <div className="flex gap-1.5">
                {(["dark", "light"] as const).map(t => (
                  <button key={t} onClick={() => setIdeTheme(t)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${ideTheme === t ? "bg-primary text-primary-foreground neon-glow" : "bg-muted text-muted-foreground"}`}>
                    {t === "dark" ? <Moon className="w-3.5 h-3.5 inline mr-1" /> : <Sun className="w-3.5 h-3.5 inline mr-1" />}
                    {t === "dark" ? "Sombre" : "Clair"}
                  </button>
                ))}
              </div>
            </Row>
          )}
          <div className="px-4 py-2 text-xs text-muted-foreground">
            <p>Éditeur de code intégré avec prévisualisation en direct, console et assistant IA.</p>
            {ideMode && <p className="mt-1">La sauvegarde auto enregistre vos fichiers en local toutes les 5 secondes.</p>}
          </div>
        </Section>

        {/* Audio */}
        <Section icon={<Volume2 className="w-4 h-4" />} title="Audio & Voix">
          <Row label="Synthèse vocale">
            <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
          </Row>
          {voiceEnabled && (
            <Row label="Tonalité">
              <div className="flex gap-1.5">
                {(["neutral", "dynamic", "soft"] as const).map(t => (
                  <button key={t} onClick={() => setVoiceTone(t)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${voiceTone === t ? "bg-primary text-primary-foreground neon-glow" : "bg-muted text-muted-foreground"}`}>
                    {t === "neutral" ? "Neutre" : t === "dynamic" ? "Dynamique" : "Douce"}
                  </button>
                ))}
              </div>
            </Row>
          )}
        </Section>

        {/* Notifications */}
        {supported && (
          <Section icon={<Bell className="w-4 h-4" />} title="Notifications">
            <Row label="Notifications push">
              {permission === "granted" ? (
                <span className="text-xs text-primary font-medium">Activées ✓</span>
              ) : permission === "denied" ? (
                <span className="text-xs text-destructive">Bloquées</span>
              ) : (
                <button onClick={async () => {
                  const ok = await requestPermission();
                  if (ok) sendLocalNotification("Marv-IA", "Notifications activées ! 🎉");
                }} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg">
                  Activer
                </button>
              )}
            </Row>
          </Section>
        )}

        {/* Mémoire */}
        <Section icon={<Brain className="w-4 h-4" />} title="Mémoire">
          <Row label="Souvenirs de l'IA" onClick={() => setMemoryOpen(!memoryOpen)}>
            <div className="flex items-center gap-2">
              {!memoryOpen && memories.length > 0 && (
                <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">{memories.length}</span>
              )}
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${memoryOpen ? "rotate-90" : ""}`} />
            </div>
          </Row>
          {memoryOpen && (
            <div className="px-3 py-3 space-y-2 max-h-[28rem] overflow-y-auto scrollbar-hide">
              {/* Search & Filter bar */}
              {memories.length > 0 && (
                <div className="space-y-2 pb-2">
                  <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-2.5 py-1.5">
                    <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      value={memorySearch}
                      onChange={e => setMemorySearch(e.target.value)}
                      placeholder="Rechercher un souvenir..."
                      className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    {memorySearch && (
                      <button onClick={() => setMemorySearch("")} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {uniqueCategories.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => setMemoryFilter(null)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${!memoryFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        Tous
                      </button>
                      {uniqueCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setMemoryFilter(memoryFilter === cat ? null : cat)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${memoryFilter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        >
                          <span>{CAT_ICONS[cat] || "📝"}</span>
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {filteredMemories.length} / {memories.length} souvenirs
                  </div>
                </div>
              )}

              {memoryLoading && (
                <p className="text-center text-muted-foreground text-xs py-4">Chargement...</p>
              )}
              {!memoryLoading && memories.length === 0 && (
                <div className="flex flex-col items-center py-6 opacity-60">
                  <Brain className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Aucun souvenir enregistré</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Discutez avec Marv-IA pour qu'elle apprenne à vous connaître</p>
                </div>
              )}
              {filteredMemories.map((mem: any) => (
                <div key={mem.id} className="flex items-start gap-2 bg-muted/50 rounded-lg p-2.5 group">
                  <span className="text-sm flex-shrink-0">{CAT_ICONS[mem.category] || "📝"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">{mem.content}</p>
                    <span className="text-[9px] text-muted-foreground mt-0.5 inline-block">#{mem.category}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteMemory(mem.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {memories.length > 0 && (
                <div className="pt-2">
                  {confirmClearMemory ? (
                    <div className="flex items-center gap-2 bg-destructive/10 rounded-lg p-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      <p className="text-[10px] text-destructive flex-1">Effacer toute la mémoire ?</p>
                      <button onClick={handleClearAllMemories} className="text-[10px] font-bold text-destructive-foreground bg-destructive px-2 py-0.5 rounded">Oui</button>
                      <button onClick={() => setConfirmClearMemory(false)} className="text-[10px] text-muted-foreground px-1.5 py-0.5">Non</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClearMemory(true)}
                      className="w-full text-center text-[11px] text-destructive hover:underline py-1"
                    >
                      Tout effacer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="px-4 py-2 text-[10px] text-muted-foreground">
            Marv-IA mémorise automatiquement vos préférences et informations personnelles partagées en conversation.
          </div>
        </Section>

        {/* Corbeille */}
        <Section icon={<Trash2 className="w-4 h-4" />} title="Corbeille">
          <Row label="Conversations supprimées" onClick={() => setTrashOpen(!trashOpen)}>
            <div className="flex items-center gap-2">
              {!trashOpen && trashConversations.length > 0 && (
                <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-medium">{trashConversations.length}</span>
              )}
              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${trashOpen ? "rotate-90" : ""}`} />
            </div>
          </Row>
          {trashOpen && (
            <div className="px-3 py-3 space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
              {trashLoading && (
                <p className="text-center text-muted-foreground text-xs py-4">Chargement...</p>
              )}
              {!trashLoading && trashConversations.length === 0 && (
                <div className="flex flex-col items-center py-6 opacity-60">
                  <Trash2 className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">La corbeille est vide</p>
                </div>
              )}
              {trashConversations.map(conv => (
                <div key={conv.id} className="bg-muted/50 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{conv.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Supprimée le {formatDate(conv.deleted_at)}
                      </p>
                    </div>
                    {conv.is_pro && (
                      <span className="text-[9px] font-bold bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full flex-shrink-0">PRO</span>
                    )}
                  </div>
                  
                  {confirmDeleteId === conv.id ? (
                    <div className="flex items-center gap-2 bg-destructive/10 rounded-lg p-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      <p className="text-[10px] text-destructive flex-1">Supprimer définitivement ?</p>
                      <button
                        onClick={() => handlePermanentDelete(conv.id)}
                        className="text-[10px] font-bold text-destructive-foreground bg-destructive px-2 py-0.5 rounded"
                      >
                        Oui
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-[10px] text-muted-foreground px-1.5 py-0.5"
                      >
                        Non
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleRestore(conv.id)}
                        className="flex items-center gap-1 flex-1 justify-center py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurer
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(conv.id)}
                        className="flex items-center gap-1 flex-1 justify-center py-1.5 rounded-lg bg-destructive/10 text-destructive text-[11px] font-medium hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-2 text-[10px] text-muted-foreground">
            Les conversations supprimées sont automatiquement vidées après 30 jours.
          </div>
        </Section>

        {/* Technique */}
        <Section icon={<Wrench className="w-4 h-4" />} title={
          <span className="flex items-center gap-2">
            Technique
            {updateAvailable && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
              </span>
            )}
          </span>
        }>
          <Row label={
            <span className="flex items-center gap-2">
              Mise à jour
              {updateAvailable && (
                <span className="text-[10px] font-bold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full animate-pulse">
                  ⚠️ Nouvelle version
                </span>
              )}
            </span>
          }>
            {updateAvailable ? (
              <button
                onClick={() => { applyUpdate(); toast.success("Mise à jour en cours..."); }}
                className="flex items-center gap-1.5 text-xs bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg font-medium animate-pulse"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Installer
              </button>
            ) : (
              <button
                onClick={async () => {
                  const hasUpdate = await checkForUpdate();
                  if (hasUpdate) {
                    toast.success("Nouvelle version disponible !");
                  } else {
                    toast.info("Vous êtes à jour ✓");
                  }
                }}
                disabled={checking}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {checking ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                {checking ? "Vérification..." : "Vérifier"}
              </button>
            )}
          </Row>
          <Row label="Modèle IA">
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value as any)}
              className="bg-muted text-foreground text-xs px-2 py-1 rounded-lg border border-border outline-none"
            >
              {Object.entries(MODEL_LABELS).map(([value, { label, pro }]) => (
                <option key={value} value={value}>
                  {label}{pro ? " ⚡ Pro" : ""}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Effacer le cache">
            <button onClick={async () => {
              if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
              }
              const authKeys: string[] = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
                  authKeys.push(key);
                }
              }
              const saved = authKeys.map(k => [k, localStorage.getItem(k)!]);
              localStorage.clear();
              saved.forEach(([k, v]) => localStorage.setItem(k, v));
              toast.success("Cache vidé ! L'app sera plus rapide.");
              window.location.reload();
            }} className="text-xs text-primary hover:underline">Effacer</button>
          </Row>
        </Section>

        {/* Support & Aide */}
        <Section icon={<Info className="w-4 h-4" />} title="Support & Aide">
          <Row label="Contacter le support" onClick={() => window.open("mailto:ifaqideas@gmail.com")}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-primary font-medium">Envoyer un email</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Row>
          <Row label="Mentions légales" onClick={() => window.location.href = "/legal"}>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Row>
          <Row label="Politique de confidentialité" onClick={() => window.location.href = "/privacy"}>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Row>
        </Section>

        {/* À propos */}
        <Section icon={<Zap className="w-4 h-4" />} title="À propos">
          <Row label="Version" value="v2.0.0" />
          <Row label="Développeur" value="Marvens Zamy" />
          <Row label="Moteur" value="Marv-IA Omni-Protocol v2.0.0" />
        </Section>
      </div>
    </div>
  );
}
