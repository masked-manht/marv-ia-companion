import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { getDeletedConversations, restoreConversation, permanentlyDeleteConversation } from "@/lib/marvia-api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface TrashViewProps {
  onBack: () => void;
  onRestored: () => void;
}

export default function TrashView({ onBack, onRestored }: TrashViewProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await getDeletedConversations(user.id);
    setConversations(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (id: string) => {
    const error = await restoreConversation(id);
    if (error) { toast.error("Erreur de restauration"); return; }
    toast.success("Conversation restaurée !");
    load();
    onRestored();
  };

  const handlePermanentDelete = async (id: string) => {
    const error = await permanentlyDeleteConversation(id);
    if (error) { toast.error("Erreur de suppression"); return; }
    toast.success("Supprimée définitivement");
    setConfirmDeleteId(null);
    load();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border flex-shrink-0">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Trash2 className="w-5 h-5 text-destructive" />
          <p className="text-sm font-semibold text-foreground">Corbeille</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-2">
        {loading && (
          <p className="text-center text-muted-foreground text-sm py-8">Chargement...</p>
        )}
        {!loading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 opacity-60">
            <Trash2 className="w-12 h-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">La corbeille est vide</p>
          </div>
        )}
        {conversations.map(conv => (
          <div key={conv.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{conv.title}</p>
                <p className="text-xs text-muted-foreground">
                  Supprimée le {formatDate(conv.deleted_at)}
                </p>
              </div>
              {conv.is_pro && (
                <span className="text-[10px] font-bold bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-full flex-shrink-0">PRO</span>
              )}
            </div>
            
            {confirmDeleteId === conv.id ? (
              <div className="flex items-center gap-2 bg-destructive/10 rounded-lg p-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive flex-1">Supprimer définitivement ?</p>
                <button
                  onClick={() => handlePermanentDelete(conv.id)}
                  className="text-xs font-bold text-destructive-foreground bg-destructive px-2.5 py-1 rounded-lg"
                >
                  Oui
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-xs text-muted-foreground px-2 py-1"
                >
                  Non
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleRestore(conv.id)}
                  className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurer
                </button>
                <button
                  onClick={() => setConfirmDeleteId(conv.id)}
                  className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
