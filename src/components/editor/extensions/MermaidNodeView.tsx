import React, { useEffect, useState, useId } from "react";
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  fontFamily: "var(--font-sans)",
});

export const MermaidNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const isMermaid = node.attrs.language === "mermaid";
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const rawId = useId();
  const renderId = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    if (!isMermaid) return;

    const content = node.textContent.trim();
    if (!content) {
      setSvgHtml(null);
      setError(null);
      return;
    }

    let isCurrent = true;

    mermaid
      .render(renderId, content)
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
  }, [node.textContent, isMermaid, renderId]);

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
        <span className="mermaid-label">Mermaid Diagram</span>
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
        <div className="mermaid-preview-container">
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
              className="mermaid-svg-surface"
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
