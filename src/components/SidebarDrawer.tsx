import React, { useState } from "react";
import { MessageSquarePlus, Trash2, Settings, Sparkles, Search, X } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  is_pro: boolean;
}

type FilterTab = "all" | "standard" | "pro";

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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = conversations
    .filter(c => {
      if (filter === "pro") return c.is_pro;
      if (filter === "standard") return !c.is_pro;
      return true;
    })
    .filter(c => !search.trim() || c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
      
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

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 pt-2">
          {([["all", "Tout"], ["standard", "Standard"], ["pro", "⚡ Pro"]] as [FilterTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${filter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">
              {search ? "Aucun résultat" : "Aucune conversation"}
            </p>
          )}
          {filtered.map(conv => (
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
