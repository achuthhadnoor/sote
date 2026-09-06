import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { createLogger } from "./lib/logger";

const log = createLogger("bootstrap");

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

