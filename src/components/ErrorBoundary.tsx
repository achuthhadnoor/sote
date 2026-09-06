import React from "react";
import { createLogger } from "../lib/logger";

const log = createLogger("error-boundary");

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Catches render-time crashes anywhere in the tree and shows a readable
 * fallback instead of an empty window. Without this, a single throwing
 * component unmounts the entire app to a blank webview with no indication
 * of what failed (frontend logs only exist in the Web Inspector).
 */
export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<object>,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error("Uncaught render error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      this.setState({ error: null, errorInfo: null });
    }
  };

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100vw",
          height: "100vh",
          padding: 32,
          fontFamily: "var(--font-sans)",
          color: "var(--fg)",
          background: "var(--bg)",
        }}
        role="alert"
      >
        <div style={{ maxWidth: 560 }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted-fg)",
              marginBottom: 12,
            }}
          >
            The editor hit an unexpected error instead of loading your vault.
            Your files are untouched.
          </p>
          <pre
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 12,
              maxHeight: 220,
              overflow: "auto",
              marginBottom: 12,
            }}
          >
            {String(error?.message || error)}
            {errorInfo?.componentStack
              ? `\n${errorInfo.componentStack
                  .split("\n")
                  .slice(0, 6)
                  .join("\n")}`
              : ""}
          </pre>
          <button
            onClick={this.handleReload}
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
