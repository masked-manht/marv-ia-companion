import React, { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, Play, Eye, Code2, Terminal, Sparkles, Send, Mic, StopCircle, Download, RotateCcw, MessageSquare, X, ChevronUp } from "lucide-react";
import CodeEditor from "./CodeEditor";
import LivePreview from "./LivePreview";
import ConsolePanel, { type ConsoleMessage } from "./ConsolePanel";
import FileTabs, { type FileTab } from "./FileTabs";
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

// Mobile tabs for switching between editor/preview/console/chat
type MobileTab = "editor" | "preview" | "console" | "chat";

interface IDEViewProps {
  onBack: () => void;
}

export default function IDEView({ onBack }: IDEViewProps) {
  const { aiModel, responseStyle } = useSettings();
  const { startListening } = useVoice();
  
  const [files, setFiles] = useState<FileTab[]>(DEFAULT_FILES);
  const [activeFileId, setActiveFileId] = useState("html");
  
  // Mobile: single active tab; Desktop: split view
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];
  const htmlFile = files.find(f => f.language === "html");
  const cssFile = files.find(f => f.language === "css");
  const jsFile = files.find(f => f.language === "javascript");
  const pyFile = files.find(f => f.language === "python");
  const isPythonActive = activeFile.language === "python";

  const updateFileContent = useCallback((content: string) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content } : f));
  }, [activeFileId]);

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
    } else if (lang === "html" || (code.includes("<") && code.includes(">") && (code.includes("<div") || code.includes("<h1") || code.includes("<p") || code.includes("<!") || code.includes("<section")))) {
      targetFile = htmlFile || activeFile;
    } else if (lang === "css" || (code.includes("{") && (code.includes("color:") || code.includes("display:") || code.includes("background") || code.includes("font-")))) {
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
    setMobileTab("console");
    toast.success("Python exécuté !");
  }, [files]);

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
      content: `Tu es Marv-IA, un assistant développeur expert intégré dans un IDE. Tu aides l'utilisateur à coder en HTML, CSS, JavaScript, React et Python.

RÈGLES :
- Quand tu génères du code, mets-le dans des blocs \`\`\`html, \`\`\`css, \`\`\`javascript, ou \`\`\`python
- Sois concis et direct
- Explique brièvement tes choix
- Si l'utilisateur demande de modifier le code, base-toi sur le code actuel fourni en contexte
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

  const handleExport = () => {
    const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Marv-IA Export</title>
<style>
${cssFile?.content || ""}
</style>
</head>
<body>
${htmlFile?.content || ""}
<script>
${jsFile?.content || ""}
<\/script>
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marvia-project.html";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Projet exporté !");
  };

  // --- Chat Panel (reusable for both desktop sidebar & mobile fullscreen) ---
  const ChatPanel = ({ className = "" }: { className?: string }) => (
    <div className={`flex flex-col ${className}`}>
      <div className="px-3 py-2.5 border-b border-[#1E2433] flex items-center gap-2 flex-shrink-0">
        <Sparkles className="w-4 h-4 text-[#007BFF]" />
        <span className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider flex-1">Assistant IA</span>
      </div>

      <div ref={chatScrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-3">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-2 py-8">
            <Sparkles className="w-8 h-8 text-[#007BFF]" />
            <p className="text-xs text-[#4A5568] text-center px-4">Demandez à Marv-IA de générer ou modifier votre code</p>
          </div>
        )}
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`${msg.role === "user" ? "ml-4" : "mr-2"}`}>
            <div className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
              msg.role === "user"
                ? "bg-[#007BFF] text-white rounded-br-sm"
                : "bg-[#1A1F2E] text-[#E2E8F0] rounded-bl-sm border border-[#1E2433]"
            }`}>
              <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-1 [&_pre]:my-1 [&_code]:text-[11px]">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {msg.role === "assistant" && extractCodeBlocks(msg.content).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#1E2433]">
                  {extractCodeBlocks(msg.content).map((block, i) => (
                    <button
                      key={i}
                      onClick={() => handleInjectCode(block.code, block.lang)}
                      className="flex items-center gap-1 text-[10px] bg-[#007BFF]/15 text-[#007BFF] px-2 py-1 rounded-md hover:bg-[#007BFF]/25 transition-colors font-medium"
                    >
                      <Code2 className="w-2.5 h-2.5" />
                      Injecter {block.lang}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && chatMessages[chatMessages.length - 1]?.role === "user" && (
          <div className="mr-2">
            <div className="bg-[#1A1F2E] rounded-2xl rounded-bl-sm px-3 py-2.5 border border-[#1E2433] inline-block">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0s" }} />
                <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.2s" }} />
                <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.4s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[#1E2433] flex-shrink-0">
        <div className="flex items-end gap-1.5 bg-[#1A1F2E] rounded-xl px-3 py-2 border border-[#1E2433]">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
            onFocus={(e) => {
              setTimeout(() => {
                e.target.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 300);
            }}
            placeholder="Demandez du code..."
            rows={1}
            className="flex-1 bg-transparent text-[#E2E8F0] placeholder:text-[#4A5568] resize-none outline-none text-[13px] max-h-20 py-0.5"
            style={{ minHeight: "20px" }}
          />
          <button onClick={handleVoice} className={`flex-shrink-0 transition-colors ${isListening ? "text-red-400" : "text-[#4A5568] hover:text-[#007BFF]"}`}>
            {isListening ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={sendChat}
            disabled={isLoading || !chatInput.trim()}
            className="flex-shrink-0 w-7 h-7 bg-[#007BFF] text-white rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen" style={{ background: "#0A0E14" }}>
      {/* === Header === */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1E2433] bg-[#0D1117] flex-shrink-0">
        <button onClick={onBack} className="text-[#007BFF] hover:opacity-80 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Code2 className="w-4 h-4 text-[#007BFF] flex-shrink-0" />
          <span className="text-sm font-bold text-[#E2E8F0] truncate">Marv-IA</span>
          <span className="text-[9px] bg-[#007BFF]/15 text-[#007BFF] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider flex-shrink-0">IDE</span>
        </div>
        <div className="flex items-center gap-0.5">
          {isPythonActive && (
            <button onClick={handleRunPython} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-[#39FF14]/15 text-[#39FF14] rounded-md hover:bg-[#39FF14]/25 transition-colors">
              <Play className="w-3 h-3" />
              Run
            </button>
          )}
          <button onClick={handleExport} className="p-1.5 text-[#4A5568] hover:text-[#007BFF] transition-colors" title="Exporter">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => setFiles(DEFAULT_FILES)} className="p-1.5 text-[#4A5568] hover:text-[#E2E8F0] transition-colors" title="Réinitialiser">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* === DESKTOP LAYOUT (hidden on mobile) === */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Desktop Chat Sidebar */}
        <ChatPanel className="w-72 lg:w-80 flex-shrink-0 border-r border-[#1E2433] bg-[#0D1117]" />

        {/* Desktop Editor + Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <FileTabs files={files} activeId={activeFileId} onSelect={setActiveFileId} onClose={handleCloseFile} onAdd={handleAddFile} />
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <CodeEditor value={activeFile.content} onChange={updateFileContent} language={activeFile.language} />
            </div>
            <div className="w-[45%] flex-shrink-0 flex flex-col border-l border-[#1E2433]">
              <div className="flex items-center border-b border-[#1E2433] bg-[#0D1117] flex-shrink-0">
                <button onClick={() => setMobileTab("preview")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${mobileTab !== "console" ? "text-[#007BFF] border-b-2 border-[#007BFF]" : "text-[#4A5568] hover:text-[#A0AEC0]"}`}>
                  <Eye className="w-3.5 h-3.5" /> Aperçu
                </button>
                <button onClick={() => setMobileTab("console")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${mobileTab === "console" ? "text-[#007BFF] border-b-2 border-[#007BFF]" : "text-[#4A5568] hover:text-[#A0AEC0]"}`}>
                  <Terminal className="w-3.5 h-3.5" /> Console
                  {consoleMessages.length > 0 && <span className="bg-[#007BFF]/15 text-[#007BFF] text-[10px] px-1.5 py-0.5 rounded-full font-bold">{consoleMessages.length}</span>}
                </button>
                <div className="flex-1" />
                <button onClick={() => setFiles(prev => [...prev])} className="px-2 py-2 text-[#4A5568] hover:text-[#39FF14] transition-colors" title="Relancer">
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {mobileTab === "console" ? (
                  <ConsolePanel messages={consoleMessages} onClear={() => setConsoleMessages([])} />
                ) : (
                  <LivePreview html={htmlFile?.content || ""} css={cssFile?.content || ""} js={jsFile?.content || ""} onConsoleMessage={handleConsoleMessage} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === MOBILE LAYOUT (hidden on desktop) === */}
      <div className="flex md:hidden flex-1 flex-col overflow-hidden">
        {/* File tabs - only show when on editor tab */}
        {mobileTab === "editor" && (
          <FileTabs files={files} activeId={activeFileId} onSelect={setActiveFileId} onClose={handleCloseFile} onAdd={handleAddFile} />
        )}

        {/* Mobile content area */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === "editor" && (
            <CodeEditor value={activeFile.content} onChange={updateFileContent} language={activeFile.language} />
          )}
          {mobileTab === "preview" && (
            <LivePreview html={htmlFile?.content || ""} css={cssFile?.content || ""} js={jsFile?.content || ""} onConsoleMessage={handleConsoleMessage} />
          )}
          {mobileTab === "console" && (
            <ConsolePanel messages={consoleMessages} onClear={() => setConsoleMessages([])} />
          )}
          {mobileTab === "chat" && (
            <ChatPanel className="h-full bg-[#0D1117]" />
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <div className="flex items-center bg-[#0D1117] border-t border-[#1E2433] flex-shrink-0 safe-bottom">
          {([
            { id: "editor" as MobileTab, icon: Code2, label: "Code" },
            { id: "preview" as MobileTab, icon: Eye, label: "Aperçu" },
            { id: "console" as MobileTab, icon: Terminal, label: "Console", badge: consoleMessages.length || undefined },
            { id: "chat" as MobileTab, icon: MessageSquare, label: "IA", dot: chatMessages.length > 0 },
          ]).map(({ id, icon: Icon, label, badge, dot }) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${
                mobileTab === id ? "text-[#007BFF]" : "text-[#4A5568]"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge && badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#007BFF] text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">
                    {badge > 99 ? "+" : badge}
                  </span>
                )}
                {dot && !badge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#007BFF] rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
              {mobileTab === id && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#007BFF] rounded-full" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
