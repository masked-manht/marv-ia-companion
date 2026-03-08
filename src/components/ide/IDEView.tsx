import React, { useState, useCallback, useRef } from "react";
import { ArrowLeft, Play, Eye, Code2, Terminal, PanelLeftClose, PanelLeft, Sparkles, Send, Mic, StopCircle, Download, RotateCcw } from "lucide-react";
import CodeEditor from "./CodeEditor";
import LivePreview from "./LivePreview";
import ConsolePanel, { type ConsoleMessage } from "./ConsolePanel";
import FileTabs, { type FileTab } from "./FileTabs";
import ReactMarkdown from "react-markdown";
import { streamChat } from "@/lib/marvia-api";
import { useSettings } from "@/contexts/SettingsContext";
import { useVoice } from "@/hooks/useVoice";
import { toast } from "sonner";

const DEFAULT_FILES: FileTab[] = [
  { id: "html", name: "index.html", language: "html", content: '<!-- Écrivez votre HTML ici -->\n<div class="container">\n  <h1>Hello Marv-IA 🚀</h1>\n  <p>Bienvenue dans le Mode IDE</p>\n  <button onclick="greet()">Cliquez-moi</button>\n</div>' },
  { id: "css", name: "style.css", language: "css", content: '/* Styles */\n.container {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  min-height: 80vh;\n  gap: 16px;\n  font-family: system-ui, sans-serif;\n}\n\nh1 {\n  font-size: 2rem;\n  background: linear-gradient(135deg, #007BFF, #39FF14);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n}\n\nbutton {\n  padding: 10px 24px;\n  background: #007BFF;\n  color: white;\n  border: none;\n  border-radius: 8px;\n  font-size: 1rem;\n  cursor: pointer;\n  transition: transform 0.2s;\n}\n\nbutton:hover {\n  transform: scale(1.05);\n}' },
  { id: "js", name: "script.js", language: "javascript", content: '// JavaScript\nfunction greet() {\n  console.log("Bonjour depuis Marv-IA IDE ! 🎉");\n  document.querySelector("h1").textContent = "Ça marche !";\n}' },
];

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

interface IDEViewProps {
  onBack: () => void;
}

export default function IDEView({ onBack }: IDEViewProps) {
  const { aiModel, responseStyle } = useSettings();
  const { startListening } = useVoice();
  
  // Files state
  const [files, setFiles] = useState<FileTab[]>(DEFAULT_FILES);
  const [activeFileId, setActiveFileId] = useState("html");
  
  // Panels
  const [rightPanel, setRightPanel] = useState<"preview" | "console">("preview");
  const [chatOpen, setChatOpen] = useState(true);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  
  // Chat
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

  const handleInjectCode = (code: string) => {
    // Detect language from code content
    let targetFile = activeFile;
    if (code.includes("<") && code.includes(">") && (code.includes("<div") || code.includes("<h1") || code.includes("<p") || code.includes("<!") || code.includes("<section"))) {
      targetFile = htmlFile || activeFile;
    } else if (code.includes("{") && (code.includes("color:") || code.includes("display:") || code.includes("background") || code.includes("font-"))) {
      targetFile = cssFile || activeFile;
    } else {
      targetFile = jsFile || activeFile;
    }
    setFiles(prev => prev.map(f => f.id === targetFile.id ? { ...f, content: code } : f));
    setActiveFileId(targetFile.id);
    toast.success(`Code injecté dans ${targetFile.name}`);
  };

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

    // Build context with current code
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

  // Extract code blocks from assistant messages for injection
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
<!-- Marv-IA IDE -->
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

  return (
    <div className="flex flex-col h-screen" style={{ background: "#0A0E14" }}>
      {/* IDE Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1E2433] bg-[#0D1117] flex-shrink-0">
        <button onClick={onBack} className="text-[#007BFF] hover:opacity-80 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Code2 className="w-4 h-4 text-[#007BFF]" />
          <span className="text-sm font-bold text-[#E2E8F0]">Marv-IA</span>
          <span className="text-[10px] bg-[#007BFF]/15 text-[#007BFF] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">IDE</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="p-1.5 text-[#4A5568] hover:text-[#E2E8F0] transition-colors"
            title={chatOpen ? "Masquer le chat" : "Afficher le chat"}
          >
            {chatOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 text-[#4A5568] hover:text-[#007BFF] transition-colors"
            title="Exporter le projet"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFiles(DEFAULT_FILES)}
            className="p-1.5 text-[#4A5568] hover:text-[#E2E8F0] transition-colors"
            title="Réinitialiser"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat Panel */}
        {chatOpen && (
          <div className="w-80 flex-shrink-0 flex flex-col border-r border-[#1E2433] bg-[#0D1117]">
            {/* Chat header */}
            <div className="px-3 py-2 border-b border-[#1E2433] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#007BFF]" />
              <span className="text-xs font-semibold text-[#A0AEC0] uppercase tracking-wider">Assistant IA</span>
            </div>

            {/* Chat messages */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-2">
                  <Sparkles className="w-8 h-8 text-[#007BFF]" />
                  <p className="text-xs text-[#4A5568] text-center">Demandez à Marv-IA de générer ou modifier votre code</p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`${msg.role === "user" ? "ml-6" : "mr-2"}`}>
                  <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#007BFF] text-white rounded-br-sm"
                      : "bg-[#1A1F2E] text-[#E2E8F0] rounded-bl-sm border border-[#1E2433]"
                  }`}>
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-1 [&_pre]:my-1 [&_code]:text-[11px]">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {/* Inject button for code blocks */}
                    {msg.role === "assistant" && extractCodeBlocks(msg.content).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#1E2433]">
                        {extractCodeBlocks(msg.content).map((block, i) => (
                          <button
                            key={i}
                            onClick={() => handleInjectCode(block.code)}
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
                  <div className="bg-[#1A1F2E] rounded-xl rounded-bl-sm px-3 py-2 border border-[#1E2433] inline-block">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0s" }} />
                      <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.2s" }} />
                      <span className="w-1.5 h-1.5 bg-[#007BFF] rounded-full" style={{ animation: "typing-dot 1.4s infinite 0.4s" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <div className="p-2 border-t border-[#1E2433]">
              <div className="flex items-end gap-1.5 bg-[#1A1F2E] rounded-xl px-3 py-2 border border-[#1E2433]">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Demandez du code..."
                  rows={1}
                  className="flex-1 bg-transparent text-[#E2E8F0] placeholder:text-[#4A5568] resize-none outline-none text-xs max-h-20 py-0.5"
                  style={{ minHeight: "18px" }}
                />
                <button onClick={handleVoice} className={`flex-shrink-0 transition-colors ${isListening ? "text-red-400" : "text-[#4A5568] hover:text-[#007BFF]"}`}>
                  {isListening ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={sendChat}
                  disabled={isLoading || !chatInput.trim()}
                  className="flex-shrink-0 w-6 h-6 bg-[#007BFF] text-white rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right: Editor + Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* File Tabs */}
          <FileTabs
            files={files}
            activeId={activeFileId}
            onSelect={setActiveFileId}
            onClose={handleCloseFile}
            onAdd={handleAddFile}
          />

          {/* Editor + Preview split */}
          <div className="flex-1 flex overflow-hidden">
            {/* Code Editor */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={activeFile.content}
                onChange={updateFileContent}
                language={activeFile.language}
              />
            </div>

            {/* Preview / Console panel */}
            <div className="w-[45%] flex-shrink-0 flex flex-col border-l border-[#1E2433]">
              {/* Panel tabs */}
              <div className="flex items-center border-b border-[#1E2433] bg-[#0D1117] flex-shrink-0">
                <button
                  onClick={() => setRightPanel("preview")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanel === "preview" ? "text-[#007BFF] border-b-2 border-[#007BFF]" : "text-[#4A5568] hover:text-[#A0AEC0]"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Aperçu
                </button>
                <button
                  onClick={() => setRightPanel("console")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanel === "console" ? "text-[#007BFF] border-b-2 border-[#007BFF]" : "text-[#4A5568] hover:text-[#A0AEC0]"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Console
                  {consoleMessages.length > 0 && (
                    <span className="bg-[#007BFF]/15 text-[#007BFF] text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {consoleMessages.length}
                    </span>
                  )}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => { /* Force re-render preview */ setFiles(prev => [...prev]); }}
                  className="px-2 py-2 text-[#4A5568] hover:text-[#39FF14] transition-colors"
                  title="Relancer"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden">
                {rightPanel === "preview" ? (
                  <LivePreview
                    html={htmlFile?.content || ""}
                    css={cssFile?.content || ""}
                    js={jsFile?.content || ""}
                    onConsoleMessage={handleConsoleMessage}
                  />
                ) : (
                  <ConsolePanel
                    messages={consoleMessages}
                    onClear={() => setConsoleMessages([])}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
