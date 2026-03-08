import React, { useMemo } from "react";

interface LivePreviewProps {
  html: string;
  css: string;
  js: string;
  onConsoleMessage: (msg: { type: "log" | "error" | "warn" | "info"; text: string; time: string }) => void;
}

export default function LivePreview({ html, css, js, onConsoleMessage }: LivePreviewProps) {
  const srcdoc = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #fff; color: #1a1a1a; padding: 16px; }
${css}
</style>
</head>
<body>
${html}
<script>
(function() {
  const _post = (type, args) => {
    try {
      parent.postMessage({ source: 'marvia-preview', type, text: Array.from(args).map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
        catch { return String(a); }
      }).join(' ') }, '*');
    } catch {}
  };
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  console.log = (...a) => { orig.log(...a); _post('log', a); };
  console.error = (...a) => { orig.error(...a); _post('error', a); };
  console.warn = (...a) => { orig.warn(...a); _post('warn', a); };
  console.info = (...a) => { orig.info(...a); _post('info', a); };
  window.onerror = (msg, src, line, col) => {
    _post('error', [msg + ' (ligne ' + line + ')']);
  };
  window.onunhandledrejection = (e) => {
    _post('error', ['Promise rejetée: ' + (e.reason?.message || e.reason)]);
  };
})();
try {
${js}
} catch(e) {
  console.error(e.message);
}
<\/script>
</body>
</html>`;
  }, [html, css, js]);

  React.useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.source === "marvia-preview") {
        const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        onConsoleMessage({ type: e.data.type, text: e.data.text, time: now });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onConsoleMessage]);

  return (
    <div className="h-full w-full bg-white rounded-md overflow-hidden">
      <iframe
        srcDoc={srcdoc}
        title="Live Preview"
        sandbox="allow-scripts allow-modals"
        className="w-full h-full border-0"
      />
    </div>
  );
}
