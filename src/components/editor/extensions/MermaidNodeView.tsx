import React, { useEffect, useState, useMemo } from "react";
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import mermaid from "mermaid";

export const MermaidNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const isMermaid = node.attrs.language === "mermaid";
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFitToWidth, setIsFitToWidth] = useState(false);
  const [userTheme, setUserTheme] = useState<"auto" | "dark" | "neutral">("auto");
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const rawText = node.textContent.trim();

  // Auto-detect if diagram specifies dark background rects or dark directives
  const isDarkDetected = useMemo(() => {
    return (
      /rect\s+rgb\(\s*(?:[0-9]|[1-7][0-9]|80)\s*,/i.test(rawText) ||
      /%%\{init:\s*\{.*"theme"\s*:\s*"dark".*\}\}%%/i.test(rawText)
    );
  }, [rawText]);

  const currentTheme =
    userTheme === "auto" ? (isDarkDetected ? "dark" : "neutral") : userTheme;

  useEffect(() => {
    if (!isMermaid) return;

    if (!rawText) {
      setSvgHtml(null);
      setError(null);
      return;
    }

    let isCurrent = true;
    const renderId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

    mermaid.initialize({
      startOnLoad: false,
      theme: currentTheme,
      securityLevel: "loose",
      fontFamily: "var(--font-sans)",
      sequence: {
        useMaxWidth: false,
        showSequenceNumbers: true,
      },
      flowchart: {
        useMaxWidth: false,
      },
    });

    mermaid
      .render(renderId, rawText)
      .then(({ svg }) => {
        if (isCurrent) {
          setSvgHtml(svg);
          setError(null);
        }
      })
      .catch((err) => {
        if (isCurrent) {
          setError(err?.message || String(err));
          // Clean up any stray error elements inserted into DOM by mermaid
          const stray = document.getElementById(renderId);
          if (stray) stray.remove();
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [rawText, isMermaid, currentTheme]);

  if (!isMermaid) {
    return (
      <NodeViewWrapper className="code-block-wrapper">
        <pre>
          <code>
            <NodeViewContent as="div" />
          </code>
        </pre>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="mermaid-node-wrapper">
      <div className="mermaid-header">
        <div className="mermaid-header-left">
          <span className="mermaid-label">Mermaid Diagram</span>
          {!isEditing && (
            <div className="mermaid-controls-group">
              <button
                type="button"
                className="mermaid-control-btn"
                onClick={() => setIsFitToWidth(!isFitToWidth)}
                title={
                  isFitToWidth
                    ? "Switch to 100% natural size with horizontal scroll"
                    : "Fit diagram to document width"
                }
              >
                {isFitToWidth ? "↔ 100%" : "⤢ Fit"}
              </button>

              {!isFitToWidth && (
                <div className="mermaid-zoom-group">
                  <button
                    type="button"
                    className="mermaid-control-btn"
                    onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))))}
                    title="Zoom out"
                  >
                    -
                  </button>
                  <span className="mermaid-zoom-indicator">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    className="mermaid-control-btn"
                    onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.15).toFixed(2))))}
                    title="Zoom in"
                  >
                    +
                  </button>
                  {zoomLevel !== 1 && (
                    <button
                      type="button"
                      className="mermaid-control-btn"
                      onClick={() => setZoomLevel(1)}
                      title="Reset zoom to 100%"
                    >
                      ↺
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                className="mermaid-control-btn"
                onClick={() =>
                  setUserTheme(currentTheme === "dark" ? "neutral" : "dark")
                }
                title="Toggle diagram color theme (Dark / Light)"
              >
                {currentTheme === "dark" ? "🌙 Dark" : "☀️ Light"}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          className="mermaid-toggle-btn"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? "View Diagram" : "Edit Code"}
        </button>
      </div>

      {isEditing ? (
        <pre className="mermaid-code-editor">
          <code>
            <NodeViewContent as="div" />
          </code>
        </pre>
      ) : (
        <div
          className={`mermaid-preview-container ${
            currentTheme === "dark" ? "mermaid-dark" : "mermaid-light"
          }`}
        >
          {error ? (
            <div className="mermaid-error-box">
              <div className="mermaid-error-title">Diagram Syntax Error</div>
              <div className="mermaid-error-msg">{error}</div>
              <pre className="mermaid-code-editor" style={{ marginTop: "8px" }}>
                <code>
                  <NodeViewContent as="div" />
                </code>
              </pre>
            </div>
          ) : svgHtml ? (
            <div
              className={`mermaid-svg-surface ${
                isFitToWidth ? "fit-width" : "natural-width"
              }`}
              style={{
                transform: !isFitToWidth && zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
                transformOrigin: "top left",
              }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          ) : (
            <div className="mermaid-placeholder">
              Empty Mermaid diagram. Click "Edit Code" to add syntax.
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
};
