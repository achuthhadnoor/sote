import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// The native window starts hidden (see lib.rs `visible(false)`). Reveal it
// once the UI has committed so the app appears with content, never an empty
// webview. NOTE: requestAnimationFrame must NOT be used here — rAF is
// suspended in a hidden webview and would deadlock the reveal.
// No-op rejection outside Tauri (browser dev mode).
setTimeout(() => {
  try {
    getCurrentWindow().show().catch(() => {});
  } catch {}
}, 100);
