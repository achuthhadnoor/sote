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
      <div className="flex items-center justify-center w-screen h-screen p-8 type-chrome text-foreground bg-background" role="alert">
        <div className="max-w-[560px]">
          <h1 className="text-base font-semibold mb-2">
            Something went wrong
          </h1>
          <p className="type-label text-muted-foreground mb-3">
            The editor hit an unexpected error instead of loading your folder.
            Your files are untouched.
          </p>
          <pre className="ui-surface type-diagnostic whitespace-pre-wrap break-words bg-muted border border-border p-3 max-h-[220px] overflow-auto mb-3">
            {String(error?.message || error)}
            {errorInfo?.componentStack
              ? `\n${errorInfo.componentStack
                  .split("\n")
                  .slice(0, 6)
                  .join("\n")}`
              : ""}
          </pre>
          <button onClick={this.handleReload} className="ui-control inline-flex h-8 items-center rounded-[var(--radius-md)] border border-border bg-primary px-3.5 type-label font-medium text-primary-foreground hover:opacity-90">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
