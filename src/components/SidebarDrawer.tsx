import React from "react";
import { MessageSquarePlus, Trash2, Settings, Sparkles } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export default function SidebarDrawer({ open, onClose, conversations, activeId, onSelect, onNew, onDelete, onOpenSettings }: SidebarDrawerProps) {
  return (
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
      
      {/* Drawer */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-card border-r border-border z-50 transform transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">Marv-IA</span>
          </div>
          <button onClick={onNew} className="p-2 text-primary hover:bg-muted rounded-lg transition-colors" title="Nouvelle conversation">
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
          {conversations.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Aucune conversation</p>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => { onSelect(conv.id); onClose(); }}
              className={`flex items-center justify-between px-4 py-3 mx-2 rounded-lg cursor-pointer transition-colors group ${activeId === conv.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"}`}
            >
              <span className="text-sm text-foreground truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-border p-3">
          <button onClick={() => { onOpenSettings(); onClose(); }} className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
            <span className="text-sm">Paramètres</span>
          </button>
        </div>
      </div>
    </>
  );
}
