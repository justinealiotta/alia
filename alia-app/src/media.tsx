/* ───────────────────────────────────────────────────────────────────────────
   media.tsx — shared media primitives used by the block components.
   Extracted VERBATIM from the original MessageBlocks so the feed renders
   pixel-identically: the <Img> element, the Save button + save-to-device
   behaviour, and the justified-rows packer used by AliaPhotoGrid.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useState, useRef, useEffect } from 'react';
export function Img({ src, label }: { src?: string; label?: string }) {
  if (!src) return <div className="img-ph" data-label={label || ''} />;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    />
  );
}

/* ── Zoom-to-hold ────────────────────────────────────────────────────────────
   The gesture that lifts the REAL media element out of the feed IN PLACE: pinch
   (touch) or ctrl-wheel (trackpad) grows the actual node with a CSS transform
   (scale + pan) from its own centre; one-finger / mouse drag pans; click / Esc /
   a tap on the transparent backdrop puts it back. Shared VERBATIM by AliaVideo,
   PhotoHold and the avatar so a photo, a clip and an avatar behave identically —
   no lightbox, no clone, no position:fixed copy.

   Because it's a plain transform (not position:fixed), layout never shifts, so
   nothing holds the slot. z-index (via rootStyle) lifts it above neighbours and
   un-clipped ancestors let it grow past the narrow column. Holdable cells avoid
   transformed ancestors so none becomes an unexpected containing block. */
export interface HeldRect { left: number; top: number; width: number; height: number }
const ZH_MIN = 1, ZH_MAX = 8, ZH_CLOSE = 0.85;

export function useZoomHold(zoomable: boolean, onEngage?: () => void, onClose?: () => void) {
  const rootRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  const [heldRect] = useState<HeldRect | null>(null);   // always null now — no fixed-rect placeholder (kept for API shape)
  const [anim, setAnim] = useState(false);
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomGuard = useRef(false);
  const unclipRef = useRef<null | (() => void)>(null);
  const raisedRef = useRef<null | (() => void)>(null);
  useEffect(() => { heldRef.current = held; }, [held]);

  const applyTransform = () => {
    if (rootRef.current) rootRef.current.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${scaleRef.current})`;
  };

  /* Un-clip pure clipping ancestors (overflow:hidden/clip) so the growing REAL
     element isn't cut off by the narrow message column. Scroll containers
     (auto/scroll) are left ALONE — flipping them to visible would jump their
     scroll position, and they clip at the screen edge anyway, which is fine. */
  const unclipAncestors = () => {
    const el = rootRef.current; if (!el) return;
    const saved: { el: HTMLElement; ox: string; oxx: string; oxy: string }[] = [];
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      const all = cs.overflow + ' ' + cs.overflowX + ' ' + cs.overflowY;
      if (/hidden|clip/.test(all) && !/auto|scroll/.test(all)) {
        saved.push({ el: p, ox: p.style.overflow, oxx: p.style.overflowX, oxy: p.style.overflowY });
        p.style.overflow = 'visible';
      }
      p = p.parentElement;
    }
    unclipRef.current = saved.length
      ? () => saved.forEach((s) => { s.el.style.overflow = s.ox; s.el.style.overflowX = s.oxx; s.el.style.overflowY = s.oxy; })
      : null;
  };
  const reclipAncestors = () => { if (unclipRef.current) { unclipRef.current(); unclipRef.current = null; } };

  /* Lift the media's ancestor chain above the sticker layer WHILE HELD. Stickers
     are portaled into the feed at z 30+ (and climb as they're dragged), and the
     media's own z (rootStyle) is trapped inside its `.col` query-container
     stacking context — so a resting sticker correctly sits ON the media, but a
     PINCH-ZOOMED clip/photo must rise ABOVE every sticker. Raising each ancestor
     up to (not including) the scroll container gives the media's subtree a
     stacking context that beats any sticker; restored on close. */
  const raiseAncestors = () => {
    const el = rootRef.current; if (!el) return;
    const saved: { el: HTMLElement; pos: string; z: string }[] = [];
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) break;   // the feed scroller — stop here
      saved.push({ el: p, pos: p.style.position, z: p.style.zIndex });
      if (cs.position === 'static') p.style.position = 'relative';
      p.style.zIndex = '100000';
      p = p.parentElement;
    }
    raisedRef.current = saved.length ? () => saved.forEach((s) => { s.el.style.position = s.pos; s.el.style.zIndex = s.z; }) : null;
  };
  const lowerAncestors = () => { if (raisedRef.current) { raisedRef.current(); raisedRef.current = null; } };

  /* Lift the REAL element in place: no position:fixed, no rect capture, no
     placeholder, no clone. A CSS transform (scale + pan) grows the actual node
     from its own centre; since transforms don't affect layout, the feed doesn't
     shift, so nothing needs to hold its slot. z-index (via rootStyle) lifts it
     above neighbours and un-clipped ancestors let it grow past the column. This
     also sidesteps the position:fixed containing-block bug that put the lifted
     copy in the wrong place (reading as a duplicate) inside a scaled webview. */
  const enterHeld = () => {
    const el = rootRef.current; if (!el) return;
    scaleRef.current = 1; panRef.current = { x: 0, y: 0 };
    setAnim(false);
    unclipAncestors();
    raiseAncestors();
    heldRef.current = true; setHeld(true);
    (window as any).__aliaZoomActive = true;   // drawer swipe stands down while lifted
    onEngage?.();
    requestAnimationFrame(applyTransform);
  };
  const closeHold = () => {
    setAnim(true);
    scaleRef.current = 1; panRef.current = { x: 0, y: 0 }; applyTransform();
    window.setTimeout(() => {
      heldRef.current = false; setHeld(false); setAnim(false);
      reclipAncestors();
      lowerAncestors();
      if (rootRef.current) rootRef.current.style.transform = '';
      (window as any).__aliaZoomActive = false; onClose?.();
    }, 300);
  };
  const armZoomGuard = () => { zoomGuard.current = true; window.setTimeout(() => { zoomGuard.current = false; }, 200); };

  /* pinch = zoom in place · one-finger / mouse drag = pan · click = handled by
     the caller. NATIVE non-passive listeners so the browser can't cancel it. */
  useEffect(() => {
    const el = screenRef.current; if (!el || !zoomable) return;
    let d0 = 0, baseScale = 1, pinching = false, lastScale = 1;
    let dragging = false, sx = 0, sy = 0, bpx = 0, bpy = 0, dragMoved = false;
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const setScale = (s: number) => { scaleRef.current = Math.max(0.4, Math.min(s, ZH_MAX)); applyTransform(); };
    const startPan = (x: number, y: number) => { dragging = true; dragMoved = false; sx = x; sy = y; bpx = panRef.current.x; bpy = panRef.current.y; };
    const movePan = (x: number, y: number) => {
      if (!dragging) return;
      const dx = x - sx, dy = y - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
      panRef.current = { x: bpx + dx, y: bpy + dy }; applyTransform();
    };
    const endPan = () => { if (dragging && dragMoved) armZoomGuard(); dragging = false; };

    const onTargetIsScrub = (t: EventTarget | null) => !!(t && (t as HTMLElement).closest && (t as HTMLElement).closest('.av-track'));
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinching = true; dragging = false;
        d0 = dist(e.touches[0], e.touches[1]) || 1;
        if (!heldRef.current) enterHeld();
        baseScale = scaleRef.current; lastScale = baseScale;
        onEngage?.();
        e.preventDefault();
      } else if (e.touches.length === 1 && heldRef.current) {
        if (onTargetIsScrub(e.target)) return;   // the hairline owns this drag — scrub, don't pan
        startPan(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (pinching && e.touches.length >= 2) {
        e.preventDefault();
        lastScale = baseScale * (dist(e.touches[0], e.touches[1]) / d0);
        setScale(lastScale);
      } else if (dragging && e.touches.length === 1) {
        e.preventDefault();
        movePan(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length >= 1) return;
      if (pinching) {
        pinching = false; armZoomGuard();
        if (heldRef.current && (lastScale < ZH_CLOSE || (scaleRef.current <= 1.05 && baseScale > 1.05))) closeHold();
        else if (scaleRef.current < ZH_MIN) { scaleRef.current = ZH_MIN; setAnim(true); applyTransform(); requestAnimationFrame(() => setAnim(false)); }
      }
      endPan();
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (!heldRef.current) enterHeld();
      onEngage?.();
      const cur = scaleRef.current;
      const next = cur * Math.exp(-e.deltaY * 0.01);
      if (heldRef.current && next <= 1.03 && cur > 1.03) { closeHold(); return; }
      setScale(Math.max(ZH_MIN, next));
    };
    const onPointerDown = (e: PointerEvent) => { if (e.pointerType === 'mouse' && heldRef.current && !onTargetIsScrub(e.target)) startPan(e.clientX, e.clientY); };
    const onPointerMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') movePan(e.clientX, e.clientY); };
    const onPointerUp = (e: PointerEvent) => { if (e.pointerType === 'mouse') endPan(); };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomable]);

  /* held: Esc closes · a tap ANYWHERE outside the lifted element closes too.
     The sibling .av-zoom-backdrop is clamped to the feed column (CSS multicol
     clamps fixed/absolute descendants to the column width), so it can't catch a
     tap in the letterbox beside a lifted photo/clip. This document-level listener
     covers the whole viewport regardless: a pointerdown whose target isn't inside
     the lifted root — and isn't part of a pan/pinch (zoomGuard) — puts it back. */
  useEffect(() => {
    if (!held) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeHold(); };
    const onDocDown = (e: PointerEvent) => {
      if (zoomGuard.current) return;
      const root = rootRef.current;
      if (root && e.target instanceof Node && root.contains(e.target)) return;   // on the media → its own gesture/handlers own it
      closeHold();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDocDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDocDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  const rootStyle: React.CSSProperties | undefined = held
    ? { position: 'relative', zIndex: 90, transformOrigin: 'center center', willChange: 'transform', transition: anim ? 'transform .3s cubic-bezier(.22,.8,.18,1)' : 'none' }
    : undefined;

  return { rootRef, screenRef, held, heldRect, anim, closeHold, zoomGuard, rootStyle };
}

/* ── Justified-rows packer ───────────────────────────────────────────────────
   Packs images into flush rows: every image in a row shares one height and the
   row fills the column width exactly; nothing is cropped (each cell sized to its
   native ratio). Extracted verbatim from the feed gallery. */
/* A row never holds more than this — the cap. Applies in AUTO packing and as a
   safety ceiling on MANUAL rows. Shared by the feed (AliaMediaGrid) and the
   composer gallery so both read identically. */
export const MAX_PER_ROW = 3;
export interface GalItem { src?: string; label?: string; aspect?: number; rowBreak?: boolean }
export interface GalRow { items: GalItem[]; ratios: number[]; h: number; fill: boolean }
export function justifiedRows(items: GalItem[], ratios: number[], W: number, gap: number, targetH?: number): GalRow[] {
  if (!W || !items.length) return [];
  const rOf = (i: number) => ratios[i] || 1 / 1.2;
  const target = targetH || Math.min(460, W * 0.66);
  const maxH = W * 1.25;
  const rowH = (idxs: number[]) => (W - gap * (idxs.length - 1)) / idxs.reduce((a, i) => a + rOf(i), 0);
  const rowsIdx: Array<{ idxs: number[]; h: number; fill: boolean }> = [];

  /* MANUAL mode — the run carries explicit breaks the author set by dragging (a
     cell past index 0 flagged rowBreak). Honor them exactly: start a new row at
     each flagged cell (and at the cap), justify every row to fill the width. No
     auto width-target, no orphan merge — the author's split wins. */
  const manual = items.some((it, i) => i > 0 && it.rowBreak);
  if (manual) {
    let row: number[] = [];
    const flush = () => { if (!row.length) return; const full = rowH(row); rowsIdx.push({ idxs: row, h: Math.min(full, maxH), fill: full <= maxH }); row = []; };
    items.forEach((it, i) => {
      if (row.length && (it.rowBreak || row.length >= MAX_PER_ROW)) flush();
      row.push(i);
    });
    flush();
    return rowsIdx.map((r) => ({ items: r.idxs.map((i) => items[i]), ratios: r.idxs.map((i) => rOf(i)), h: r.h, fill: r.fill }));
  }

  /* AUTO mode — a lone photo fills the column at its natural ratio; 2+ pack into
     rows of ONLY 2 or 3 (never a stranded single), each justified to fill the
     width. Row counts come from a fixed partition of N into 2s and 3s so the
     result never depends on ratios — no orphan can ever appear. */
  if (items.length === 1) {
    const full = rowH([0]);
    rowsIdx.push(full <= maxH ? { idxs: [0], h: full, fill: true } : { idxs: [0], h: target, fill: false });
  } else {
    const sizes: number[] = [];
    let n = items.length;
    while (n > 0) {
      if (n === 2) { sizes.push(2); n = 0; }
      else if (n === 4) { sizes.push(2, 2); n = 0; }   // avoid 3+1
      else { sizes.push(3); n -= 3; }                  // 5→3+2, 7→3+2+2, 8→3+3+2 …
    }
    let idx = 0;
    for (const s of sizes) {
      const idxs: number[] = [];
      for (let j = 0; j < s; j++) idxs.push(idx++);
      rowsIdx.push({ idxs, h: rowH(idxs), fill: true });
    }
  }
  return rowsIdx.map((r) => ({ items: r.idxs.map((i) => items[i]), ratios: r.idxs.map((i) => rOf(i)), h: r.h, fill: r.fill }));
}
