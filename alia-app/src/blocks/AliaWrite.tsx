/* ───────────────────────────────────────────────────────────────────────────
   AliaWrite — the canonical handwriting block: draw → tidy → die-cut ink.

   Two parts, same block:
     • <AliaWrite paths vb width /> — the finished ink sticker body (the tidied
       strokes as a die-cut SVG). Used on the sticker surface (drawer maker) and
       in the room feed (placed presence stickers).
     • <AliaWritePad onCommit /> — the compose pad: write white on a bounded
       black cell; 5s after you stop, the "AI" pass tidies the polyline (midpoint
       smoothing, done honestly with math) and reports { paths, vb, w } up.

   Markup / classNames match stickers.css exactly (.stk-ink-sticker /
   .stk-ink-cell / .stk-ink-live / .stk-ink-hint); the die-cut contour is the
   #stk-diecut filter the host mounts once.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useEffect, useRef, useState } from 'react';

const clampW = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* Smooth a raw finger polyline into a clean quadratic path (midpoint
   smoothing). A lone tap becomes a tiny dot. */
export function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (!pts.length) return '';
  if (pts.length < 3) {
    const a = pts[0], b = pts[pts.length - 1];
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${(b.x + 0.1).toFixed(1)} ${b.y.toFixed(1)}`;
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

export interface InkData { paths: string[]; vb: string; w: number; }

/* ── The finished ink sticker body ─────────────────────────────────────────── */
export default function AliaWrite({ paths, vb, width }: { paths: string[]; vb: string; width?: number }) {
  return (
    <div className="stk-ink-sticker" style={{ width: (width || 160) + 'px' }}>
      <svg viewBox={vb} xmlns="http://www.w3.org/2000/svg">
        {(paths || []).map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#141414" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
}

/* ── The compose pad ───────────────────────────────────────────────────────── */
export function AliaWritePad({ onCommit }: { onCommit: (d: InkData) => void }) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const strokesRef = useRef<Array<Array<{ x: number; y: number }>>>([]);
  const on = useRef(false);
  const idle = useRef<any>(null);

  useEffect(() => () => clearTimeout(idle.current), []);

  const point = (e: React.PointerEvent) => {
    const r = padRef.current!.getBoundingClientRect();
    return { x: clampW(e.clientX - r.left, 0, r.width), y: clampW(e.clientY - r.top, 0, r.height) };
  };
  const down = (e: React.PointerEvent) => {
    e.stopPropagation();
    clearTimeout(idle.current);
    try { padRef.current?.setPointerCapture(e.pointerId); } catch (_e) {}
    on.current = true;
    const p = point(e);
    setStrokes((s) => { const n = [...s, [p]]; strokesRef.current = n; return n; });
  };
  const move = (e: React.PointerEvent) => {
    if (!on.current) return;
    e.stopPropagation();
    const p = point(e);
    setStrokes((s) => { if (!s.length) return s; const n = s.slice(); n[n.length - 1] = [...n[n.length - 1], p]; strokesRef.current = n; return n; });
  };
  const up = () => {
    if (!on.current) return;
    on.current = false;
    clearTimeout(idle.current);
    idle.current = window.setTimeout(commit, 5000);   // AI tidies 5s after you stop
  };
  const commit = () => {
    const pts = strokesRef.current.filter((s) => s.length);
    if (!pts.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach((s) => s.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }));
    const PAD = 26;
    minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    const dispW = clampW(Math.round(150 * (w / h)), 100, 300);
    onCommit({ paths: pts.map(smoothPath), vb: `${minX.toFixed(1)} ${minY.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`, w: dispW });
  };

  return (
    <div
      ref={padRef}
      className="stk-ink-cell"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <svg className="stk-ink-live" xmlns="http://www.w3.org/2000/svg">
        {strokes.map((st, i) => (
          <path key={i} d={smoothPath(st)} fill="none" stroke="#fff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      {strokes.length === 0 ? <div className="stk-ink-hint">write</div> : null}
    </div>
  );
}
