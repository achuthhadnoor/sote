import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

