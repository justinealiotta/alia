/* ───────────────────────────────────────────────────────────────────────────
   AliaAvatar — the canonical avatar block. ONE block, two modes:

   • plain (default): a round avatar image — `<div class="avatar"><img></div>`,
     the exact markup the feed has always used, so all existing `.avatar` styling
     applies unchanged. It LIFTS OUT on pinch / ctrl-wheel (the same real-element
     gesture as a feed photo, via useZoomHold) — no clone, no lightbox; `onClick`
     covers a container tap (e.g. a menu toggle).
   • crop (`crop`): the circular cropper — drag to pan, pinch/wheel to zoom, tap
     (no drag) to re-pick from the device. Used by Casting / Profile / Referral-
     Flow. `className` carries the host's sizing; the live crop (src + width /
     height / transform) can be read off the <img> for persistence.

   The display name is its own block, <AliaName>, placed next to <AliaAvatar>
   as items in a message row.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useZoomHold } from '../media';

export interface AliaAvatarProps {
  src?: string;
  /** stable block id (data-block-id) — the universal per-block identity every
   *  Alia block carries; on a card avatar this is the member's avatar slot. */
  id?: string;
  /** cropper variant (pan / zoom / re-pick) */
  crop?: boolean;
  /** crop only: freeze pan/zoom/re-pick */
  locked?: boolean;
  /** host sizing hook (e.g. `.prof-seed-avatar`); plain mode adds it to `.avatar` */
  className?: string;
  /** plain only: tap on the avatar container (e.g. toggle a menu) */
  onClick?: (e: React.MouseEvent) => void;
  /** plain only: inline style passthrough (e.g. cursor) */
  style?: React.CSSProperties;
  alt?: string;
  /** plain only: lift the avatar out on pinch / ctrl-wheel (feed behaviour). */
  zoomable?: boolean;
  /** crop only: fires on any user crop change (pan / zoom / re-pick) so hosts
     can autosave. NOT fired on initial load / resize reflow. */
  onCropChange?: () => void;
}

/* ── Crop mode ──────────────────────────────────────────────────────────────
   Circular avatar cropper: the member photo fills a round viewport, dead-centre;
   drag to pan (clamped to bounds), pinch / wheel to zoom (1–3×), tap to re-pick.
   Renders `.<className> .av-crop`; the seed pages read the crop off the <img>. */
function CropAvatar({ src, id, locked = false, className = 'cast-seed-avatar', onCropChange }:
  { src: string; id?: string; locked?: boolean; className?: string; onCropChange?: () => void }) {
  const changeRef = useRef(onCropChange);
  changeRef.current = onCropChange;
  const viewRef = useRef<HTMLSpanElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const [imgSrc, setImgSrc] = useState(src);
  const st = useRef({ D: 0, ratio: 1, zoom: 1, tx: 0, ty: 0 });

  const pickPhoto = useCallback(() => fileRef.current?.click(), []);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (f) { setImgSrc(URL.createObjectURL(f)); changeRef.current?.(); }
    e.target.value = '';
  };

  const dimsFor = useCallback((z: number) => {
    const { D, ratio } = st.current;
    return ratio >= 1 ? { w: D * z * ratio, h: D * z } : { w: D * z, h: D * z / ratio };
  }, []);
  const clampPos = useCallback(() => {
    const s = st.current; const { w, h } = dimsFor(s.zoom);
    const mx = Math.max(0, (w - s.D) / 2), my = Math.max(0, (h - s.D) / 2);
    s.tx = Math.min(mx, Math.max(-mx, s.tx)); s.ty = Math.min(my, Math.max(-my, s.ty));
  }, [dimsFor]);
  const apply = useCallback(() => {
    const el = imgRef.current; if (!el) return;
    const s = st.current; const { w, h } = dimsFor(s.zoom);
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.transform = `translate(calc(-50% + ${s.tx}px), calc(-50% + ${s.ty}px))`;
  }, [dimsFor]);
  const reflow = useCallback(() => {
    const v = viewRef.current; if (!v) return;
    st.current.D = v.getBoundingClientRect().width;
    clampPos(); apply();
  }, [clampPos, apply]);

  useEffect(() => {
    const v = viewRef.current, el = imgRef.current; if (!v || !el) return;
    const ready = () => {
      const s = st.current;
      s.D = v.getBoundingClientRect().width;
      s.ratio = (el.naturalWidth / el.naturalHeight) || 1;
      s.zoom = 1; s.tx = 0; s.ty = 0;
      clampPos(); apply();
    };
    el.addEventListener('load', ready);
    if (el.complete && el.naturalWidth) ready();

    const pts = new Map<number, { x: number; y: number }>();
    let sx = 0, sy = 0, ox = 0, oy = 0, pinchDist = 0, pinchZoom = 1, moved = false;
    const dist2 = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const setZoom = (z: number) => { st.current.zoom = Math.min(3, Math.max(1, z)); clampPos(); apply(); changeRef.current?.(); };
    const release = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size === 1) { const [p] = [...pts.values()]; sx = p.x; sy = p.y; ox = st.current.tx; oy = st.current.ty; }
    };
    const down = (e: PointerEvent) => {
      if (lockedRef.current) return;
      e.stopPropagation(); e.preventDefault();
      try { v.setPointerCapture(e.pointerId); } catch {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { sx = e.clientX; sy = e.clientY; ox = st.current.tx; oy = st.current.ty; moved = false; }
      else if (pts.size === 2) { pinchDist = dist2(); pinchZoom = st.current.zoom; moved = true; }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) { const d = dist2(); if (pinchDist > 0) setZoom(pinchZoom * (d / pinchDist)); }
      else {
        if (Math.hypot(e.clientX - sx, e.clientY - sy) > 5) moved = true;
        st.current.tx = ox + (e.clientX - sx); st.current.ty = oy + (e.clientY - sy); clampPos(); apply();
        if (moved) changeRef.current?.();
      }
    };
    const up = (e: PointerEvent) => {
      const tap = pts.size === 1 && !moved;
      release(e);
      if (tap) pickPhoto();
    };
    const wheel = (e: WheelEvent) => { if (lockedRef.current) return; e.preventDefault(); setZoom(st.current.zoom * (1 - e.deltaY * 0.0015)); };

    v.addEventListener('pointerdown', down);
    v.addEventListener('pointermove', move);
    v.addEventListener('pointerup', up);
    v.addEventListener('pointercancel', release);
    v.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('resize', reflow);
    return () => {
      el.removeEventListener('load', ready);
      v.removeEventListener('pointerdown', down);
      v.removeEventListener('pointermove', move);
      v.removeEventListener('pointerup', up);
      v.removeEventListener('pointercancel', release);
      v.removeEventListener('wheel', wheel);
      window.removeEventListener('resize', reflow);
    };
  }, [reflow, dimsFor, clampPos, apply, pickPhoto]);

  return (
    <span
      className={className + ' av-crop' + (imgSrc ? '' : ' is-empty') + (locked ? ' is-locked' : '')}
      data-block-id={id}
      ref={viewRef}
    >
      <img ref={imgRef} src={imgSrc} alt="" draggable={false} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </span>
  );
}

/* Plain avatar — a round feed avatar that LIFTS OUT on pinch / ctrl-wheel, the
   SAME real-element gesture as a feed photo (useZoomHold). No clone, no lightbox.
   While held it un-rounds (`.held`, see messages.css) so you see the WHOLE photo
   at its natural aspect instead of the circular cover-crop. */
function PlainAvatar({ src, id, className, onClick, style, alt, zoomable = true }:
  { src?: string; id?: string; className?: string; onClick?: (e: React.MouseEvent) => void; style?: React.CSSProperties; alt?: string; zoomable?: boolean }) {
  const { rootRef, screenRef, held, closeHold, zoomGuard, rootStyle } = useZoomHold(!!src && zoomable);
  const node = (
    <div
      ref={rootRef}
      className={'avatar' + (className ? ' ' + className : '') + (held ? ' held' : '')}
      data-block-id={id}
      onClick={onClick}
      style={{ ...(style || {}), ...(rootStyle || {}) }}
    >
      {src ? (
        <img
          ref={screenRef as unknown as React.RefObject<HTMLImageElement>}
          src={src}
          alt={alt}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onClick={held ? (e) => { e.stopPropagation(); if (zoomGuard.current) return; closeHold(); } : undefined}
        />
      ) : null}
    </div>
  );
  return (
    <React.Fragment>
      {held ? <div key="bd" className="av-zoom-backdrop" onClick={closeHold} /> : null}
      {React.cloneElement(node, { key: 'av' })}
    </React.Fragment>
  );
}

export default function AliaAvatar({ src, id, crop, locked = false, className = '', onClick, style, alt = '', zoomable = true, onCropChange }: AliaAvatarProps) {
  if (crop) return <CropAvatar src={src ?? ''} id={id} locked={locked} className={className || undefined} onCropChange={onCropChange} />;
  return <PlainAvatar src={src} id={id} className={className} onClick={onClick} style={style} alt={alt} zoomable={zoomable} />;
}
