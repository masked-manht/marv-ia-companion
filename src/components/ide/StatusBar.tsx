import React from "react";
import { GitBranch, AlertCircle, CheckCircle2 } from "lucide-react";

interface StatusBarProps {
  language: string;
  fileName: string;
  lineCount: number;
  isAutoSave: boolean;
  lastSaved?: string;
}

const LANG_LABELS: Record<string, string> = {
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
};

export default function StatusBar({ language, fileName, lineCount, isAutoSave, lastSaved }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-[2px] bg-[#007BFF] text-white text-[10px] font-medium flex-shrink-0 select-none" style={{ minHeight: "22px" }}>
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <GitBranch className="w-3 h-3" />
          <span>main</span>
        </div>
        {isAutoSave ? (
          <div className="flex items-center gap-1 opacity-80">
            <CheckCircle2 className="w-3 h-3" />
            <span>{lastSaved || "Sauvegardé"}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 opacity-80">
            <AlertCircle className="w-3 h-3" />
            <span>Non sauvegardé</span>
          </div>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <span>{lineCount} lignes</span>
        <span>UTF-8</span>
        <span className="bg-white/20 px-1.5 py-0 rounded text-[9px]">
          {LANG_LABELS[language] || language}
        </span>
      </div>
    </div>
  );
}
