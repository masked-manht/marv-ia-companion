import React, { useRef, useEffect } from "react";
import { Trash2, AlertCircle, Info, AlertTriangle, Terminal as TermIcon } from "lucide-react";

export type ConsoleMessage = {
  type: "log" | "error" | "warn" | "info";
  text: string;
  time: string;
};

interface ConsolePanelProps {
  messages: ConsoleMessage[];
  onClear: () => void;
}

const TYPE_STYLES: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  log: { color: "text-[#E2E8F0]", icon: <TermIcon className="w-3 h-3" />, bg: "" },
  error: { color: "text-red-400", icon: <AlertCircle className="w-3 h-3" />, bg: "bg-red-500/5" },
  warn: { color: "text-yellow-400", icon: <AlertTriangle className="w-3 h-3" />, bg: "bg-yellow-500/5" },
  info: { color: "text-blue-400", icon: <Info className="w-3 h-3" />, bg: "bg-blue-500/5" },
};

export default function ConsolePanel({ messages, onClear }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[#0A0E14] font-mono text-xs">
      {/* Console header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1E2433] bg-[#0D1117] flex-shrink-0">
        <div className="flex items-center gap-2">
          <TermIcon className="w-3.5 h-3.5 text-[#007BFF]" />
          <span className="text-[11px] font-semibold text-[#4A5568] uppercase tracking-wider">Console</span>
          {messages.length > 0 && (
            <span className="bg-[#007BFF]/15 text-[#007BFF] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {messages.length}
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-[#4A5568] hover:text-[#E2E8F0] transition-colors p-0.5"
          title="Effacer la console"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Console messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[#4A5568]">
            <span className="text-[11px]">Console prête. Les logs s'afficheront ici.</span>
          </div>
        )}
        {messages.map((msg, i) => {
          const style = TYPE_STYLES[msg.type] || TYPE_STYLES.log;
          return (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-1 border-b border-[#1E2433]/50 ${style.bg} hover:bg-[#1A1F2E]/50`}
            >
              <span className="text-[10px] text-[#4A5568] flex-shrink-0 mt-0.5 w-14">{msg.time}</span>
              <span className={`flex-shrink-0 mt-0.5 ${style.color}`}>{style.icon}</span>
              <pre className={`flex-1 whitespace-pre-wrap break-all ${style.color} leading-relaxed`}>
                {msg.text}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
