import { useRef, useEffect, useState } from "react";

export const CanvasPane: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<"pen" | "rect" | "arrow">("pen");
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // dotted grid + simple draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // background + grid (match vibrant muted)
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // draw dotted grid
    ctx.fillStyle = "rgba(107,114,128,0.18)";
    const gap = 20;
    for (let y = gap; y < rect.height; y += gap) {
      for (let x = gap; x < rect.width; x += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // subtle border
    ctx.strokeStyle = "rgba(234,234,234,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, rect.width - 1, rect.height - 1);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = (e as React.TouchEvent).touches?.[0]?.clientX ?? (e as React.MouseEvent).clientX;
    const clientY = (e as React.TouchEvent).touches?.[0]?.clientY ?? (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    const prev = lastPos.current;
    if (!prev) {
      lastPos.current = pos;
      return;
    }

    ctx.strokeStyle = "#0F0F0F";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "pen") {
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
    } else if (tool === "rect") {
      // preview handled on move? For simplicity, draw line segment
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(prev.x, prev.y, pos.x - prev.x, pos.y - prev.y);
      ctx.setLineDash([]);
    } else if (tool === "arrow") {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      // arrow head
      const angle = Math.atan2(pos.y - prev.y, pos.x - prev.x);
      const len = 8;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x - len * Math.cos(angle - Math.PI / 6), pos.y - len * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x - len * Math.cos(angle + Math.PI / 6), pos.y - len * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      lastPos.current = pos;
    }
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "rgba(107,114,128,0.18)";
    const gap = 20;
    for (let y = gap; y < rect.height; y += gap) {
      for (let x = gap; x < rect.width; x += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  return (
    <div className="pane-canvas">
      <div className="canvas-toolbar">
        <div className="canvas-tool-group" role="group" aria-label="Canvas tools">
          <button className={`canvas-tool-btn ${tool === "pen" ? "is-active" : ""}`} onClick={() => setTool("pen")} title="Pen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 20H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 4L19 8L8.5 18.5H4V14L15 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            Pen
          </button>
          <button className={`canvas-tool-btn ${tool === "rect" ? "is-active" : ""}`} onClick={() => setTool("rect")} title="Rectangle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Rect
          </button>
          <button className={`canvas-tool-btn ${tool === "arrow" ? "is-active" : ""}`} onClick={() => setTool("arrow")} title="Arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M13 7L18 12L13 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Arrow
          </button>
        </div>
        <div className="canvas-actions">
          <button className="canvas-action-btn" onClick={handleClear}>
            Clear
          </button>
          <span className="canvas-hint">Excalidraw integration stub — replace canvas with `&lt;Excalidraw /&gt;` when you add `@excalidraw/excalidraw`</span>
        </div>
      </div>
      <div className="canvas-stage">
        <canvas
          ref={canvasRef}
          className="canvas-element"
          width={600}
          height={400}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>
    </div>
  );
};
