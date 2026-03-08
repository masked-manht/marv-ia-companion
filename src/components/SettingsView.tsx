import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, User, Palette, Volume2, Wrench, Info, Moon, Sun, Monitor, Zap, Crown, Bell, RefreshCw, CheckCircle, Code2, Trash2, RotateCcw, AlertTriangle, ChevronRight, Brain, X } from "lucide-react";
import { useSettings, ACCENT_OPTIONS, type AccentColor } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { Switch } from "@/components/ui/switch";
import { isProModel } from "@/hooks/useCredits";
import { getDeletedConversations, restoreConversation, permanentlyDeleteConversation, getUserMemories, deleteMemory, clearAllMemories } from "@/lib/marvia-api";
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

export default function SettingsView({ onBack, credits, onConversationsChanged }: SettingsViewProps) {
  const { theme, setTheme, responseStyle, setResponseStyle, voiceEnabled, setVoiceEnabled, voiceTone, setVoiceTone, aiModel, setAiModel, accentColor, setAccentColor, ideMode, setIdeMode } = useSettings();
  const { user, signOut } = useAuth();
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

  const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
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

  const Row: React.FC<{ label: string; value?: string; children?: React.ReactNode; onClick?: () => void }> = ({ label, value, children, onClick }) => (
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
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
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
          <div className="px-4 py-2 text-xs text-muted-foreground">
            <p>Éditeur de code intégré avec prévisualisation en direct, console et assistant IA.</p>
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
                      <p className="text-[10px] text-destructive flex-1">Supprimer définitivement ? (textes, images, code...)</p>
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
        <Section icon={<Wrench className="w-4 h-4" />} title="Technique">
          <Row label="Mise à jour">
            {updateAvailable ? (
              <button
                onClick={() => { applyUpdate(); toast.success("Mise à jour en cours..."); }}
                className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium animate-pulse"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Installer la mise à jour
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
                {checking ? "Vérification..." : "Vérifier les mises à jour"}
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
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-xs text-primary hover:underline">Effacer</button>
          </Row>
        </Section>

        {/* Infos */}
        <Section icon={<Info className="w-4 h-4" />} title="Infos">
          <Row label="Version" value="v1.1.0" />
          <Row label="Développeur" value="Marvens Zamy" />
          <Row label="Moteur" value="Marv-IA Omni-Protocol v2" />
        </Section>
      </div>
    </div>
  );
}
