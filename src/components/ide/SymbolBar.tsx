import React from "react";

const SYMBOLS = ["{ }", "[ ]", "( )", "< >", "/", ";", "'", '"', "=", ":", "_", "|", ".", ",", "!", "?", "#", "@", "$", "\\"];

interface SymbolBarProps {
  onInsert: (symbol: string) => void;
  ideTheme?: "dark" | "light";
}

export default function SymbolBar({ onInsert, ideTheme = "dark" }: SymbolBarProps) {
  const isDark = ideTheme === "dark";

  return (
    <div className={`flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto scrollbar-hide border-t flex-shrink-0 ${
      isDark ? "bg-[#0D1117] border-[#1E2433]" : "bg-[#F6F8FA] border-[#D0D7DE]"
    }`}>
      {SYMBOLS.map((sym) => (
        <button
          key={sym}
          onClick={() => onInsert(sym.replace(/\s/g, ""))}
          className={`flex-shrink-0 min-w-[32px] h-8 px-1.5 rounded text-xs font-mono font-bold transition-all active:scale-90 ${
            isDark
              ? "bg-[#1A1F2E] text-[#E2E8F0] border border-[#1E2433] active:bg-[#007BFF]/30"
              : "bg-white text-[#24292F] border border-[#D0D7DE] active:bg-[#007BFF]/20"
          }`}
        >
          {sym}
        </button>
      ))}
    </div>
  );
}
