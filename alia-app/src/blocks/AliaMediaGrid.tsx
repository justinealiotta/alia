/* ───────────────────────────────────────────────────────────────────────────
   AliaMediaGrid — the canonical feed media block AND the one arranger for a set
   of AliaPhoto / AliaVideo atoms. It packs them into ONE justified grid (shared
   packer, capped at MAX_PER_ROW) so photos and videos share the same rows.

   It is MADE OF the atoms — it owns layout, not the cells:
     • display (feed)      → cells are <AliaPhoto> (lifts on pinch) + <AliaVideo
                             controls zoomable> (plays in place).
     • controlled gallery  → the composer owns the items + cross-block drag; we
       (`gallery`)           render each cell static (<AliaPhoto zoomable=false>
                             / <AliaVideo thumbnail>) with the caller's pointer
                             hooks, honoring author-set row breaks.
     • editable (`editable`)→ the apply card: owns its own shots, upload,
                             drag-reorder, tap-remove, file-drop. `photosOnly`
                             rejects video (a comp card is photos).

   Single item keeps its bespoke full-width treatment. Row layout for every mode
   runs through justifiedRows (media.tsx) so the composer preview and the sent
   feed are provably identical. ──────────────────────────────────────────────── */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { justifiedRows, GalItem, MAX_PER_ROW } from '../media';
import AliaPhoto from './AliaPhoto';
import AliaVideo, { Caption } from './AliaVideo';
import { nextId } from '../utils';

const MG_GAP = 4;

/* One cell of the grid — a photo or a video. Videos carry the extra fields the
   full <AliaVideo> needs. */
export interface MediaCell {
  kind?: 'photo' | 'video';
  src?: string;
  label?: string;
  aspect?: number;             // height / width (matches GalItem.aspect)
  w?: number;
  h?: number;
  duration?: number;
  captions?: Caption[];
  captionsSrc?: string;
  attention?: number;
  rowBreak?: boolean;          // author-set: this cell starts a new row
}

/* A controlled gallery cell (composer) — the caller owns it and the drag. */
export interface GalCell { id: string; src?: string; aspect?: number; kind?: 'photo' | 'video'; captionsSrc?: string; rowBreak?: boolean; }

/* An editable (apply) shot — owns its own id + native ratio string. */
export interface MMIPhoto { id: string; src: string; ratio: string; }

interface AliaMediaGridProps {
  /* display (feed / composer single + preview) */
  items?: MediaCell[];
  w?: number;
  h?: number;
  /** render display cells static (no pinch-zoom) — the composer preview. */
  staticCells?: boolean;
  /** 'masonry' = the room's 2-col CSS multicol (feed + composer); 'justified'
      (default) = the apply card's flush justified rows. */
  layout?: 'justified' | 'masonry';
  /** masonry display (feed): stamp each cell's data-block-index for pick-up. */
  blockIndexStart?: number;
  /** masonry display (feed): render extra content under a cell (block replies). */
  renderCellAfter?: (index: number) => React.ReactNode;
  /* controlled gallery (composer) */
  gallery?: boolean;
  cells?: GalCell[];
  activeDragId?: string | null;
  gapClass?: string;
  onCellPointerDown?: (e: React.PointerEvent, id: string) => void;
  /** composer gallery: remove a cell (rendered as a top-right corner hot zone). */
  onCellRemove?: (id: string) => void;
  /** display single-cell (composer draft / quote): remove the WHOLE block via a
      hot zone anchored to the PHOTO box, not the full-width row. */
  onRemove?: () => void;
  /* editable (apply card) */
  editable?: boolean;
  photosOnly?: boolean;
  locked?: boolean;
  min?: number;
  max?: number;
  /** seed the grid once on mount (restored draft) */
  initial?: MMIPhoto[];
  onChange?: (shots: MMIPhoto[]) => void;
}

const isVideo = (c: MediaCell) => c.kind === 'video';
const MG_IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;

export default function AliaMediaGrid(props: AliaMediaGridProps) {
  if (props.gallery) return <ComposerGallery cells={props.cells || []} activeDragId={props.activeDragId ?? null} onCellPointerDown={props.onCellPointerDown} onCellRemove={props.onCellRemove} gapClass={props.gapClass || ''} layout={props.layout} />;
  if (props.editable) return <EditableGrid initial={props.initial} locked={props.locked} min={props.min ?? MMI_MIN} max={props.max ?? MMI_MAX} onChange={props.onChange} />;

  const items = props.items || [];
  const staticCells = !!props.staticCells;

  /* Room = 2-col CSS-multicol masonry (feed messages + composer draft). */
  if (props.layout === 'masonry') return <MasonryDisplay items={items} blockIndexStart={props.blockIndexStart} renderCellAfter={props.renderCellAfter} />;

  /* Apply / single / quote = justified flush rows. A single item is NOT
     special-cased — it runs through the SAME justifiedRows packer as 2+ items. */
  return <MediaGridRows items={items} staticCells={staticCells} onRemove={props.onRemove} />;
}

/* ── Masonry (the room: feed messages + composer draft) ───────────────────
   The room's media block group: a 2-column CSS-multicol grid (styled by
   room.css .masonry-grid / .masonry-block), nothing cropped. Cells are the live
   atoms (AliaPhoto pinch-zoom, AliaVideo controls). The feed passes
   blockIndexStart (block pick-up) + renderCellAfter (per-cell block replies). */
function MasonryDisplay({ items, blockIndexStart, renderCellAfter }: { items: MediaCell[]; blockIndexStart?: number; renderCellAfter?: (index: number) => React.ReactNode }) {
  return (
    <div className="masonry-grid">
      {items.map((cell, k) => (
        <div className="masonry-block" key={k} data-block-index={blockIndexStart != null ? blockIndexStart + k : undefined}>
          {isVideo(cell)
            ? <AliaVideo src={cell.src} label={cell.label} w={cell.w} h={cell.h} duration={cell.duration} captions={cell.captions} captionsSrc={cell.captionsSrc} controls autoplay zoomable />
            : <AliaPhoto src={cell.src} label={cell.label} />}
          {renderCellAfter ? renderCellAfter(k) : null}
        </div>
      ))}
    </div>
  );
}

/* ── Multi — justified rows shared by photos + videos (feed / preview) ──────── */
function MediaGridRows({ items, staticCells, onRemove }: { items: MediaCell[]; staticCells: boolean; onRemove?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);
  const initRatio = (c: MediaCell) =>
    c.aspect ? 1 / c.aspect : (c.w && c.h ? c.w / c.h : 1 / 1.2);
  const [ratios, setRatios] = useState<number[]>(() => items.map(initRatio));

  useEffect(() => {
    const el = ref.current; if (!el) { setCw(0); return; }
    const measure = () => setCw(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [items.length]);

  useEffect(() => {
    let live = true;
    setRatios(items.map(initRatio));
    items.forEach((it, i) => {
      const useImg = it.src && (!isVideo(it) || MG_IMG_EXT.test(it.src));
      if (useImg) {
        const im = new Image();
        im.onload = () => { if (!live) return; setRatios((r) => { const n = r.slice(); n[i] = im.naturalWidth / im.naturalHeight; return n; }); };
        im.src = it.src!;
      } else if (isVideo(it) && it.src) {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => { if (!live || !v.videoWidth) return; setRatios((r) => { const n = r.slice(); n[i] = v.videoWidth / v.videoHeight; return n; }); };
        v.src = it.src;
      }
    });
    return () => { live = false; };
  }, [items]);

  const ratioOf = (idx: number) => ratios[idx] ?? (items[idx]?.aspect ? 1 / items[idx]!.aspect! : 1 / 1.2);
  /* composer draft / quote: the remove hot zone lives INSIDE the photo box so it
     always lands on the top-right corner of the shot — never out in the black of
     a left-aligned row. Only these single-cell display paths pass onRemove. */
  const removeCorner = onRemove ? (
    <button
      type="button"
      className="rb-remove-hot"
      aria-label="remove"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
    />
  ) : null;

  /* pack a contiguous run of NON-open cells (each carrying its original index) */
  const renderRun = (run: Array<{ index: number; cell: MediaCell }>, keyBase: string) => {
    const gal: GalItem[] = run.map((c) => ({ src: c.cell.src, label: c.cell.label, aspect: c.cell.aspect, rowBreak: c.cell.rowBreak }));
    const rs = run.map((c) => ratioOf(c.index));
    const rows = justifiedRows(gal, rs, cw, MG_GAP);
    let k = 0;
    return rows.map((row, ri) => {
      const rowCells = run.slice(k, k + row.items.length); k += row.items.length;
      return (
        <div className="imgs-row" key={keyBase + '-' + ri} style={{ height: row.h, justifyContent: 'flex-start' }}>
          {rowCells.map((c, ci) => {
            const cellW = row.h * row.ratios[ci];
            const cell = c.cell;
            if (isVideo(cell)) {
              return (
                <div className="img-wrap media-video-cell" key={c.index} data-media="video" style={{ width: cellW, height: row.h, flex: '0 0 auto', position: 'relative' }}>
                  <AliaVideo src={cell.src} label={cell.label} w={cell.w} h={cell.h} duration={cell.duration} captions={cell.captions} captionsSrc={cell.captionsSrc} attention={cell.attention} controls autoplay zoomable={!staticCells} />
                  {removeCorner}
                </div>
              );
            }
            return (
              <div className="img-wrap" key={c.index} style={{ width: cellW, height: row.h, flex: '0 0 auto', position: 'relative' }}>
                <AliaPhoto src={cell.src} label={cell.label} zoomable={!staticCells} />
                {removeCorner}
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="imgs-stack imgs-gallery" ref={ref} style={{ width: '100%', position: 'relative' }}>
      {renderRun(items.map((cell, index) => ({ index, cell })), 'run')}
    </div>
  );
}

/* ── Controlled gallery (composer room draft) ────────────────────────────────
   The composer owns the cells and the cross-block lift-and-drop; each cell wears
   `.rb-item.rb-gal-cell` so that drag can target it. Packs through the SAME
   shared justifiedRows the feed uses (via the adapter below), honoring the
   author's row breaks. Cells are STATIC atoms so the drag never fights a live
   player / zoom. */
const RB_GAP = 4;
interface RBRow { items: GalCell[]; h: number; fill: boolean; }
function rbGalleryRows(shots: GalCell[], W: number): RBRow[] {
  if (!W || !shots.length) return [];
  const ratios = shots.map((s) => s.aspect || 1 / 1.2);
  const gal: GalItem[] = shots.map((s) => ({ src: s.src, aspect: s.aspect, rowBreak: s.rowBreak }));
  const packed = justifiedRows(gal, ratios, W, RB_GAP);
  let k = 0;
  return packed.map((r) => { const items = shots.slice(k, k + r.items.length); k += r.items.length; return { items, h: r.h, fill: r.fill }; });
}
function ComposerGallery({ cells, activeDragId, onCellPointerDown, onCellRemove, gapClass, layout }:
  { cells: GalCell[]; activeDragId: string | null; onCellPointerDown?: (e: React.PointerEvent, id: string) => void; onCellRemove?: (id: string) => void; gapClass: string; layout?: 'justified' | 'masonry' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) { setW(0); return; }
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Room draft = the SAME 2-col CSS-multicol masonry as the feed (.rb-masonry).
     Each cell is individually draggable (linear reorder); it carries data-id +
     a top-right remove hot zone. Live video, raw <img> for photos. */
  if (layout === 'masonry') {
    return (
      <div className={'rb-masonry ' + gapClass}>
        {cells.map((s) => (
          <div
            className={'rb-item rb-masonry-block' + (activeDragId === s.id ? ' dragging' : '')}
            key={s.id} data-id={s.id}
            onPointerDown={onCellPointerDown ? (e) => onCellPointerDown(e, s.id) : undefined}
          >
            {s.kind === 'video'
              ? <AliaVideo src={s.src} captionsSrc={s.captionsSrc} autoplay controls />
              : <img src={s.src} alt="" draggable={false} />}
            {onCellRemove ? (
              <button type="button" className="rb-remove-hot" aria-label="remove" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onCellRemove(s.id); }} />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  const rows = rbGalleryRows(cells, w);
  return (
    <div className={'imgs-stack imgs-gallery ' + gapClass} ref={ref} style={{ width: '100%' }}>
      {rows.map((row, ri) => (
        <div className="imgs-row" key={ri} style={{ height: row.h, justifyContent: 'flex-start' }}>
          {row.items.map((s) => (
            <div
              className={'rb-item rb-gal-cell' + (activeDragId === s.id ? ' dragging' : '')}
              key={s.id} data-id={s.id}
              style={{ width: row.h * (s.aspect || 1 / 1.2), height: row.h, flex: '0 0 auto' }}
              onPointerDown={onCellPointerDown ? (e) => onCellPointerDown(e, s.id) : undefined}
            >
              {s.kind === 'video'
                ? <AliaVideo thumbnail src={s.src} />
                : <AliaPhoto zoomable={false} src={s.src} />}
              {onCellRemove ? (
                <button
                  type="button"
                  className="rb-remove-hot"
                  aria-label="remove"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onCellRemove(s.id); }}
                />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Editable (apply comp card) ──────────────────────────────────────────────
   Uncontrolled: owns its own shots and drag. upload · native-ratio justified
   rows (shared packer, capped) · pointer drag-to-reorder (touch + mouse) ·
   tap-to-remove · desktop file-drop. Photos only — a comp card is photos. */
const MMI_MIN = 3;
const MMI_MAX = 6;
const MMI_GAP = 8;
const mmiNewId = () => nextId('mmi');
function ratioToNum(r: string): number { const [a, b] = r.split('/').map((n) => parseFloat(n)); return b ? a / b : 1; }

function EditableGrid({ initial, locked = false, min = MMI_MIN, max = MMI_MAX, onChange }:
  { initial?: MMIPhoto[]; locked?: boolean; min?: number; max?: number; onChange?: (shots: MMIPhoto[]) => void }) {
  const [shots, setShots] = useState<MMIPhoto[]>(initial ?? []);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHot, setDropHot] = useState(false);
  const [galleryW, setGalleryW] = useState(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const shotsRef = useRef(shots); shotsRef.current = shots;
  const galleryRef = useRef<HTMLDivElement>(null);
  const drag = useRef<any>(null);

  useEffect(() => {
    const el = galleryRef.current;
    if (!el) { setGalleryW(0); return; }
    const measure = () => setGalleryW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shots.length > 0]);
  useEffect(() => { onChange?.(shots); /* eslint-disable-next-line */ }, [shots]);

  const pickPhotos = () => photoInput.current?.click();
  const addPhotos = (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    const room = Math.max(0, max - shotsRef.current.length);
    imgs.slice(0, room).forEach((f) => {
      const src = URL.createObjectURL(f);
      const id = mmiNewId();
      setShots((prev) => [...prev, { id, src, ratio: '3 / 4' }]);
      const im = new Image();
      im.onload = () => setShots((prev) => prev.map((s) => (s.id === id ? { ...s, ratio: `${im.naturalWidth} / ${im.naturalHeight}` } : s)));
      im.src = src;
    });
  };
  const removeShot = (id: string) => setShots((prev) => prev.filter((s) => s.id !== id));

  /* Lift-and-drop reorder — the grabbed cell lifts out of flow (transform, so
     nothing re-justifies) and follows the finger; the drop slot is computed ONCE
     on release (row by Y, slot by X). */
  const liftFollow = () => {
    const st = drag.current; if (!st || !st.rect0) return;
    const dx = st.pointerX - st.grabDx - st.rect0.left;
    const dy = st.pointerY - st.grabDy - st.rect0.top;
    st.cell.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const resetCell = (cell: HTMLElement) => { cell.style.position = ''; cell.style.zIndex = ''; cell.style.pointerEvents = ''; cell.style.transform = ''; cell.style.willChange = ''; };
  const dropBeforeId = (): string | null => {
    const st = drag.current; if (!st) return null;
    const cells = (Array.from(galleryRef.current?.querySelectorAll('.mmi-cell') || []) as HTMLElement[]).filter((c) => c !== st.cell);
    for (const c of cells) {
      const r = c.getBoundingClientRect();
      if (st.pointerY < r.top) return c.dataset.id || null;
      if (st.pointerY <= r.bottom && st.pointerX < r.left + r.width / 2) return c.dataset.id || null;
    }
    return null;
  };
  const onDragMove = (e: PointerEvent) => {
    const st = drag.current; if (!st) return;
    st.pointerX = e.clientX; st.pointerY = e.clientY;
    if (!st.started) {
      if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < 6) return;
      st.started = true; setDragId(st.id);
      const r = st.cell.getBoundingClientRect();
      st.rect0 = r; st.grabDx = st.startX - r.left; st.grabDy = st.startY - r.top;
      st.cell.style.position = 'relative'; st.cell.style.zIndex = '9999'; st.cell.style.pointerEvents = 'none'; st.cell.style.willChange = 'transform';
    }
    liftFollow();
  };
  const onDragUp = () => {
    const st = drag.current; if (!st) return;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragUp);
    window.removeEventListener('pointercancel', onDragUp);
    const { started, id, cell } = st;
    if (started) {
      const beforeId = dropBeforeId();
      resetCell(cell);
      setShots((prev) => {
        const dragged = prev.find((x) => x.id === id);
        if (!dragged) return prev;
        const arr = prev.filter((x) => x.id !== id);
        const idx = beforeId ? arr.findIndex((x) => x.id === beforeId) : arr.length;
        arr.splice(idx < 0 ? arr.length : idx, 0, dragged);
        return arr;
      });
    }
    drag.current = null; setDragId(null);
    if (!started && !locked) removeShot(id);
  };
  const tileProps = (id: string) => (locked ? { 'data-id': id } : {
    'data-id': id,
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const cell = e.currentTarget as HTMLElement;
      drag.current = { id, cell, startX: e.clientX, startY: e.clientY, pointerX: e.clientX, pointerY: e.clientY, started: false, rect0: null, grabDx: 0, grabDy: 0 };
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragUp, { once: true });
      window.addEventListener('pointercancel', onDragUp, { once: true });
    },
  });
  const onCardDragOver = (e: React.DragEvent) => { if (locked) return; if (e.dataTransfer.types && e.dataTransfer.types.indexOf('Files') !== -1) { e.preventDefault(); setDropHot(true); } };
  const onCardDrop = (e: React.DragEvent) => { if (locked) return; setDropHot(false); if (e.dataTransfer.files?.length) { e.preventDefault(); addPhotos(Array.from(e.dataTransfer.files)); } };

  const ratios = shots.map((s) => ratioToNum(s.ratio));
  const gal: GalItem[] = shots.map((s) => ({ src: s.src }));
  const packed = justifiedRows(gal, ratios, galleryW, MMI_GAP);
  let k = 0;
  const rows = packed.map((r) => { const items = shots.slice(k, k + r.items.length); k += r.items.length; return { items, h: r.h, fill: r.fill }; });

  return (
    <>
      {shots.length > 0 ? (
        <div className={'mmi-rows' + (dropHot ? ' drop-hot' : '')} ref={galleryRef} onDragOver={onCardDragOver} onDragLeave={() => setDropHot(false)} onDrop={onCardDrop}>
          {rows.map((row, ri) => (
            <div className="mmi-row" key={ri} style={{ height: row.h, justifyContent: 'flex-start' }}>
              {row.items.map((s) => (
                <div key={s.id} className={'mmi-cell' + (dragId === s.id ? ' dragging' : '')} style={{ width: row.h * ratioToNum(s.ratio), height: row.h }} {...tileProps(s.id)}>
                  <AliaPhoto zoomable={false} src={s.src} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {!locked && shots.length < max ? (
        <button className="cc-tool mmi-add" onClick={pickPhotos}>photos</button>
      ) : null}
      <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(Array.from(e.target.files || [])); e.target.value = ''; }} />
    </>
  );
}
