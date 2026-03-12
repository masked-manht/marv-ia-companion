import React, { useRef, useEffect, useState } from "react";
import { Trash2, AlertCircle, Info, AlertTriangle, Terminal as TermIcon, ChevronRight } from "lucide-react";

export type ConsoleMessage = {
  type: "log" | "error" | "warn" | "info";
  text: string;
  time: string;
};

interface ConsolePanelProps {
  messages: ConsoleMessage[];
  onClear: () => void;
  onCommand?: (cmd: string) => void;
  ideTheme?: "dark" | "light";
}

const TYPE_STYLES: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  log: { color: "text-[#E2E8F0]", icon: <TermIcon className="w-3 h-3" />, bg: "" },
  error: { color: "text-red-400", icon: <AlertCircle className="w-3 h-3" />, bg: "bg-red-500/5 border-l-2 border-l-red-500/40" },
  warn: { color: "text-yellow-400", icon: <AlertTriangle className="w-3 h-3" />, bg: "bg-yellow-500/5 border-l-2 border-l-yellow-500/40" },
  info: { color: "text-blue-400", icon: <Info className="w-3 h-3" />, bg: "bg-blue-500/5 border-l-2 border-l-blue-500/30" },
};

export default function ConsolePanel({ messages, onClear, onCommand, ideTheme = "dark" }: ConsolePanelProps) {
  const isDark = ideTheme === "dark";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setHistory(prev => [trimmed, ...prev].slice(0, 50));
    setHistoryIdx(-1);
    onCommand?.(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = Math.min(historyIdx + 1, history.length - 1);
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      } else {
        setHistoryIdx(-1);
        setInput("");
      }
    }
  };

  return (
    <div className={`flex flex-col h-full font-mono text-xs ${isDark ? "bg-[#0A0E14]" : "bg-[#FAFBFC]"}`}>
      {/* Console header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1E2433] bg-[#0D1117] flex-shrink-0">
        <div className="flex items-center gap-2">
          <TermIcon className="w-3.5 h-3.5 text-[#007BFF]" />
          <span className="text-[10px] font-semibold text-[#4A5568] uppercase tracking-[0.12em]">Terminal</span>
          {messages.length > 0 && (
            <span className="bg-[#007BFF]/15 text-[#007BFF] text-[9px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
              {messages.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClear}
            className="text-[#4A5568] hover:text-[#E2E8F0] transition-colors p-1 rounded hover:bg-[#1A1F2E]"
            title="Effacer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Console messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-3 text-[#4A5568]">
            <ChevronRight className="w-3 h-3" />
            <span className="text-[11px]">Terminal prêt. Tapez une commande ou exécutez du code.</span>
          </div>
        )}
        {messages.map((msg, i) => {
          const style = TYPE_STYLES[msg.type] || TYPE_STYLES.log;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-[3px] ${style.bg} hover:bg-[#1A1F2E]/30 transition-colors`}
            >
              <span className="text-[9px] text-[#3D4450] flex-shrink-0 mt-0.5 w-12 font-mono">{msg.time}</span>
              <span className={`flex-shrink-0 mt-0.5 ${style.color} opacity-60`}>{style.icon}</span>
              <pre className={`flex-1 whitespace-pre-wrap break-all ${style.color} leading-relaxed text-[11px]`}>
                {msg.text}
              </pre>
            </div>
          );
        })}
      </div>

      {/* Command input */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[#1E2433] bg-[#0D1117] flex-shrink-0">
        <ChevronRight className="w-3 h-3 text-[#007BFF] flex-shrink-0" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tapez une commande..."
          className="flex-1 bg-transparent text-[#E2E8F0] placeholder:text-[#3D4450] outline-none text-[11px] font-mono"
        />
      </div>
    </div>
  );
}
