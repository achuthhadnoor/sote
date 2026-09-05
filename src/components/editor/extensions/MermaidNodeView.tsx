import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import mermaid from "mermaid";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** Human-friendly language labels for common code block languages */
const LANGUAGE_LABELS: Record<string, string> = {
  js: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  tsx: "TSX",
  py: "Python",
  rb: "Ruby",
  rs: "Rust",
  go: "Go",
  sh: "Shell",
  bash: "Bash",
  zsh: "Zsh",
  yml: "YAML",
  yaml: "YAML",
  md: "Markdown",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sql: "SQL",
  graphql: "GraphQL",
  dockerfile: "Dockerfile",
  toml: "TOML",
  swift: "Swift",
  kotlin: "Kotlin",
  java: "Java",
  c: "C",
  cpp: "C++",
  cs: "C#",
  php: "PHP",
  lua: "Lua",
  dart: "Dart",
  r: "R",
  elixir: "Elixir",
  haskell: "Haskell",
  xml: "XML",
  svg: "SVG",
};

function getLanguageLabel(lang: string | null | undefined): string {
  if (!lang) return "Code";
  const lower = lang.toLowerCase();
  return LANGUAGE_LABELS[lower] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

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
  const [copied, setCopied] = useState(false);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  }>({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

  const rawText = node.textContent.trim();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API isn't available
      const textarea = document.createElement("textarea");
      textarea.value = rawText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [rawText]);

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
      sequence: { useMaxWidth: false, showSequenceNumbers: true },
      flowchart: { useMaxWidth: false },
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
          const stray = document.getElementById(renderId);
          if (stray) stray.remove();
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [rawText, isMermaid, currentTheme]);

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
    setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging) setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isFitToWidth) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel((z) => Math.max(0.3, Math.min(3, Number((z + delta).toFixed(2)))));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const resetPanAndZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // ─── Non-mermaid code blocks ────────────────────────────────────────
  if (!isMermaid) {
    const language = node.attrs.language as string | null;
    const label = getLanguageLabel(language);

    return (
      <NodeViewWrapper as="div" className="my-[18px]">
        <Card className="code-block-card overflow-hidden border shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b bg-muted px-3 py-1.5">
            <Badge variant="secondary" className="text-[11px] font-mono">
              {label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={handleCopy}
              title="Copy code to clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
          <pre>
            <code>
              <NodeViewContent as="div" />
            </code>
          </pre>
        </Card>
      </NodeViewWrapper>
    );
  }

  // ─── Mermaid code blocks ────────────────────────────────────────────
  const showCode = isEditing || Boolean(error);

  return (
    <NodeViewWrapper as="div" className="my-[18px]">
      <Card className="overflow-hidden border shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b bg-muted px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px] font-mono">Mermaid</Badge>
            {!showCode && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    setIsFitToWidth(!isFitToWidth);
                    setPan({ x: 0, y: 0 });
                  }}
                  title={isFitToWidth ? "Switch to natural size with pan & drag" : "Fit diagram to document width"}
                >
                  {isFitToWidth ? "↔ Natural" : "⤢ Fit"}
                </Button>
                {!isFitToWidth && (
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setZoomLevel((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))}
                      title="Zoom out"
                    >
                      −
                    </Button>
                    <span className="min-w-[38px] text-center font-mono text-[10px] text-muted-foreground">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setZoomLevel((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
                      title="Zoom in"
                    >
                      +
                    </Button>
                    {(zoomLevel !== 1 || pan.x !== 0 || pan.y !== 0) && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={resetPanAndZoom} title="Reset pan and zoom">
                        ↺
                      </Button>
                    )}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setUserTheme(currentTheme === "dark" ? "neutral" : "dark")}
                  title="Toggle diagram color theme"
                >
                  {currentTheme === "dark" ? "🌙 Dark" : "☀️ Light"}
                </Button>
              </div>
            )}
          </div>
          <Button
            variant={showCode ? "secondary" : "outline"}
            size="sm"
            className="h-6 px-2.5 text-[11px]"
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
          </Button>
        </div>

        <div className="mermaid-code-container" style={{ display: showCode ? "block" : "none" }}>
          {error && (
            <div className="m-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
              <div className="font-semibold text-destructive">Diagram Syntax Error</div>
              <div className="mt-1 font-mono text-[11px] whitespace-pre-wrap break-all text-destructive">{error}</div>
            </div>
          )}
          <pre className="mermaid-code-editor m-0 rounded-none border-0">
            <code>
              <NodeViewContent as="div" />
            </code>
          </pre>
        </div>

        <div
          className={`mermaid-preview-container ${currentTheme === "dark" ? "mermaid-dark" : "mermaid-light"} ${isFitToWidth ? "is-fit" : ""} flex justify-start overflow-hidden`}
          style={{
            display: showCode ? "none" : "flex",
            cursor: isFitToWidth ? "default" : isDragging ? "grabbing" : "grab",
            height: isFitToWidth ? undefined : 560,
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
              className={`mermaid-svg-surface ${isFitToWidth ? "fit-width" : "natural-width"} flex justify-center mx-auto my-0`}
              style={{
                transform: isFitToWidth ? undefined : `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                transformOrigin: "0 0",
                userSelect: isDragging ? "none" : "auto",
                pointerEvents: isDragging ? "none" : "auto",
              }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          ) : (
            <div className="p-3 text-[13px] italic text-muted-foreground">Empty Mermaid diagram. Click &ldquo;Edit Code&rdquo; to add syntax.</div>
          )}
        </div>
      </Card>
    </NodeViewWrapper>
  );
};
