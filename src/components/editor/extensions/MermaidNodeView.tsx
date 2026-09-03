import React, { useEffect, useState, useMemo, useRef } from "react";
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
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  }>({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

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

  // Pan / Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isFitToWidth) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isFitToWidth) return;
    const dx = e.clientX - dragStartRef.current.mouseX;
    const dy = e.clientY - dragStartRef.current.mouseY;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isFitToWidth) return;
    if (e.ctrlKey || e.metaKey) {
      // Pinch to zoom
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel((z) =>
        Math.max(0.3, Math.min(3, Number((z + delta).toFixed(2))))
      );
    } else {
      // Trackpad or mouse wheel pan
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  };

  const resetPanAndZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

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

  const showCode = isEditing || Boolean(error);

  return (
    <NodeViewWrapper className="mermaid-node-wrapper">
      <div className="mermaid-header">
        <div className="mermaid-header-left">
          <span className="mermaid-label">Mermaid Diagram</span>
          {!showCode && (
            <div className="mermaid-controls-group">
              <button
                type="button"
                className="mermaid-control-btn"
                onClick={() => {
                  setIsFitToWidth(!isFitToWidth);
                  setPan({ x: 0, y: 0 });
                }}
                title={
                  isFitToWidth
                    ? "Switch to natural size with pan & drag"
                    : "Fit diagram to document width"
                }
              >
                {isFitToWidth ? "↔ Natural" : "⤢ Fit"}
              </button>

              {!isFitToWidth && (
                <div className="mermaid-zoom-group">
                  <button
                    type="button"
                    className="mermaid-control-btn"
                    onClick={() =>
                      setZoomLevel((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))
                    }
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
                    onClick={() =>
                      setZoomLevel((z) => Math.min(3, Number((z + 0.15).toFixed(2))))
                    }
                    title="Zoom in"
                  >
                    +
                  </button>
                  {(zoomLevel !== 1 || pan.x !== 0 || pan.y !== 0) && (
                    <button
                      type="button"
                      className="mermaid-control-btn"
                      onClick={resetPanAndZoom}
                      title="Reset pan and zoom (100%)"
                    >
                      ↺ Reset
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
          onClick={() => {
            if (error) {
              setError(null);
              setIsEditing(false);
            } else {
              setIsEditing(!isEditing);
            }
          }}
        >
          {showCode ? "View Diagram" : "Edit Code"}
        </button>
      </div>

      {/* NodeViewContent MUST remain permanently mounted so ProseMirror contentDOM is preserved */}
      <div
        className="mermaid-code-container"
        style={{ display: showCode ? "block" : "none" }}
      >
        {error && (
          <div className="mermaid-error-box">
            <div className="mermaid-error-title">Diagram Syntax Error</div>
            <div className="mermaid-error-msg">{error}</div>
          </div>
        )}
        <pre className="mermaid-code-editor">
          <code>
            <NodeViewContent as="div" />
          </code>
        </pre>
      </div>

      <div
        className={`mermaid-preview-container ${
          currentTheme === "dark" ? "mermaid-dark" : "mermaid-light"
        } ${isFitToWidth ? "is-fit" : ""}`}
        style={{
          display: showCode ? "none" : "flex",
          cursor: isFitToWidth ? "default" : isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onWheel={handleWheel}
        title={!isFitToWidth ? "Click and drag to pan across the diagram" : undefined}
      >
        {svgHtml ? (
          <div
            className={`mermaid-svg-surface ${
              isFitToWidth ? "fit-width" : "natural-width"
            }`}
            style={{
              transform: isFitToWidth
                ? undefined
                : `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
              transformOrigin: "0 0",
              userSelect: isDragging ? "none" : "auto",
              pointerEvents: isDragging ? "none" : "auto",
            }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="mermaid-placeholder">
            Empty Mermaid diagram. Click "Edit Code" to add syntax.
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};
