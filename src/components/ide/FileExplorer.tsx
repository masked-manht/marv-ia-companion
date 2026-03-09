import React from "react";
import { ChevronRight, FileCode, FileText, Palette, FolderOpen, Folder } from "lucide-react";

export interface FileEntry {
  id: string;
  name: string;
  language: string;
  type: "file";
}

export interface FolderEntry {
  name: string;
  type: "folder";
  children: (FileEntry | FolderEntry)[];
  open?: boolean;
}

interface FileExplorerProps {
  files: FileEntry[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

const LANG_ICONS: Record<string, React.ReactNode> = {
  html: <FileCode className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />,
  css: <Palette className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
  javascript: <FileText className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />,
  typescript: <FileText className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />,
  python: <FileText className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />,
};

export default function FileExplorer({ files, activeId, onSelect, onAdd }: FileExplorerProps) {
  const [projectOpen, setProjectOpen] = React.useState(true);

  return (
    <div className="h-full flex flex-col bg-[#0D1117] text-[11px] select-none">
      {/* Explorer header */}
      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#4A5568] flex items-center justify-between flex-shrink-0">
        <span>Explorateur</span>
        <button
          onClick={onAdd}
          className="text-[#4A5568] hover:text-[#E2E8F0] transition-colors text-sm leading-none"
          title="Nouveau fichier"
        >
          +
        </button>
      </div>

      {/* Project folder */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <button
          onClick={() => setProjectOpen(!projectOpen)}
          className="w-full flex items-center gap-1 px-2 py-1 hover:bg-[#1A1F2E] transition-colors text-[#A0AEC0] font-semibold"
        >
          <ChevronRight className={`w-3 h-3 transition-transform flex-shrink-0 ${projectOpen ? "rotate-90" : ""}`} />
          {projectOpen ? <FolderOpen className="w-3.5 h-3.5 text-[#007BFF] flex-shrink-0" /> : <Folder className="w-3.5 h-3.5 text-[#007BFF] flex-shrink-0" />}
          <span className="truncate">MARV-IA PROJECT</span>
        </button>

        {projectOpen && (
          <div className="ml-2">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => onSelect(file.id)}
                className={`w-full flex items-center gap-1.5 px-3 py-[3px] transition-colors truncate ${
                  activeId === file.id
                    ? "bg-[#007BFF]/15 text-[#E2E8F0]"
                    : "text-[#8B949E] hover:bg-[#1A1F2E] hover:text-[#C9D1D9]"
                }`}
              >
                {LANG_ICONS[file.language] || <FileText className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
