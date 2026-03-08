import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker without auto-update
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
