import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft, Play, Eye, Code2, Terminal, Sparkles, Send, Mic, StopCircle,
  Download, RotateCcw, MessageSquare, Files, Search, Settings,
  PanelBottomOpen, PanelBottomClose, ChevronRight, Copy, RefreshCw,
  FolderOpen, X, Plus, Maximize2, Minimize2, Globe, Zap
} from "lucide-react";
import CodeEditor from "./CodeEditor";
import LivePreview from "./LivePreview";
import ConsolePanel, { type ConsoleMessage } from "./ConsolePanel";
import FileTabs, { type FileTab } from "./FileTabs";
import FileExplorer from "./FileExplorer";
import StatusBar from "./StatusBar";
import { executePython } from "./pythonSimulator";
import ReactMarkdown from "react-markdown";
import { streamChat } from "@/lib/marvia-api";
import { useSettings } from "@/contexts/SettingsContext";
import { useVoice } from "@/hooks/useVoice";
import { toast } from "sonner";

const DEFAULT_FILES: FileTab[] = [
  { id: "html", name: "index.html", language: "html", content: '<!-- Écrivez votre HTML ici -->\n<div class="container">\n  <h1>Hello Marv-IA 🚀</h1>\n  <p>Bienvenue dans le Mode IDE</p>\n  <button onclick="greet()">Cliquez-moi</button>\n</div>' },
  { id: "css", name: "style.css", language: "css", content: '/* Styles */\n.container {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  min-height: 80vh;\n  gap: 16px;\n  font-family: system-ui, sans-serif;\n}\n\nh1 {\n  font-size: 2rem;\n  background: linear-gradient(135deg, #007BFF, #39FF14);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\n\nbutton {\n  padding: 10px 24px;\n  background: #007BFF;\n  color: white;\n  border: none;\n  border-radius: 8px;\n  font-size: 1rem;\n  cursor: pointer;\n  transition: transform 0.2s;\n}\n\nbutton:hover {\n  transform: scale(1.05);\n}' },
  { id: "js", name: "script.js", language: "javascript", content: '// JavaScript\nfunction greet() {\n  console.log("Bonjour depuis Marv-IA IDE ! 🎉");\n  document.querySelector("h1").textContent = "Ça marche !";\n}' },
  { id: "py", name: "main.py", language: "python", content: '# Python - Simulateur Marv-IA\n\nnom = "Marv-IA"\nversion = 2.0\nactif = True\n\nprint(f"Bienvenue dans {nom} v{version}")\nprint(f"Statut: {actif}")\n\nfor i in range(5):\n    if i % 2 == 0:\n        print(f"{i} est pair")\n    else:\n        print(f"{i} est impair")\n\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    a = 0\n    b = 1\n    for i in range(2, n + 1):\n        temp = a + b\n        a = b\n        b = temp\n    return b\n\nprint(f"Fibonacci(10) = {fibonacci(10)}")\n\nfruits = ["pomme", "banane", "orange"]\nfruits.append("kiwi")\nprint(f"Fruits: {fruits}")\nprint(f"Nombre: {len(fruits)}")\n' },
];

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

// Activity bar items
type ActivityItem = "explorer" | "search" | "ai" | "none";
// Bottom panel
type BottomPanel = "terminal" | "preview" | "none";
// Mobile tabs
type MobileTab = "editor" | "preview" | "terminal" | "ai";

interface IDEViewProps {
  onBack: () => void;
}

export default function IDEView({ onBack }: IDEViewProps) {
  const { aiModel, responseStyle, ideAutoSave, ideTheme } = useSettings();
  const isDark = ideTheme === "dark";
  const { startListening } = useVoice();

  const [files, setFiles] = useState<FileTab[]>(() => {
    const saved = localStorage.getItem("marvia-ide-files");
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return DEFAULT_FILES;
  });
  const [activeFileId, setActiveFileId] = useState("html");

  // Desktop panels
  const [activityPanel, setActivityPanel] = useState<ActivityItem>("explorer");
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>("terminal");
  const [bottomPanelHeight, setBottomPanelHeight] = useState(35); // percentage
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [showPreviewSplit, setShowPreviewSplit] = useState(true);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  // Mobile
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);

  // Console
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save status
  const [lastSaved, setLastSaved] = useState<string>("");

  const activeFile = files.find(f => f.id === activeFileId) || files[0];
  const htmlFile = files.find(f => f.language === "html");
  const cssFile = files.find(f => f.language === "css");
  const jsFile = files.find(f => f.language === "javascript");
  const pyFile = files.find(f => f.language === "python");
  const isPythonActive = activeFile.language === "python";

  const updateFileContent = useCallback((content: string) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content, modified: true } : f));
  }, [activeFileId]);

  // Auto-save
  useEffect(() => {
    if (!ideAutoSave) return;
    const interval = setInterval(() => {
      localStorage.setItem("marvia-ide-files", JSON.stringify(files));
      setFiles(prev => prev.map(f => ({ ...f, modified: false })));
      setLastSaved(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    }, 5000);
    return () => clearInterval(interval);
  }, [files, ideAutoSave]);

  const handleConsoleMessage = useCallback((msg: ConsoleMessage) => {
    setConsoleMessages(prev => [...prev.slice(-200), msg]);
  }, []);

  const handleAddFile = () => {
    const id = crypto.randomUUID();
    const newFile: FileTab = { id, name: `fichier-${files.length + 1}.js`, language: "javascript", content: "// Nouveau fichier\n" };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(id);
  };

  const handleCloseFile = (id: string) => {
    if (files.length <= 1) return;
    setFiles(prev => prev.filter(f => f.id !== id));
    if (activeFileId === id) setActiveFileId(files[0].id === id ? files[1].id : files[0].id);
  };

  const handleInjectCode = (code: string, lang?: string) => {
    let targetFile = activeFile;
    if (lang === "python" || (code.includes("def ") && code.includes("print("))) {
      targetFile = pyFile || activeFile;
    } else if (lang === "html" || (code.includes("<") && code.includes(">") && (code.includes("<div") || code.includes("<h1")))) {
      targetFile = htmlFile || activeFile;
    } else if (lang === "css" || (code.includes("{") && (code.includes("color:") || code.includes("display:")))) {
      targetFile = cssFile || activeFile;
    } else {
      targetFile = jsFile || activeFile;
    }
    setFiles(prev => prev.map(f => f.id === targetFile.id ? { ...f, content: code } : f));
    setActiveFileId(targetFile.id);
    setMobileTab("editor");
    toast.success(`Code injecté dans ${targetFile.name}`);
  };

  const handleRunPython = useCallback(() => {
    const pythonFile = files.find(f => f.language === "python");
    if (!pythonFile) { toast.error("Aucun fichier Python trouvé"); return; }
    const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const results = executePython(pythonFile.content);
    const newMessages: ConsoleMessage[] = results.map(r => ({ type: r.type, text: r.text, time: now() }));
    setConsoleMessages(prev => [...prev, ...newMessages]);
    setBottomPanel("terminal");
    setMobileTab("terminal");
    toast.success("Python exécuté !");
  }, [files]);

  const handleTerminalCommand = useCallback((cmd: string) => {
    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setConsoleMessages(prev => [...prev, { type: "info", text: `$ ${cmd}`, time: now }]);

    // Simulate common commands
    const lower = cmd.toLowerCase().trim();
    if (lower === "clear" || lower === "cls") {
      setConsoleMessages([]);
      return;
    }
    if (lower === "help") {
      const helpLines = [
        "Commandes disponibles :",
        "  clear/cls     - Effacer le terminal",
        "  ls/dir        - Lister les fichiers",
        "  cat <fichier> - Afficher le contenu",
        "  run           - Exécuter le Python",
        "  export        - Exporter le projet",
        "  date          - Date et heure",
        "  echo <text>   - Afficher du texte",
        "  version       - Version de l'IDE",
      ];
      helpLines.forEach(l => setConsoleMessages(prev => [...prev, { type: "log", text: l, time: now }]));
      return;
    }
    if (lower === "ls" || lower === "dir") {
      files.forEach(f => setConsoleMessages(prev => [...prev, { type: "log", text: `  📄 ${f.name}`, time: now }]));
      return;
    }
    if (lower.startsWith("cat ")) {
      const fname = cmd.slice(4).trim();
      const file = files.find(f => f.name === fname);
      if (file) {
        setConsoleMessages(prev => [...prev, { type: "log", text: file.content, time: now }]);
      } else {
        setConsoleMessages(prev => [...prev, { type: "error", text: `Fichier '${fname}' introuvable`, time: now }]);
      }
      return;
    }
    if (lower === "run" || lower === "python main.py") {
      handleRunPython();
      return;
    }
    if (lower === "export") {
      handleExport();
      return;
    }
    if (lower === "date") {
      setConsoleMessages(prev => [...prev, { type: "log", text: new Date().toLocaleString("fr-FR"), time: now }]);
      return;
    }
    if (lower.startsWith("echo ")) {
      setConsoleMessages(prev => [...prev, { type: "log", text: cmd.slice(5), time: now }]);
      return;
    }
    if (lower === "version") {
      setConsoleMessages(prev => [...prev, { type: "info", text: "Marv-IA IDE v3.0 — Terminal Intégré", time: now }]);
      return;
    }
    // Try JS eval
    try {
      const result = new Function(`return (${cmd})`)();
      setConsoleMessages(prev => [...prev, { type: "log", text: String(result), time: now }]);
    } catch {
      setConsoleMessages(prev => [...prev, { type: "error", text: `Commande inconnue: ${cmd}. Tapez 'help' pour l'aide.`, time: now }]);
    }
  }, [files, handleRunPython]);

  const handleExport = () => {
    const fullHtml = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Marv-IA Export</title>\n<style>\n${cssFile?.content || ""}\n</style>\n</head>\n<body>\n${htmlFile?.content || ""}\n<script>\n${jsFile?.content || ""}\n<\/script>\n</body>\n</html>`;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marvia-project.html";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Projet exporté !");
  };

  // Keyboard handling for mobile
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (chatInputRef.current && document.activeElement === chatInputRef.current) {
        requestAnimationFrame(() => {
          chatInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const handleVoice = () => {
    if (isListening) { stopListeningRef.current?.(); setIsListening(false); return; }
    setIsListening(true);
    stopListeningRef.current = startListening(
      (text) => setChatInput(prev => prev + text),
      () => setIsListening(false)
    );
  };

  const sendChat = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsLoading(true);

    const codeContext = files.map(f => `--- ${f.name} ---\n${f.content}`).join("\n\n");
    
    let stylePrefix = "";
    if (responseStyle === "precise") stylePrefix = "[Réponds de manière concise] ";
    else if (responseStyle === "creative") stylePrefix = "[Réponds de manière détaillée et créative] ";

    const systemMsg = {
      role: "system" as const,
      content: `Tu es Marv-IA, un assistant développeur expert intégré dans un IDE professionnel. Tu aides l'utilisateur à coder en HTML, CSS, JavaScript, React et Python.

RÈGLES :
- Quand tu génères du code, mets-le dans des blocs \`\`\`html, \`\`\`css, \`\`\`javascript, ou \`\`\`python
- Sois concis et direct
- Explique brièvement tes choix
- Si l'utilisateur demande de modifier le code, base-toi sur le code actuel fourni en contexte
- Tu peux aussi générer des sites complets et des clones d'apps connues
- Ne dis JAMAIS "en tant qu'IA" ou similaire

CODE ACTUEL DE L'UTILISATEUR :
${codeContext}`
    };

    const apiMessages = [
      systemMsg,
      ...chatMessages.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: stylePrefix + trimmed }
    ];

    let assistantSoFar = "";
    const assistantId = crypto.randomUUID();

    await streamChat({
      messages: apiMessages as any,
      model: "google/gemini-3-flash-preview",
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantId) return prev.map(m => m.id === assistantId ? { ...m, content: assistantSoFar } : m);
          return [...prev, { id: assistantId, role: "assistant", content: assistantSoFar }];
        });
        setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" }), 50);
      },
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setIsLoading(false);
        toast.error(err);
      },
    });
  }, [chatInput, isLoading, chatMessages, files, responseStyle]);

  const extractCodeBlocks = (content: string): { lang: string; code: string }[] => {
    const blocks: { lang: string; code: string }[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      blocks.push({ lang: match[1] || "javascript", code: match[2].trim() });
    }
    return blocks;
  };

  const toggleActivity = (item: ActivityItem) => {
    setActivityPanel(prev => prev === item ? "none" : item);
  };

  // ===== RENDER HELPERS =====

  const renderActivityBar = (vertical = true) => {
    const items = [
      { id: "explorer" as ActivityItem, icon: Files, label: "Fichiers" },
      { id: "search" as ActivityItem, icon: Search, label: "Recherche" },
      { id: "ai" as ActivityItem, icon: Sparkles, label: "IA" },
    ];

    if (!vertical) return null;

    return (
      <div className="w-12 flex-shrink-0 bg-[#0B0F15] border-r border-[#1E2433] flex flex-col items-center py-1 gap-0.5">
        {items.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => toggleActivity(id)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all relative group ${
              activityPanel === id
                ? "text-[#E2E8F0] bg-[#1A1F2E]"
                : "text-[#4A5568] hover:text-[#A0AEC0]"
            }`}
            title={label}
          >
            {activityPanel === id && (
              <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007BFF] rounded-r" />
            )}
            <Icon className="w-[18px] h-[18px]" />
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => {}}
          className="w-10 h-10 flex items-center justify-center text-[#4A5568] hover:text-[#A0AEC0] transition-colors"
          title="Paramètres"
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>
    );
  };

  const renderSidePanel = () => {
    if (activityPanel === "none") return null;

    return (
      <div className="flex-shrink-0 border-r border-[#1E2433] overflow-hidden" style={{ width: sidebarWidth }}>
        {activityPanel === "explorer" && (
          <FileExplorer
            files={files.map(f => ({ id: f.id, name: f.name, language: f.language, type: "file" as const }))}
            activeId={activeFileId}
            onSelect={(id) => { setActiveFileId(id); setMobileTab("editor"); }}
            onAdd={handleAddFile}
          />
        )}
        {activityPanel === "search" && (
          <div className="h-full flex flex-col bg-[#0D1117]">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#4A5568]">Recherche</div>
            <div className="px-3">
              <div className="flex items-center bg-[#1A1F2E] rounded-md border border-[#1E2433] px-2 py-1.5">
                <Search className="w-3 h-3 text-[#4A5568] flex-shrink-0 mr-1.5" />
                <input
                  placeholder="Rechercher..."
                  className="bg-transparent text-[11px] text-[#E2E8F0] placeholder:text-[#3D4450] outline-none flex-1"
                />
              </div>
            </div>
          </div>
        )}
        {activityPanel === "ai" && renderAIPanel()}
      </div>
    );
  };

  const renderAIPanel = () => (
    <div className="flex flex-col h-full bg-[#0D1117]">
      <div className="px-3 py-2 border-b border-[#1E2433] flex items-center gap-2 flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-[#007BFF]" />
        <span className="text-[10px] font-bold text-[#4A5568] uppercase tracking-[0.12em] flex-1">Marv-IA Copilot</span>
        <div className="flex items-center gap-0.5 text-[9px] text-[#39FF14] bg-[#39FF14]/10 px-1.5 py-0.5 rounded">
          <Zap className="w-2.5 h-2.5" />
          <span>En ligne</span>
        </div>
      </div>

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-3">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3 py-8">
            <div className="w-12 h-12 rounded-xl bg-[#007BFF]/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#007BFF]" />
            </div>
            <p className="text-[11px] text-[#4A5568] text-center px-4 leading-relaxed">
              Demandez-moi de générer du code, cloner un site, ou résoudre un bug.
            </p>
            <div className="flex flex-wrap gap-1.5 px-2">
              {["Clone Google", "Page portfolio", "Todo App", "API fetch"].map(s => (
                <button
                  key={s}
                  onClick={() => setChatInput(s)}
                  className="text-[10px] px-2 py-1 rounded-md bg-[#1A1F2E] text-[#8B949E] hover:text-[#E2E8F0] hover:bg-[#252D3A] transition-colors border border-[#1E2433]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatMessages.map((msg) => (
          <div key={msg.id} className={msg.role === "user" ? "ml-6" : "mr-1"}>
            <div className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
              msg.role === "user"
                ? "bg-[#007BFF] text-white rounded-br-sm"
                : "bg-[#161B22] text-[#E2E8F0] rounded-bl-sm border border-[#1E2433]"
            }`}>
              <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-1 [&_pre]:my-1.5 [&_pre]:rounded-lg [&_pre]:bg-[#0A0E14] [&_pre]:border [&_pre]:border-[#1E2433] [&_code]:text-[10px]">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {msg.role === "assistant" && extractCodeBlocks(msg.content).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#1E2433]">
                  {extractCodeBlocks(msg.content).map((block, i) => (
                    <button
                      key={i}
                      onClick={() => handleInjectCode(block.code, block.lang)}
                      className="flex items-center gap-1 text-[10px] bg-[#007BFF]/10 text-[#007BFF] px-2 py-1 rounded-md hover:bg-[#007BFF]/20 transition-colors font-medium border border-[#007BFF]/20"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      Injecter {block.lang}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && chatMessages[chatMessages.length - 1]?.role === "user" && (
          <div className="mr-1">
            <div className="bg-[#161B22] rounded-xl rounded-bl-sm px-3 py-2.5 border border-[#1E2433] inline-flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0s" }} />
                <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.2s" }} />
                <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.4s" }} />
              </div>
              <span className="text-[10px] text-[#4A5568]">Génération...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[#1E2433] flex-shrink-0">
        <div className="flex items-end gap-1.5 bg-[#161B22] rounded-lg px-3 py-2 border border-[#1E2433]">
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
            onFocus={(e) => {
              setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
            }}
            placeholder="Demandez du code..."
            rows={1}
            className="flex-1 bg-transparent text-[#E2E8F0] placeholder:text-[#3D4450] resize-none outline-none text-[12px] max-h-20 py-0.5"
            style={{ minHeight: "20px" }}
          />
          <button onClick={handleVoice} className={`flex-shrink-0 transition-colors ${isListening ? "text-red-400" : "text-[#4A5568] hover:text-[#007BFF]"}`}>
            {isListening ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={sendChat}
            disabled={isLoading || !chatInput.trim()}
            className="flex-shrink-0 w-7 h-7 bg-[#007BFF] text-white rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-[#0069D9] transition-all"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // ===== MAIN RENDER =====
  return (
    <div className="flex flex-col h-screen select-none" style={{ background: isDark ? "#0A0E14" : "#FFFFFF" }}>
      {/* ===== HEADER BAR ===== */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 border-b flex-shrink-0 ${isDark ? "border-[#1E2433] bg-[#0D1117]" : "border-[#D0D7DE] bg-[#F6F8FA]"}`} style={{ minHeight: "38px" }}>
        <button onClick={onBack} className={`p-1 rounded ${isDark ? "text-[#4A5568] hover:text-[#E2E8F0] hover:bg-[#1A1F2E]" : "text-[#656D76] hover:text-[#24292F] hover:bg-[#E8EAED]"}`} >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 min-w-0 text-[11px]">
          <Code2 className="w-3.5 h-3.5 text-[#007BFF] flex-shrink-0" />
          <span className={isDark ? "text-[#4A5568]" : "text-[#656D76]"}>Marv-IA</span>
          <ChevronRight className={`w-3 h-3 ${isDark ? "text-[#3D4450]" : "text-[#8C959F]"}`} />
          <span className={`truncate ${isDark ? "text-[#8B949E]" : "text-[#24292F]"}`}>{activeFile.name}</span>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-0.5">
          {isPythonActive && (
            <button onClick={handleRunPython} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-[#39FF14]/10 text-[#39FF14] rounded-md hover:bg-[#39FF14]/20 transition-colors border border-[#39FF14]/20">
              <Play className="w-3 h-3" />
              Run
            </button>
          )}
          {!isPythonActive && (
            <button onClick={() => setFiles(prev => [...prev])} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-[#007BFF]/10 text-[#007BFF] rounded-md hover:bg-[#007BFF]/20 transition-colors border border-[#007BFF]/20">
              <RefreshCw className="w-3 h-3" />
              Recharger
            </button>
          )}
          <button
            onClick={() => setShowPreviewSplit(!showPreviewSplit)}
            className={`p-1.5 rounded transition-colors hidden md:flex ${showPreviewSplit ? "text-[#007BFF] bg-[#007BFF]/10" : "text-[#4A5568] hover:text-[#A0AEC0]"}`}
            title="Aperçu côte à côte"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setBottomPanel(prev => prev === "none" ? "terminal" : "none")}
            className={`p-1.5 rounded transition-colors hidden md:flex ${bottomPanel !== "none" ? "text-[#007BFF] bg-[#007BFF]/10" : "text-[#4A5568] hover:text-[#A0AEC0]"}`}
            title="Terminal"
          >
            {bottomPanel !== "none" ? <PanelBottomClose className="w-3.5 h-3.5" /> : <PanelBottomOpen className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleExport} className="p-1.5 text-[#4A5568] hover:text-[#A0AEC0] transition-colors rounded hover:bg-[#1A1F2E]" title="Exporter">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setFiles(DEFAULT_FILES); localStorage.removeItem("marvia-ide-files"); }} className="p-1.5 text-[#4A5568] hover:text-[#A0AEC0] transition-colors rounded hover:bg-[#1A1F2E]" title="Réinitialiser">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ===== DESKTOP LAYOUT ===== */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Activity Bar */}
        {renderActivityBar()}

        {/* Side Panel */}
        {renderSidePanel()}

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* File Tabs */}
          <FileTabs files={files} activeId={activeFileId} onSelect={setActiveFileId} onClose={handleCloseFile} onAdd={handleAddFile} />

          {/* Editor + Preview Split */}
          <div className="flex-1 flex overflow-hidden" style={{ height: bottomPanel !== "none" ? `${100 - bottomPanelHeight}%` : "100%" }}>
            {/* Code Editor */}
            <div className={`overflow-hidden ${showPreviewSplit ? "flex-1" : "w-full"}`}>
              <CodeEditor value={activeFile.content} onChange={updateFileContent} language={activeFile.language} ideTheme={ideTheme} />
            </div>

            {/* Preview Panel */}
            {showPreviewSplit && (
              <div className={`flex flex-col border-l border-[#1E2433] ${previewFullscreen ? "fixed inset-0 z-50 bg-[#0A0E14]" : "w-[45%] flex-shrink-0"}`}>
                <div className="flex items-center px-3 py-1 border-b border-[#1E2433] bg-[#0D1117] flex-shrink-0 gap-2">
                  <Globe className="w-3 h-3 text-[#4A5568]" />
                  <div className="flex-1 flex items-center bg-[#1A1F2E] rounded px-2 py-0.5 text-[10px] text-[#4A5568]">
                    <span className="truncate">localhost:3000/index.html</span>
                  </div>
                  <button onClick={() => setFiles(prev => [...prev])} className="text-[#4A5568] hover:text-[#A0AEC0] transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button onClick={() => setPreviewFullscreen(!previewFullscreen)} className="text-[#4A5568] hover:text-[#A0AEC0] transition-colors">
                    {previewFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LivePreview html={htmlFile?.content || ""} css={cssFile?.content || ""} js={jsFile?.content || ""} onConsoleMessage={handleConsoleMessage} />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel (Terminal) */}
          {bottomPanel !== "none" && (
            <div className="border-t border-[#1E2433]" style={{ height: `${bottomPanelHeight}%` }}>
              <ConsolePanel messages={consoleMessages} onClear={() => setConsoleMessages([])} onCommand={handleTerminalCommand} />
            </div>
          )}
        </div>
      </div>

      {/* ===== MOBILE LAYOUT ===== */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {/* Mobile file explorer overlay */}
        {mobileExplorerOpen && (
          <div className="absolute inset-0 z-40 flex" style={{ top: "38px" }}>
            <div className="w-64 bg-[#0D1117] border-r border-[#1E2433] shadow-2xl h-full">
              <FileExplorer
                files={files.map(f => ({ id: f.id, name: f.name, language: f.language, type: "file" as const }))}
                activeId={activeFileId}
                onSelect={(id) => { setActiveFileId(id); setMobileExplorerOpen(false); setMobileTab("editor"); }}
                onAdd={() => { handleAddFile(); setMobileExplorerOpen(false); }}
              />
            </div>
            <div className="flex-1 bg-black/50" onClick={() => setMobileExplorerOpen(false)} />
          </div>
        )}

        {/* Mobile file tabs - editor only */}
        {mobileTab === "editor" && (
          <FileTabs files={files} activeId={activeFileId} onSelect={setActiveFileId} onClose={handleCloseFile} onAdd={handleAddFile} />
        )}

        {/* Mobile content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "editor" && (
            <CodeEditor value={activeFile.content} onChange={updateFileContent} language={activeFile.language} />
          )}
          {mobileTab === "preview" && (
            <div className="h-full flex flex-col">
              <div className="flex items-center px-3 py-1 border-b border-[#1E2433] bg-[#0D1117] flex-shrink-0 gap-2">
                <Globe className="w-3 h-3 text-[#4A5568]" />
                <div className="flex-1 flex items-center bg-[#1A1F2E] rounded px-2 py-0.5 text-[10px] text-[#4A5568]">
                  <span className="truncate">localhost:3000</span>
                </div>
                <button onClick={() => setFiles(prev => [...prev])} className="text-[#4A5568] hover:text-[#A0AEC0] transition-colors">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LivePreview html={htmlFile?.content || ""} css={cssFile?.content || ""} js={jsFile?.content || ""} onConsoleMessage={handleConsoleMessage} />
              </div>
            </div>
          )}
          {mobileTab === "terminal" && (
            <ConsolePanel messages={consoleMessages} onClear={() => setConsoleMessages([])} onCommand={handleTerminalCommand} />
          )}
          {mobileTab === "ai" && renderAIPanel()}
        </div>

        {/* Mobile bottom tab bar — VS Code style */}
        <div className="flex items-center bg-[#0B0F15] border-t border-[#1E2433] flex-shrink-0 safe-bottom">
          {([
            { id: "editor" as MobileTab, icon: Code2, label: "Éditeur" },
            { id: "preview" as MobileTab, icon: Globe, label: "Aperçu" },
            { id: "terminal" as MobileTab, icon: Terminal, label: "Terminal", badge: consoleMessages.length || undefined },
            { id: "ai" as MobileTab, icon: Sparkles, label: "Copilot", dot: chatMessages.length > 0 },
          ]).map(({ id, icon: Icon, label, badge, dot }) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-all relative ${
                mobileTab === id ? "text-[#007BFF]" : "text-[#3D4450]"
              }`}
            >
              <div className="relative">
                <Icon className="w-[18px] h-[18px]" />
                {badge && badge > 0 && (
                  <span className="absolute -top-1 -right-2.5 bg-[#007BFF] text-white text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                    {badge > 99 ? "∞" : badge}
                  </span>
                )}
                {dot && !badge && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-[#39FF14] rounded-full" />
                )}
              </div>
              <span className="text-[9px] font-medium tracking-wide">{label}</span>
              {mobileTab === id && <span className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-[#007BFF] rounded-full" />}
            </button>
          ))}
          {/* Explorer toggle */}
          <button
            onClick={() => setMobileExplorerOpen(!mobileExplorerOpen)}
            className={`flex flex-col items-center gap-0.5 py-2 px-3 transition-all ${mobileExplorerOpen ? "text-[#007BFF]" : "text-[#3D4450]"}`}
          >
            <FolderOpen className="w-[18px] h-[18px]" />
            <span className="text-[9px] font-medium tracking-wide">Fichiers</span>
          </button>
        </div>
      </div>

      {/* ===== STATUS BAR ===== */}
      <StatusBar
        language={activeFile.language}
        fileName={activeFile.name}
        lineCount={activeFile.content.split("\n").length}
        isAutoSave={ideAutoSave}
        lastSaved={lastSaved}
      />
    </div>
  );
}
