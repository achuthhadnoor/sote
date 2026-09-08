import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { createLogger, NAV_TO_JS_MS, navigationEpochMs } from "./lib/logger";

const log = createLogger("bootstrap");

// First JS execution: how long did the webview take to spawn, fetch and
// parse the bundle before React could even mount?
log.info(`js boot: navigation→script exec ${Math.round(NAV_TO_JS_MS)}ms (navEpoch=${navigationEpochMs()})`);

// Surface async failures (IPC, lazy chunks) that React boundaries can't
// catch: log them and, if nothing rendered, show the message in the window
// so a blank webview never fails silently.
window.addEventListener("unhandledrejection", (event) => {
  log.error("Unhandled promise rejection:", event.reason);
});
window.addEventListener("error", (event) => {
  log.error("Uncaught window error:", event.error || event.message);
});

// Route by window label: `float` (v1 default panel) vs `main` (v2 full shell).
// Each surface loads its own chunk so the compact panel never pulls in the
// full vault shell (and vice-versa).
function resolveWindowLabel(): string {
  try {
    const label = getCurrentWindow().label;
    if (typeof label === "string" && label) return label;
  } catch {}
  return "main";
}

async function mountRoot() {
  const label = resolveWindowLabel();
  log.info(`mounting window label="${label}"`);

  const Root =
    label === "float"
      ? (await import("./components/float/FloatingShell")).FloatingShell
      : (await import("./App")).default;

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

mountRoot().catch((err) => {
  log.error("Failed to mount root:", err);
});
