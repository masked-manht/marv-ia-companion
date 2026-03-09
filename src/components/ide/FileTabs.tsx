import React from "react";
import { X, Plus, FileCode, FileText, Palette, Circle } from "lucide-react";

export type FileTab = {
  id: string;
  name: string;
  language: string;
  content: string;
  modified?: boolean;
};

interface FileTabsProps {
  files: FileTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

const LANG_ICONS: Record<string, React.ReactNode> = {
  html: <FileCode className="w-3 h-3 text-orange-400" />,
  css: <Palette className="w-3 h-3 text-blue-400" />,
  javascript: <FileText className="w-3 h-3 text-yellow-400" />,
  typescript: <FileText className="w-3 h-3 text-blue-300" />,
  python: <FileText className="w-3 h-3 text-green-400" />,
};

export default function FileTabs({ files, activeId, onSelect, onClose, onAdd }: FileTabsProps) {
  return (
    <div className="flex items-center bg-[#0D1117] border-b border-[#1E2433] overflow-x-auto scrollbar-hide flex-shrink-0" style={{ minHeight: "35px" }}>
      {files.map((file) => (
        <button
          key={file.id}
          onClick={() => onSelect(file.id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-r border-[#1E2433] transition-all whitespace-nowrap group relative ${
            activeId === file.id
              ? "bg-[#0A0E14] text-[#E2E8F0]"
              : "bg-[#0D1117] text-[#4A5568] hover:text-[#A0AEC0] hover:bg-[#1A1F2E]"
          }`}
        >
          {/* Active indicator top border */}
          {activeId === file.id && (
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-[#007BFF]" />
          )}
          {LANG_ICONS[file.language] || <FileText className="w-3 h-3" />}
          <span>{file.name}</span>
          {file.modified && (
            <Circle className="w-2 h-2 fill-[#E2E8F0] text-[#E2E8F0] ml-0.5" />
          )}
          {files.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); onClose(file.id); }}
              className={`ml-1 hover:text-red-400 transition-all ${
                activeId === file.id ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
              }`}
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2.5 py-2 text-[#4A5568] hover:text-[#007BFF] transition-colors"
        title="Nouveau fichier"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
