import React, { useEffect, useState, useRef, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";

import {
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Code2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useThemeStore } from "@/stores/useThemeStore";

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

/** App palette only — diagrams stay monochrome in both themes. */
const APP = {
  light: { bg: "#FFFFFF", panel: "#F3F4F6", border: "#E1E4E8", ink: "#1F2328", softInk: "#656D76" },
  dark: { bg: "#0E0E0E", panel: "#1F1F1F", border: "#232323", ink: "#E4E4E7", softInk: "#8A8A8A" },
} as const;

type Palette = { bg: string; panel: string; border: string; ink: string; softInk: string };

const CSS_PASSTHROUGH = new Set(["none", "transparent", "currentcolor", "inherit", "initial", "unset"]);

function grayOf(r: number, g: number, b: number): number {
  return Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
}

function grayHex(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const v = grayOf(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16))
    .toString(16)
    .padStart(2, "0");
  return `#${v}${v}${v}`;
}

function resolveNamedToRgb(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const probe = document.createElement("span");
    probe.style.display = "none";
    probe.style.color = name;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const m = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return null;
    return `rgb(${m[1]}, ${m[2]}, ${m[3]})`;
  } catch {
    return null;
  }
}

/** Desaturate any leftover non-app color in rendered SVG to neutral gray. */
function toMonochrome(svg: string, palette: Palette): string {
  const appColors = new Set(
    [palette.bg, palette.panel, palette.border, palette.ink, palette.softInk].map((c) => c.toLowerCase())
  );
  let out = svg;
  out = out.replace(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m) =>
    appColors.has(m.toLowerCase()) ? m : grayHex(m)
  );
  out = out.replace(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\)/gi,
    (_m, r, g, b, a) => {
      const v = grayOf(Number(r), Number(g), Number(b));
      return a !== undefined ? `rgba(${v}, ${v}, ${v}, ${a})` : `rgb(${v}, ${v}, ${v})`;
    }
  );
  const cache = new Map<string, string>();
  out = out.replace(/((?:fill|stroke|stop-color|color)\s*[:=]\s*["']?)([a-zA-Z]+)\b(?!\()(["']?)/g,
    (m, pre, name, post) => {
      const key = (name as string).toLowerCase();
      if (CSS_PASSTHROUGH.has(key)) return m;
      if (!cache.has(key)) {
        const rgb = resolveNamedToRgb(name as string);
        if (!rgb) return m;
        const mt = rgb.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (!mt) return m;
        const v = grayOf(Number(mt[1]), Number(mt[2]), Number(mt[3]));
        cache.set(key, `rgb(${v}, ${v}, ${v})`);
      }
      return `${pre}${cache.get(key)}${post}`;
    }
  );
  return out;
}

/* ── Shared mermaid render pipeline ───────────────────────────────────────
   mermaid.initialize is process-global, so concurrent renders from multiple
   diagrams (or a theme toggle mid-render) corrupt each other's config. Every
   render goes through this serial queue. Both themes are pre-rendered up
   front so theme switches swap SVGs synchronously instead of re-rendering
   async one diagram at a time. Finished diagrams are cached by source text
   so tab switches remount instantly without placeholder flashes. */
let mermaidQueue: Promise<void> = Promise.resolve();

function enqueueMermaid<T>(task: () => Promise<T>): Promise<T> {
  const result = mermaidQueue.then(task, task);
  mermaidQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

const diagramCache = new Map<string, { light: string; dark: string }>();
const DIAGRAM_CACHE_LIMIT = 50;

function stripAuthorColors(src: string, palette: Palette): string {
  return src
    .replace(/rect\s+(?:rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/gi, (match) =>
      /^rect\s+(?:end|none)/i.test(match) ? match : `rect ${palette.panel}`
    )
    .replace(/fill\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)/gi, (m, c: string) =>
      /^(none|transparent)$/i.test(c.trim()) ? m : `fill:${palette.panel}`
    )
    .replace(/stroke\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)/gi, (m, c: string) =>
      /^(none|transparent)$/i.test(c.trim()) ? m : `stroke:${palette.softInk}`
    )
    .replace(/(^|[^-\w])color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)/gim, (m, p: string, c: string) =>
      /^(none|transparent|inherit|currentColor)$/i.test(c.trim()) ? m : `${p}color:${palette.ink}`
    );
}

function buildThemeVariables(palette: Palette, darkMode: boolean): Record<string, string | boolean> {
  return {
    darkMode,
    // Transparent canvas — the editor surface shows through; only chart
    // content (nodes, labels, panels) carries fills.
    background: "transparent",
    primaryColor: palette.panel,
    primaryTextColor: palette.ink,
    primaryBorderColor: palette.border,
    secondaryColor: palette.panel,
    secondaryTextColor: palette.ink,
    secondaryBorderColor: palette.border,
    tertiaryColor: palette.bg,
    tertiaryTextColor: palette.ink,
    tertiaryBorderColor: palette.border,
    lineColor: palette.softInk,
    textColor: palette.ink,
    mainBkg: palette.bg,
    nodeBkg: palette.panel,
    nodeBorder: palette.border,
    nodeTextColor: palette.ink,
    clusterBkg: palette.panel,
    clusterBorder: palette.border,
    defaultLinkColor: palette.softInk,
    titleColor: palette.ink,
    // Label chips sit on the transparent canvas, so they stay transparent too.
    edgeLabelBackground: "transparent",
    actorBorder: palette.border,
    actorBkg: palette.panel,
    actorTextColor: palette.ink,
    actorLineColor: palette.border,
    signalColor: palette.ink,
    signalTextColor: palette.ink,
    labelBoxBkgColor: palette.panel,
    labelBoxBorderColor: palette.border,
    labelTextColor: palette.ink,
    loopTextColor: palette.ink,
    noteBorderColor: palette.border,
    noteBkgColor: palette.panel,
    noteTextColor: palette.ink,
    activationBorderColor: palette.softInk,
    activationBkgColor: palette.border,
    sequenceNumberColor: palette.bg,
    rectBkgColor: palette.panel,
    altBackground: palette.panel,
    compositeBackground: palette.bg,
    compositeBorder: palette.border,
    compositeTitleBackground: palette.panel,
    innerEndBackground: palette.softInk,
    specialStateColor: palette.ink,
    stateLabelColor: palette.ink,
    stateBkg: palette.panel,
    labelBackgroundColor: "transparent",
    relationColor: palette.softInk,
    relationLabelBackground: "transparent",
    relationLabelColor: palette.ink,
    // Extra diagram types — grayscale steps only
    git0: palette.panel,
    git1: palette.border,
    git2: palette.softInk,
    git3: palette.ink,
    git4: palette.panel,
    git5: palette.border,
    git6: palette.softInk,
    git7: palette.bg,
    pie1: palette.border,
    pie2: palette.softInk,
    pie3: palette.ink,
    pie4: palette.panel,
    pie5: palette.border,
    pie6: palette.softInk,
    pie7: palette.ink,
    pie8: palette.bg,
    pie9: palette.border,
    pie10: palette.softInk,
    pie11: palette.ink,
    pie12: palette.panel,
    pieTitleTextColor: palette.ink,
    pieSectionTextColor: palette.ink,
    quadrant1Fill: palette.bg,
    quadrant2Fill: palette.panel,
    quadrant3Fill: palette.panel,
    quadrant4Fill: palette.bg,
    quadrant1TextFill: palette.ink,
    quadrant2TextFill: palette.ink,
    quadrant3TextFill: palette.ink,
    quadrant4TextFill: palette.ink,
    quadrantPointFill: palette.softInk,
    quadrantPointTextFill: palette.ink,
    quadrantXAxisTextFill: palette.ink,
    quadrantYAxisTextFill: palette.ink,
    quadrantInternalBorderStrokeFill: palette.border,
    quadrantExternalBorderStrokeFill: palette.border,
    timelineBkgColor: palette.panel,
  };
}

const LIGHT_VARS = buildThemeVariables(APP.light, false);
const DARK_VARS = buildThemeVariables(APP.dark, true);

let mermaidModule: typeof import("mermaid")["default"] | null = null;
async function getMermaid() {
  if (!mermaidModule) {
    const mod = await import("mermaid");
    mermaidModule = mod.default || mod;
  }
  return mermaidModule;
}

async function renderDiagram(
  renderId: string,
  text: string,
  themeVars: Record<string, string | boolean>,
  palette: Palette
): Promise<string> {
  const mermaid = await getMermaid();
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: themeVars,
    securityLevel: "loose",
    fontFamily: "var(--font-sans)",
    sequence: { useMaxWidth: false, showSequenceNumbers: true },
    flowchart: { useMaxWidth: false },
  });
  const { svg } = await mermaid.render(renderId, stripAuthorColors(text, palette));
  return toMonochrome(svg, palette);
}

export const MermaidNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const isMermaid = node.attrs.language === "mermaid";
  const [svgLight, setSvgLight] = useState<string | null>(null);
  const [svgDark, setSvgDark] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFitToWidth, setIsFitToWidth] = useState(true);
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
  const firstRenderRef = useRef(true);

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

  // Single source of truth for theme — the store already mirrors data-theme.
  const isDark = useThemeStore((state) => state.effectiveTheme) === "dark";

  useEffect(() => {
    if (!isMermaid) return;
    if (!rawText) {
      setSvgLight(null);
      setSvgDark(null);
      setError(null);
      return;
    }
    // Cache hit (e.g. after a tab switch): apply synchronously, no async flash.
    const cached = diagramCache.get(rawText);
    if (cached) {
      setSvgLight(cached.light);
      setSvgDark(cached.dark);
      setError(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const baseId = `mm-${Math.random().toString(36).slice(2, 9)}`;
      try {
        // Serial queue keeps mermaid's global config consistent; pre-rendering
        // BOTH themes makes later theme switches swap SVGs synchronously.
        const light = await enqueueMermaid(() => renderDiagram(`${baseId}-l`, rawText, LIGHT_VARS, APP.light));
        if (cancelled) return;
        setSvgLight(light);
        const dark = await enqueueMermaid(() => renderDiagram(`${baseId}-d`, rawText, DARK_VARS, APP.dark));
        if (cancelled) return;
        setSvgDark(dark);
        setError(null);
        diagramCache.set(rawText, { light, dark });
        if (diagramCache.size > DIAGRAM_CACHE_LIMIT) {
          const oldest = diagramCache.keys().next();
          if (!oldest.done) diagramCache.delete(oldest.value);
        }
      } catch (err) {
        if (cancelled) return;
        setError((err as Error)?.message || String(err));
        const stray = document.getElementById(`${baseId}-l`) || document.getElementById(`${baseId}-d`);
        if (stray) stray.remove();
      }
    };
    // Render immediately on mount; debounce content edits while typing.
    // (Theme switches never re-run this effect — both variants are pre-rendered.)
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      void run();
      return () => {
        cancelled = true;
      };
    }
    const timer = setTimeout(() => void run(), 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [rawText, isMermaid]);

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
        <Card className="code-block-card group relative overflow-hidden border shadow-sm">
          {/* Floating actions */}
          <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border bg-background/80 p-0.5 shadow-sm backdrop-blur transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            <span className="px-1.5 text-[10px] font-mono text-muted-foreground select-none">
              {label}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleCopy}
              title={`Copy ${label} code to clipboard`}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
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
  // Both themes are pre-rendered: switching theme swaps SVGs synchronously.
  const svgHtml = isDark ? svgDark ?? svgLight : svgLight ?? svgDark;

  return (
    <NodeViewWrapper as="div" className="my-[18px]">
        <Card className="group relative overflow-hidden border shadow-sm">
          {/* Floating actions */}
          <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border bg-background/80 p-0.5 shadow-sm backdrop-blur transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
            {!showCode && (
              <>
                {/* Fit / Natural Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setIsFitToWidth(!isFitToWidth);
                    setPan({ x: 0, y: 0 });
                  }}
                  title={isFitToWidth ? "Switch to natural size with pan & drag" : "Fit diagram to document width"}
                >
                  {isFitToWidth ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>

                {/* Zoom controls */}
                {!isFitToWidth && (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setZoomLevel((z) => Math.max(0.3, Number((z - 0.15).toFixed(2))))}
                      title="Zoom out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setZoomLevel((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
                      title="Zoom in"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    {(zoomLevel !== 1 || pan.x !== 0 || pan.y !== 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={resetPanAndZoom}
                        title="Reset view"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Copy button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleCopy}
              title="Copy diagram code"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Toggle Code / Diagram */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                if (error) {
                  setError(null);
                  setIsEditing(false);
                } else {
                  setIsEditing(!isEditing);
                }
              }}
              title={showCode ? "View diagram" : "Edit code"}
            >
              {showCode ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <Code2 className="h-3.5 w-3.5" />
              )}
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
          className={`mermaid-preview-container ${isDark ? "mermaid-dark" : "mermaid-light"} ${isFitToWidth ? "is-fit" : ""} flex justify-start overflow-hidden`}
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
          ) : !rawText ? (
            <div className="p-3 text-[13px] italic text-muted-foreground">Empty Mermaid diagram. Click &ldquo;Edit Code&rdquo; to add syntax.</div>
          ) : (
            <div className="w-full p-5" aria-label="Rendering diagram">
              <div className="h-28 animate-pulse rounded-md bg-muted/60" />
            </div>
          )}
        </div>
      </Card>
    </NodeViewWrapper>
  );
};
