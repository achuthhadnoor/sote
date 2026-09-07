import React, { useEffect, useState, useRef, useCallback } from "react";
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import DOMPurify from "dompurify";

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

const CSS_PASSTHROUGH = new Set([
  "none",
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "context-fill",
  "context-stroke",
]);

const MERMAID_CACHE_VERSION = "mermaid-render-v2";
const MERMAID_SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed"],
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

type RGB = { r: number; g: number; b: number; alpha?: string };
const namedColorRgbCache = new Map<string, string | null>();

function normalizeMermaidSource(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy clipboard path.
    }
  }
  if (typeof document === "undefined") return false;
  const root = document.body ?? document.documentElement;
  if (!root) return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  root.appendChild(textarea);
  try {
    textarea.select();
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

function parseHexColor(value: string): RGB | null {
  let hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/i.test(hex)) return null;
  if (hex.length === 3 || hex.length === 4) hex = hex.split("").map((char) => char + char).join("");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    alpha: hex.length === 8 ? hex.slice(6, 8) : undefined,
  };
}

function parseRgbComponent(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(percent) ? Math.round(Math.max(0, Math.min(100, percent)) * 2.55) : null;
  }
  const number = Number.parseFloat(trimmed);
  return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(255, number))) : null;
}

function parseRgbColor(value: string): RGB | null {
  const match = value.match(/^rgba?\((.*)\)$/i);
  if (!match) return null;
  const components = match[1].replace(/\s*\/\s*/g, ",").split(/\s*,\s*|\s+/).filter(Boolean);
  if (components.length < 3) return null;
  const r = parseRgbComponent(components[0]);
  const g = parseRgbComponent(components[1]);
  const b = parseRgbComponent(components[2]);
  if (r === null || g === null || b === null) return null;
  return { r, g, b, alpha: components[3] };
}

function rgbKey(color: RGB): string {
  return `${color.r},${color.g},${color.b}`;
}

function paletteRgbKeys(palette: Palette): Set<string> {
  return new Set([palette.bg, palette.panel, palette.border, palette.ink, palette.softInk]
    .map(parseHexColor)
    .filter((color): color is RGB => color !== null)
    .map(rgbKey));
}

function grayOf(r: number, g: number, b: number): number {
  return Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
}

function grayHex(color: RGB): string {
  const value = grayOf(color.r, color.g, color.b).toString(16).padStart(2, "0");
  return color.alpha ? `#${value}${value}${value}${color.alpha}` : `#${value}${value}${value}`;
}

function resolveNamedToRgb(name: string): string | null {
  const key = name.toLowerCase();
  if (namedColorRgbCache.has(key)) return namedColorRgbCache.get(key) ?? null;
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  if (!root) return null;
  const probe = document.createElement("span");
  try {
    probe.style.display = "none";
    probe.style.color = name;
    root.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    const m = computed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    const result = m ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : null;
    namedColorRgbCache.set(key, result);
    return result;
  } catch {
    return null;
  } finally {
    probe.remove();
  }
}

function monochromeColorValue(value: string, paletteKeys: Set<string>, namedCache: Map<string, string>): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const trimmed = value.trim();
  const important = trimmed.match(/\s*!important$/i)?.[0] ?? "";
  const core = important ? trimmed.slice(0, -important.length).trimEnd() : trimmed;
  const lower = core.toLowerCase();
  if (!core || CSS_PASSTHROUGH.has(lower) || lower.includes("var(") || lower.includes("url(")) return value;
  if (/^(?:currentcolor|inherit|initial|unset|revert(?:-layer)?)\b/i.test(core)) return value;

  const parsed = core.startsWith("#") ? parseHexColor(core) : parseRgbColor(core);
  if (parsed) {
    if (paletteKeys.has(rgbKey(parsed)) && !parsed.alpha) return value;
    const gray = grayOf(parsed.r, parsed.g, parsed.b);
    const converted = core.startsWith("#")
      ? grayHex(parsed)
      : parsed.alpha === undefined
        ? `rgb(${gray}, ${gray}, ${gray})`
        : `rgba(${gray}, ${gray}, ${gray}, ${parsed.alpha})`;
    return `${leading}${converted}${important}${trailing}`;
  }

  if (/^[a-z]+$/i.test(core)) {
    const key = lower;
    if (!namedCache.has(key)) {
      const rgb = resolveNamedToRgb(core);
      const parsedNamed = rgb ? parseRgbColor(rgb) : null;
      namedCache.set(key, parsedNamed ? `rgb(${parsedNamed.r}, ${parsedNamed.g}, ${parsedNamed.b})` : core);
    }
    const named = namedCache.get(key) ?? core;
    if (named === core) return value;
    return monochromeColorValue(`${leading}${named}${important}${trailing}`, paletteKeys, namedCache);
  }

  // Keep CSS functions, variables, gradients, and other constructs intact.
  return value;
}

function transformColorDeclarations(css: string, paletteKeys: Set<string>, namedCache: Map<string, string>): string {
  return css.replace(
    /(^|[;{}]\s*)((?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*:\s*)([^;{}]+)/gim,
    (_match, separator: string, prefix: string, value: string) =>
      `${separator}${prefix}${monochromeColorValue(value, paletteKeys, namedCache)}`
  );
}

/** Desaturate concrete SVG colors while preserving safe CSS constructs and app palette colors. */
function toMonochrome(svg: string, palette: Palette): string {
  const paletteKeys = paletteRgbKeys(palette);
  const namedCache = new Map<string, string>();
  let out = svg.replace(
    /\b(fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*(["'])(.*?)\2/gi,
    (_match, property: string, quote: string, value: string) =>
      `${property}=${quote}${monochromeColorValue(value, paletteKeys, namedCache)}${quote}`
  );
  out = out.replace(/\bstyle\s*=\s*(["'])(.*?)\1/gi, (_match, quote: string, value: string) =>
    `style=${quote}${transformColorDeclarations(value, paletteKeys, namedCache)}${quote}`
  );
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open: string, css: string, close: string) =>
    `${open}${transformColorDeclarations(css, paletteKeys, namedCache)}${close}`
  );
  return out;
}

/* ── Shared Mermaid render pipeline ────────────────────────────────────────
   Mermaid configuration is process-global. The queue therefore owns module
   loading, initialization, and the complete light/dark render pair so no
   other diagram can interleave between those operations. */
let mermaidQueue: Promise<void> = Promise.resolve();

type MermaidApi = typeof import("mermaid")["default"];

function enqueueMermaid<T>(task: (mermaid: MermaidApi) => Promise<T>): Promise<T> {
  const result = mermaidQueue.then(async () => task(await getMermaid()), async () => task(await getMermaid()));
  mermaidQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

const diagramCache = new Map<string, { light: string; dark: string }>();
const DIAGRAM_CACHE_LIMIT = 50;
let renderSequence = 0;

function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, MERMAID_SANITIZE_CONFIG);
}

function namespaceSvgIds(svg: string, prefix: string): string {
  const ids = new Map<string, string>();
  for (const match of svg.matchAll(/\bid\s*=\s*(["'])([^"']+)\1/gi)) {
    const id = match[2];
    if (!ids.has(id)) ids.set(id, `${prefix}-${id}`);
  }

  if (!ids.size) return svg;

  let out = svg.replace(/\bid\s*=\s*(["'])([^"']+)\1/gi, (match, quote: string, id: string) => {
    const namespaced = ids.get(id);
    return namespaced ? `id=${quote}${namespaced}${quote}` : match;
  });

  for (const [id, namespaced] of ids) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out
      .replace(new RegExp(`url\\(#${escapedId}\\)`, "g"), `url(#${namespaced})`)
      .replace(new RegExp(`(["'])#${escapedId}\\1`, "g"), `$1#${namespaced}$1`);
  }

  return out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_match, open: string, css: string, close: string) => {
    let namespacedCss = css;
    for (const [id, namespaced] of ids) {
      const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      namespacedCss = namespacedCss.replace(new RegExp(`#${escapedId}(?![\da-f])`, "g"), `#${namespaced}`);
    }
    return `${open}${namespacedCss}${close}`;
  });
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
  mermaid: MermaidApi,
  renderId: string,
  text: string,
  themeVars: Record<string, string | boolean>,
  palette: Palette
): Promise<string> {
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: themeVars,
    securityLevel: "strict",
    fontFamily: "var(--font-sans)",
    sequence: { useMaxWidth: false, showSequenceNumbers: true },
    // Keep flowchart labels in the SVG text layer so their theme color is
    // consistent and sanitization never has to preserve foreignObject HTML.
    flowchart: { useMaxWidth: false, htmlLabels: false },
  });
  const { svg } = await mermaid.render(renderId, text);
  return sanitizeSvg(toMonochrome(sanitizeSvg(svg), palette));
}

async function renderBothThemes(source: string, renderId: string): Promise<{ light: string; dark: string }> {
  return enqueueMermaid(async (mermaid) => {
    const light = await renderDiagram(mermaid, `${renderId}-light`, source, LIGHT_VARS, APP.light);
    const dark = await renderDiagram(mermaid, `${renderId}-dark`, source, DARK_VARS, APP.dark);
    return { light, dark };
  });
}

function cacheKeyFor(source: string): string {
  return `${MERMAID_CACHE_VERSION}:${source}`;
}

export const MermaidNodeView: React.FC<NodeViewProps> = ({ node }) => {
  const isMermaid = node.attrs.language === "mermaid";
  const [rendered, setRendered] = useState<{ source: string; light: string; dark: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFitToWidth, setIsFitToWidth] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const instanceIdRef = useRef(`mm-${Math.random().toString(36).slice(2, 10)}`);
  const requestIdRef = useRef(0);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragStartRef = useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    panX: number;
    panY: number;
  }>({ pointerId: -1, pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const previewRef = useRef<HTMLDivElement>(null);
  const svgSurfaceRef = useRef<HTMLDivElement>(null);
  const rawText = node.textContent.trim();
  const source = normalizeMermaidSource(node.textContent);

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const markCopied = useCallback(() => {
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => {
      copiedTimerRef.current = null;
      setCopied(false);
    }, 2000);
  }, []);

  const handleCopy = useCallback(async () => {
    if (await copyText(rawText)) markCopied();
  }, [markCopied, rawText]);

  // Single source of truth for theme — the store already mirrors data-theme.
  const isDark = useThemeStore((state) => state.effectiveTheme) === "dark";

  useEffect(() => {
    if (!isMermaid) return;
    const requestId = ++requestIdRef.current;
    setError(null);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    if (!source) {
      setRendered(null);
      return;
    }
    const key = cacheKeyFor(source);
    const cached = diagramCache.get(key);
    if (cached) {
      diagramCache.delete(key);
      diagramCache.set(key, cached);
      setRendered({
        source,
        light: namespaceSvgIds(cached.light, instanceIdRef.current),
        dark: namespaceSvgIds(cached.dark, instanceIdRef.current),
      });
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const renderId = `${instanceIdRef.current}-${(++renderSequence).toString(36)}`;
        const pair = await renderBothThemes(source, renderId);
        if (cancelled || requestId !== requestIdRef.current) return;
        setRendered({
          source,
          light: namespaceSvgIds(pair.light, instanceIdRef.current),
          dark: namespaceSvgIds(pair.dark, instanceIdRef.current),
        });
        setError(null);
        diagramCache.delete(key);
        diagramCache.set(key, pair);
        if (diagramCache.size > DIAGRAM_CACHE_LIMIT) {
          const oldest = diagramCache.keys().next();
          if (!oldest.done) diagramCache.delete(oldest.value);
        }
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setError((err as Error)?.message || String(err));
      }
    };
    // Both themes are rendered in one queued operation; debounce source edits.
    const timer = setTimeout(() => void run(), 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, isMermaid]);

  const getClampedPan = (nextPan: { x: number; y: number }, nextZoom: number) => {
    const viewport = previewRef.current;
    const surface = svgSurfaceRef.current;
    if (!viewport || !surface) return nextPan;

    const viewportRect = viewport.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const currentZoom = Math.max(0.01, zoomLevel);
    const baseWidth = surfaceRect.width / currentZoom;
    const baseHeight = surfaceRect.height / currentZoom;
    const baseLeft = surfaceRect.left - viewportRect.left - pan.x;
    const baseTop = surfaceRect.top - viewportRect.top - pan.y;
    const padding = 16;
    const minX = padding - baseLeft - baseWidth * nextZoom;
    const maxX = viewportRect.width - padding - baseLeft;
    const minY = padding - baseTop - baseHeight * nextZoom;
    const maxY = viewportRect.height - padding - baseTop;

    return {
      x: Math.min(maxX, Math.max(minX, nextPan.x)),
      y: Math.min(maxY, Math.max(minY, nextPan.y)),
    };
  };

  const updateZoom = (nextZoom: number, focalPoint?: { x: number; y: number }) => {
    const boundedZoom = Math.max(0.3, Math.min(3, Number(nextZoom.toFixed(2))));
    const currentZoom = Math.max(0.01, zoomLevel);
    const ratio = boundedZoom / currentZoom;
    const viewport = previewRef.current;
    const surface = svgSurfaceRef.current;
    const currentPan = pan;
    let nextPan = currentPan;

    if (focalPoint && viewport && surface) {
      const viewportRect = viewport.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const baseLeft = surfaceRect.left - viewportRect.left - currentPan.x;
      const baseTop = surfaceRect.top - viewportRect.top - currentPan.y;
      nextPan = {
        x: focalPoint.x - baseLeft - (focalPoint.x - baseLeft - currentPan.x) * ratio,
        y: focalPoint.y - baseTop - (focalPoint.y - baseTop - currentPan.y) * ratio,
      };
    }

    setPan(getClampedPan(nextPan, boundedZoom));
    setZoomLevel(boundedZoom);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || isFitToWidth) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      pointerId: e.pointerId,
      pointerX: e.clientX,
      pointerY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isFitToWidth || e.pointerId !== dragStartRef.current.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    setPan(getClampedPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    }, zoomLevel));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== dragStartRef.current.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    dragStartRef.current.pointerId = -1;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isFitToWidth) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const rect = previewRef.current?.getBoundingClientRect();
      const focalPoint = rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : undefined;
      updateZoom(zoomLevel + delta, focalPoint);
    } else {
      e.preventDefault();
      setPan(getClampedPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY }, zoomLevel));
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
      <NodeViewWrapper as="div" className="not-prose my-[18px]">
        <Card className="code-block-card group relative overflow-hidden border bg-transparent shadow-none">
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
              aria-label={`Copy ${label} code`}
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
  const svgHtml = rendered?.source === source
    ? (isDark ? rendered.dark : rendered.light)
    : null;
  const safeSvgHtml = svgHtml ? sanitizeSvg(svgHtml) : null;

  return (
    <NodeViewWrapper as="div" className="not-prose my-[18px]">
        <Card className="code-block-card group relative overflow-hidden border bg-transparent shadow-none">
          {/* Floating actions */}
          <div
            className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border bg-background/80 p-0.5 shadow-sm backdrop-blur transition-opacity opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
            onPointerDown={(event) => event.stopPropagation()}
          >
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
                  aria-label={isFitToWidth ? "Use natural diagram size" : "Fit diagram to width"}
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
                      onClick={() => updateZoom(zoomLevel - 0.15)}
                      aria-label="Zoom out Mermaid diagram"
                      title="Zoom out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => updateZoom(zoomLevel + 0.15)}
                      aria-label="Zoom in Mermaid diagram"
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
                        aria-label="Reset Mermaid diagram view"
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
              aria-label={copied ? "Mermaid code copied" : "Copy Mermaid diagram code"}
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
              onClick={() => setIsEditing((editing) => !editing)}
              aria-label={error ? "Edit Mermaid code" : showCode ? "View Mermaid diagram" : "Edit Mermaid code"}
              title={error ? "Edit Mermaid code" : showCode ? "View diagram" : "Edit code"}
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
            <div role="alert" className="m-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
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
          ref={previewRef}
          className={`mermaid-preview-container ${isDark ? "mermaid-dark" : "mermaid-light"} ${isFitToWidth ? "is-fit" : ""} flex justify-start overflow-hidden`}
          style={{
            display: showCode ? "none" : "flex",
            cursor: isFitToWidth ? "default" : isDragging ? "grabbing" : "grab",
            height: isFitToWidth ? undefined : 560,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
          onWheel={handleWheel}
          title={!isFitToWidth ? "Click and drag to pan across the diagram" : undefined}
        >
          {safeSvgHtml ? (
            <div
              ref={svgSurfaceRef}
              role="img"
              aria-label="Mermaid diagram preview"
              className={`mermaid-svg-surface ${isFitToWidth ? "fit-width" : "natural-width"} flex justify-center mx-auto my-0`}
              style={{
                transform: isFitToWidth ? undefined : `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                transformOrigin: "0 0",
                userSelect: isDragging ? "none" : "auto",
                pointerEvents: isDragging ? "none" : "auto",
              }}
              dangerouslySetInnerHTML={{ __html: safeSvgHtml }}
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
