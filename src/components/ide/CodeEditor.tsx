import React, { useRef, useCallback } from "react";
import Editor, { OnMount } from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  theme?: string;
  ideTheme?: "dark" | "light";
}

export default function CodeEditor({ value, onChange, language, ideTheme = "dark" }: CodeEditorProps) {
  const editorRef = useRef<any>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Dark theme
    monaco.editor.defineTheme("marvia-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A737D", fontStyle: "italic" },
        { token: "keyword", foreground: "007BFF" },
        { token: "string", foreground: "39FF14" },
        { token: "number", foreground: "FF9F43" },
        { token: "type", foreground: "B388FF" },
        { token: "function", foreground: "54A0FF" },
        { token: "variable", foreground: "E2E8F0" },
        { token: "tag", foreground: "FF6B6B" },
        { token: "attribute.name", foreground: "54A0FF" },
        { token: "attribute.value", foreground: "39FF14" },
      ],
      colors: {
        "editor.background": "#0A0E14",
        "editor.foreground": "#E2E8F0",
        "editor.lineHighlightBackground": "#1A1F2E",
        "editor.selectionBackground": "#007BFF33",
        "editor.inactiveSelectionBackground": "#007BFF1A",
        "editorCursor.foreground": "#007BFF",
        "editorLineNumber.foreground": "#4A5568",
        "editorLineNumber.activeForeground": "#007BFF",
        "editor.selectionHighlightBackground": "#007BFF22",
        "editorIndentGuide.background": "#1E2433",
        "editorIndentGuide.activeBackground": "#2D3748",
        "editorWidget.background": "#0D1117",
        "editorWidget.border": "#1E2433",
        "editorSuggestWidget.background": "#0D1117",
        "editorSuggestWidget.border": "#1E2433",
        "editorSuggestWidget.selectedBackground": "#007BFF33",
      },
    });

    // Light theme
    monaco.editor.defineTheme("marvia-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A737D", fontStyle: "italic" },
        { token: "keyword", foreground: "0550AE" },
        { token: "string", foreground: "0A7D26" },
        { token: "number", foreground: "CF6A00" },
        { token: "type", foreground: "6F42C1" },
        { token: "function", foreground: "0550AE" },
        { token: "variable", foreground: "24292F" },
        { token: "tag", foreground: "CF222E" },
        { token: "attribute.name", foreground: "0550AE" },
        { token: "attribute.value", foreground: "0A7D26" },
      ],
      colors: {
        "editor.background": "#FFFFFF",
        "editor.foreground": "#24292F",
        "editor.lineHighlightBackground": "#F6F8FA",
        "editor.selectionBackground": "#0969DA33",
        "editorCursor.foreground": "#0969DA",
        "editorLineNumber.foreground": "#8C959F",
        "editorLineNumber.activeForeground": "#0969DA",
        "editorIndentGuide.background": "#D8DEE4",
        "editorWidget.background": "#F6F8FA",
        "editorWidget.border": "#D0D7DE",
        "editorSuggestWidget.background": "#FFFFFF",
        "editorSuggestWidget.border": "#D0D7DE",
        "editorSuggestWidget.selectedBackground": "#0969DA22",
      },
    });

    const themeName = ideTheme === "light" ? "marvia-light" : "marvia-dark";
    monaco.editor.setTheme(themeName);

    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderWhitespace: "selection",
      bracketPairColorization: { enabled: true },
      autoClosingBrackets: "always",
      autoClosingQuotes: "always",
      formatOnPaste: true,
      tabSize: 2,
      wordWrap: "on",
      lineNumbers: "on",
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      padding: { top: 12, bottom: 12 },
    });
  };

  const handleChange = useCallback((val: string | undefined) => {
    onChange(val || "");
  }, [onChange]);

  const themeName = ideTheme === "light" ? "marvia-light" : "marvia-dark";
  const bgColor = ideTheme === "light" ? "#FFFFFF" : "#0A0E14";

  return (
    <div className="h-full w-full overflow-hidden">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        theme={themeName}
        loading={
          <div className="flex items-center justify-center h-full" style={{ background: bgColor }}>
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#007BFF] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs" style={{ color: ideTheme === "light" ? "#8C959F" : "#4A5568" }}>Chargement...</span>
            </div>
          </div>
        }
        options={{
          automaticLayout: true,
        }}
      />
    </div>
  );
}
