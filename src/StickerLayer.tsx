/* ───────────────────────────────────────────────────────────────────────────
   StickerLayer.tsx — Room v3 sticker collage.

   Stickers behave like a collage laid ON the room:
   • They live INSIDE the feed's scroll content (portaled into .feed), so they
     scroll with the conversation and sit in content space, not the viewport.
   • Move: press and drag — instant, no threshold, no bounds fighting you.
   • Resize: pinch (two fingers) or scroll / trackpad-pinch over a sticker.
   • Swipe UP from the bottom edge opens the drawer (4 slots). Slot 1 uploads a
     look → AI returns a die-cut sticker. Drag a ready sticker out (lifted ghost)
     and drop it anywhere. The drawer stays open until you swipe it down.

   Positions: xPct = % of feed width, yPx = px down the scroll content. Styling
   in stickers.css; die-cut contour = the .stk-cut class.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import AliaText from './blocks/AliaText';
import AliaPhoto, { cutoutFromFile } from './blocks/AliaPhoto';
import AliaWrite, { AliaWritePad } from './blocks/AliaWrite';

const STK_LS = 'alia.room.collage';

type StkStatus = 'empty' | 'generating' | 'ready';
type StkKind = 'cut' | 'text' | 'ink';
type StkSlot = { id: string; primary?: boolean; src: string | null; status: StkStatus };
type StkPlaced = { id: string; kind?: StkKind; src?: string; text?: string; paths?: string[]; vb?: string; slot: string; xPct: number; yPx: number; w?: number; scale: number; rot?: number; z: number; owner?: 'me' | 'other'; msgId?: string | null; relYPx?: number | null };

const SLOT_DEFS: Array<{ id: string; primary?: boolean }> = [
  { id: 's1', primary: true }, { id: 's2' }, { id: 's3' }, { id: 's4' },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/* which feed message (if any) sits under a screen point — elementsFromPoint so
   the sticker on top is skipped and we read the message beneath it. */
function msgIdAt(x: number, y: number): string | null {
  const els = (document as any).elementsFromPoint ? document.elementsFromPoint(x, y) : [];
  for (const el of els as Element[]) {
    const m = (el as HTMLElement).closest ? (el as HTMLElement).closest('[data-msg-id]') : null;
    if (m) return m.getAttribute('data-msg-id');
  }
  return null;
}

function loadPersisted(): { slots?: StkSlot[]; placed?: StkPlaced[] } {
  try { return JSON.parse(window.localStorage.getItem(STK_LS) || '{}'); } catch (_e) { return {}; }
}

export default function StickerLayer() {
  const persisted = loadPersisted();
  const [slots, setSlots] = useState<StkSlot[]>(() =>
    (persisted.slots || SLOT_DEFS.map((d) => ({ ...d, src: null, status: 'empty' as StkStatus })))
      // self-heal: a slot persisted mid-generate (e.g. a reload) shouldn't hang
      .map((s) => (s.status === 'generating' ? { ...s, status: (s.src ? 'ready' : 'empty') as StkStatus } : s))
  );
  const [placed, setPlaced] = useState<StkPlaced[]>(persisted.placed || []);
  const [tray, setTray] = useState(false);
  const [textStatus, setTextStatus] = useState<'edit' | 'gen' | 'ready'>('edit');
  const [textValue, setTextValue] = useState('');
  const [textEmpty, setTextEmpty] = useState(true);
  const [inkStatus, setInkStatus] = useState<'edit' | 'gen' | 'ready'>('edit');
  const [inkSticker, setInkSticker] = useState<any>(null);
  const [ghost, setGhost] = useState<{ src: string; w: number; x: number; y: number } | null>(null);
  const [dragSlot, setDragSlot] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [feedEl, setFeedEl] = useState<HTMLElement | null>(null);

  /* a message's top in feed-content coordinates (same space as yPx) — lets a
     sticker be pinned RELATIVE to the message it sits on, so it survives reflow. */
  const msgTop = (id?: string | null): number | null => {
    if (!feedEl || !id) return null;
    let el: Element | null = null;
    try { el = feedEl.querySelector('[data-msg-id="' + ((window as any).CSS && CSS.escape ? CSS.escape(id) : id) + '"]'); } catch (_e) { el = null; }
    if (!el) return null;
    const f = feedEl.getBoundingClientRect();
    return el.getBoundingClientRect().top - f.top + feedEl.scrollTop;
  };

  const traySecRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const genTimer = useRef<any>(null);
  const swipeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadSlot = useRef<string | null>(null);
  const sheetY = useRef<number | null>(null);
  const closeY = useRef<number | null>(null);
  const tdrag = useRef<any>(null);
  const gesture = useRef<any>(null);
  const placedRef = useRef<StkPlaced[]>(placed);

  useEffect(() => { placedRef.current = placed; }, [placed]);
  useEffect(() => {
    try { window.localStorage.setItem(STK_LS, JSON.stringify({ slots, placed })); } catch (_e) {}
  }, [slots, placed]);

  /* a sticker stuck ON a message goes away with it: when a message is unsent,
     drop any placed stickers that were dropped over it. */
  useEffect(() => {
    const onUnsent = (e: Event) => {
      const id = (e as CustomEvent).detail && (e as CustomEvent).detail.id;
      if (!id) return;
      setPlaced((p) => p.filter((s) => s.msgId !== id));
    };
    window.addEventListener('alia:message-unsent', onUnsent as EventListener);
    return () => window.removeEventListener('alia:message-unsent', onUnsent as EventListener);
  }, []);

  /* Keep placed stickers glued to their message: re-derive yPx from the message's
     LIVE position (msgTop + relYPx) whenever the feed reflows (load, image/video
     decode, entrance animations, unsend, resize) — so they never drift on reload. */
  useLayoutEffect(() => {
    if (!feedEl) return;
    let raf = 0;
    const reconcile = () => {
      raf = 0;
      if (gesture.current || tdrag.current) return;   // don't fight an active drag
      setPlaced((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          if (!s.msgId || s.relYPx == null) return s;
          const mt = msgTop(s.msgId);
          if (mt == null) return s;
          const y = mt + s.relYPx;
          if (Math.abs(y - s.yPx) > 1) { changed = true; return { ...s, yPx: y }; }
          return s;
        });
        return changed ? next : prev;
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(reconcile); };
    schedule();
    const timers = [200, 700, 1500].map((ms) => window.setTimeout(schedule, ms));
    const mo = new MutationObserver(schedule);
    mo.observe(feedEl, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout); mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedEl]);

  /* the room's scroll container — placed stickers portal in here so they scroll */
  useEffect(() => {
    let tries = 0;
    const find = () => {
      const el = document.querySelector('.app-root#room .feed') as HTMLElement | null;
      if (el) { setFeedEl(el); return; }
      if (tries++ < 20) requestAnimationFrame(find);
    };
    find();
  }, []);

  const topZ = () => placedRef.current.reduce((m, s) => Math.max(m, s.z || 1), 1) + 1;

  /* Preload Pecita so the very first generated text sticker paints in the right
     face — no sans-serif flash during the "generating" moment. */
  useEffect(() => {
    const f: any = (document as any).fonts;
    if (!f || !f.load) return;
    try { f.load('48px Pecita'); f.load('700 48px Pecita'); } catch (_e) {}
  }, []);

  /* Swipe up / down to open / close — a bottom-sheet gesture confined to the
     swipe zone (open) and the drawer (close). It never touches the feed's own
     scroll, and works at ANY scroll position. Trackpad/wheel swipes land as
     wheel events; touch/mouse drags are handled by the pointer zone below. */
  useEffect(() => {
    const zone = swipeRef.current, drawer = traySecRef.current;
    let acc = 0, lastT = 0;
    const tick = () => { const n = performance.now(); if (n - lastT > 240) acc = 0; lastT = n; };
    // briefly swallow wheel momentum after a close so the tail can't scroll the room
    const swallow = () => {
      const block = (ev: WheelEvent) => ev.preventDefault();
      window.addEventListener('wheel', block, { passive: false });
      window.setTimeout(() => window.removeEventListener('wheel', block), 320);
    };
    const openW = (e: WheelEvent) => {
      tick();
      if (e.deltaY > 0) { acc += e.deltaY; e.preventDefault(); if (acc > 46) { setTray(true); acc = 0; } }
      else acc = 0;
    };
    const closeW = (e: WheelEvent) => {
      // the open drawer is its OWN surface: a down-swipe here closes cleanly and
      // never leaks into the room scroll
      e.preventDefault();
      tick();
      if (e.deltaY < 0) { acc += -e.deltaY; if (acc > 26) { setTray(false); acc = 0; swallow(); } }
      else acc = 0;
    };
    zone && zone.addEventListener('wheel', openW, { passive: false });
    drawer && drawer.addEventListener('wheel', closeW, { passive: false });
    return () => {
      zone && zone.removeEventListener('wheel', openW);
      drawer && drawer.removeEventListener('wheel', closeW);
    };
  }, []);

  /* ── Upload → AI cut-out (slot 1, the doll) ─────────────────────────────────
     Real prototype of the "AI turns it into your sticker" step: we run in-browser
     background removal on the uploaded photo to produce a TRANSPARENT cut-out, so
     the die-cut white contour hugs the person (not a rectangle). The stylised
     illustration render needs an image model + your key — that runs in your real
     app; here we do the genuine cut-out and fall back to the raw photo if the
     model can't load in this sandbox. */
  const openUpload = (id: string) => { uploadSlot.current = id; fileRef.current?.click(); };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const id = uploadSlot.current;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      setSlots((s) => s.map((x) => (x.id === id ? { ...x, src: raw, status: 'generating' } : x)));
      // AliaPhoto owns the die-cut cut-out (in-browser bg removal, raw fallback)
      const out = await cutoutFromFile(f);
      setSlots((s) => s.map((x) => (x.id === id ? { ...x, src: out, status: 'ready' } : x)));
    };
    reader.readAsDataURL(f);
  };

  /* ── Drag a finished sticker OUT of the drawer → drop (drawer stays open) ──
     Generic over the sticker KIND: photos carry an image payload, text/ink
     carry their own render data, but the lift → ghost → drop path is identical. */
  const startStickerDrag = (e: React.PointerEvent, payload: any, key: string, onTap?: () => void) => {
    e.preventDefault(); e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    tdrag.current = {
      payload, key, onTap, w: rect.width,
      startX: e.clientX, startY: e.clientY,
      grabDx: e.clientX - rect.left, grabDy: e.clientY - rect.top, started: false,
    };
    window.addEventListener('pointermove', onTrayDragMove);
    window.addEventListener('pointerup', onTrayDragUp, { once: true });
    window.addEventListener('pointercancel', onTrayDragUp, { once: true });
  };
  const onTrayDragMove = (e: PointerEvent) => {
    const st = tdrag.current; if (!st) return;
    if (!st.started) {
      if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < 3) return;
      st.started = true;
      setDragSlot(st.key);   // the source cell lifts out with the drag
      if (!st.raf) st.raf = requestAnimationFrame(trayAutoScroll);
    }
    st.lastY = e.clientY;
    setGhost({ payload: st.payload, w: st.w, x: e.clientX - st.grabDx, y: e.clientY - st.grabDy });
  };
  /* while carrying a sticker OUT of the drawer near the top/bottom edge, scroll
     the room — so drag-out → scroll → drop is ONE continuous gesture */
  const trayAutoScroll = () => {
    const st = tdrag.current;
    if (!st || !st.started || !feedEl) { if (st) st.raf = 0; return; }
    const f = feedEl.getBoundingClientRect();
    const m = 84, maxV = 20;
    let dv = 0;
    if (st.lastY < f.top + m) dv = -maxV * Math.min(1, (f.top + m - st.lastY) / m);
    else if (st.lastY > f.bottom - m) dv = maxV * Math.min(1, (st.lastY - (f.bottom - m)) / m);
    if (dv) feedEl.scrollTop = clamp(feedEl.scrollTop + dv, 0, feedEl.scrollHeight - feedEl.clientHeight);
    st.raf = requestAnimationFrame(trayAutoScroll);
  };
  const onTrayDragUp = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onTrayDragMove);
    const st = tdrag.current; tdrag.current = null; setGhost(null); setDragSlot(null);
    if (!st) return;
    if (st.raf) cancelAnimationFrame(st.raf);
    if (!st.started) { st.onTap && st.onTap(); return; }   // a tap, not a drag
    if (!feedEl) return;
    const f = feedEl.getBoundingClientRect();
    const xPct = clamp(((e.clientX - f.left) / f.width) * 100, 3, 97);
    const yPx = clamp(e.clientY - f.top + feedEl.scrollTop, 8, feedEl.scrollHeight - 8);
    // land at the EXACT size it was carried (no pop) — pinch scales from there
    const dropMsg = msgIdAt(e.clientX, e.clientY);
    const dmt = msgTop(dropMsg);
    const base: any = { ...st.payload };
    if (st.payload.kind === 'cut') base.w = st.w;   // photos land at carried width; text/ink keep intrinsic size
    setPlaced((p) => [...p, { id: 'p' + Date.now(), ...base, slot: st.key, xPct, yPx, scale: 1, z: topZ(), owner: 'me', msgId: dropMsg, relYPx: dmt != null ? yPx - dmt : null }]);
    // drawer intentionally stays open
  };

  /* ── Collage gestures on a placed sticker: 1 finger = move (+edge auto-scroll), 2 = pinch ── */
  const baseline = (g: any, s: StkPlaced) => {
    if (!feedEl) return;
    g.origScale = s.scale || 1;
    const pts = [...g.pointers.values()];
    const f = feedEl.getBoundingClientRect();
    if (pts.length >= 2) {
      g.origXPct = s.xPct; g.origYPx = s.yPx;
      g.startDist = dist(pts[0], pts[1]); g.startMid = mid(pts[0], pts[1]);
      g.startTwist = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      g.baseRot = s.rot || 0;
      g.mode = 'pinch';
    } else if (pts.length === 1) {
      const centerXpx = f.left + (s.xPct / 100) * f.width;
      const pointerContentY = pts[0].y - f.top + feedEl.scrollTop;
      g.offsetXpx = pts[0].x - centerXpx;    // grab offset from the sticker centre (x, px)
      g.offsetY = pointerContentY - s.yPx;   // grab offset (y, content px)
      g.lastX = pts[0].x; g.lastY = pts[0].y;
      g.samples = [{ t: performance.now(), x: pts[0].x, y: pts[0].y }];
      g.startPx = pts[0].x; g.startPy = pts[0].y;
      g.maxSpeed = 0; g.lastVx = 0; g.lastVy = 0;
      /* ── drag-orbit (desktop, one finger, no handle): grab the CORE and it
         moves; grab an EDGE/CORNER and circle and it spins in place around its
         own centre — like pushing the rim of a coaster. Decided by where you
         grabbed, un-rotated into the sticker's own axes. ── */
      g.mode = 'move';
      const el = g.el as HTMLElement | undefined;
      if (el) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const sc = s.scale || 1;
        const rot = (s.rot || 0) * Math.PI / 180;
        const gx = pts[0].x - cx, gy = pts[0].y - cy;
        const lx = gx * Math.cos(-rot) - gy * Math.sin(-rot);
        const ly = gx * Math.sin(-rot) + gy * Math.cos(-rot);
        const hw = (el.offsetWidth * sc) / 2 || 1, hh = (el.offsetHeight * sc) / 2 || 1;
        const inCore = Math.abs(lx) / hw < 0.5 && Math.abs(ly) / hh < 0.5;
        if (!inCore) {
          g.mode = 'rotate';
          g.baseRot = s.rot || 0;
          g.startAngle = Math.atan2(gy, gx);
        }
      }
    }
  };

  /* absolute tracking: sticker follows the finger in CONTENT space, so it keeps
     up while the room scrolls under it */
  const applyMove = (g: any) => {
    if (!feedEl) return;
    const f = feedEl.getBoundingClientRect();
    const xPct = clamp(((g.lastX - g.offsetXpx - f.left) / f.width) * 100, 1, 99);
    const yPx = Math.max(4, (g.lastY - f.top + feedEl.scrollTop) - g.offsetY);
    setPlaced((p) => p.map((x) => (x.id === g.id ? { ...x, xPct, yPx } : x)));
  };

  /* while holding near the top/bottom edge, scroll the room so you can carry a
     sticker to any point in the conversation */
  const autoScroll = () => {
    const g = gesture.current;
    if (!g || g.pointers.size !== 1 || g.mode !== 'move' || !feedEl) { if (g) g.raf = 0; return; }
    const f = feedEl.getBoundingClientRect();
    const m = 84, maxV = 20;
    let dv = 0;
    if (g.lastY < f.top + m) dv = -maxV * Math.min(1, (f.top + m - g.lastY) / m);
    else if (g.lastY > f.bottom - m) dv = maxV * Math.min(1, (g.lastY - (f.bottom - m)) / m);
    if (dv) {
      const before = feedEl.scrollTop;
      feedEl.scrollTop = clamp(before + dv, 0, feedEl.scrollHeight - feedEl.clientHeight);
      if (feedEl.scrollTop !== before) applyMove(g);
    }
    g.raf = requestAnimationFrame(autoScroll);
  };

  const onStickerDown = (e: React.PointerEvent, s: StkPlaced) => {
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (_e) {}
    let g = gesture.current;
    if (!g || g.id !== s.id) { g = { id: s.id, pointers: new Map(), raf: 0 }; gesture.current = g; }
    g.el = e.currentTarget as HTMLElement;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    baseline(g, s);
    setDragId(s.id);
    setPlaced((p) => p.map((x) => (x.id === s.id ? { ...x, z: topZ() } : x)));
    if (g.pointers.size === 1 && g.mode === 'move' && !g.raf) g.raf = requestAnimationFrame(autoScroll);
  };
  const onStickerMove = (e: React.PointerEvent) => {
    const g = gesture.current; if (!g || !g.pointers.has(e.pointerId) || !feedEl) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...g.pointers.values()];
    if (pts.length >= 2) {
      const f = feedEl.getBoundingClientRect();
      const d = dist(pts[0], pts[1]);
      const mp = mid(pts[0], pts[1]);
      const scale = clamp(g.origScale * (d / g.startDist), 0.35, 2);
      const xPct = g.origXPct + ((mp.x - g.startMid.x) / f.width) * 100;
      const yPx = g.origYPx + (mp.y - g.startMid.y);
      const twist = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      const rot = (g.baseRot || 0) + (twist - g.startTwist) * 180 / Math.PI;
      setPlaced((p) => p.map((x) => (x.id === g.id ? { ...x, scale, xPct, yPx, rot } : x)));
    } else if (g.mode === 'rotate') {
      const el = g.el as HTMLElement | undefined;
      if (el) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ang = Math.atan2(pts[0].y - cy, pts[0].x - cx);
        const rot = (g.baseRot || 0) + (ang - g.startAngle) * 180 / Math.PI;
        setPlaced((p) => p.map((x) => (x.id === g.id ? { ...x, rot } : x)));
      }
    } else {
      g.lastX = pts[0].x; g.lastY = pts[0].y;
      const arr = (g.samples || (g.samples = []));
      arr.push({ t: performance.now(), x: pts[0].x, y: pts[0].y });
      if (arr.length > 8) arr.shift();
      if (arr.length >= 2) {
        const a = arr[arr.length - 2], b = arr[arr.length - 1];
        const dt = Math.max(8, b.t - a.t);
        const sp = Math.hypot(b.x - a.x, b.y - a.y) / dt;
        g.maxSpeed = Math.max(g.maxSpeed || 0, sp);   // PEAK speed — a flick counts even if you slow before release
        g.lastVx = (b.x - a.x) / dt; g.lastVy = (b.y - a.y) / dt;
      }
      applyMove(g);
    }
  };
  const onStickerUp = (e: React.PointerEvent) => {
    const g = gesture.current; if (!g) return;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size === 0) {
      if (g.raf) cancelAnimationFrame(g.raf);
      const cur = placedRef.current.find((x) => x.id === g.id);
      const mId = msgIdAt(g.lastX, g.lastY);   // note which message it now sits on
      const mt = msgTop(mId);
      const relY = cur && mt != null ? cur.yPx - mt : null;
      setPlaced((p) => p.map((x) => (x.id === g.id ? { ...x, msgId: mId, relYPx: relY } : x)));
      gesture.current = null; setDragId(null);
    } else {
      const s = placedRef.current.find((x) => x.id === g.id);
      if (s) baseline(g, s);
      if (g.pointers.size === 1 && g.mode === 'move' && !g.raf) g.raf = requestAnimationFrame(autoScroll);
    }
  };
  // trackpad pinch arrives as ctrl+wheel; plain scroll is left alone so the room scrolls
  const onStickerWheel = (e: React.WheelEvent, s: StkPlaced) => {
    if (!e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation();
    const next = clamp((s.scale || 1) * (1 - e.deltaY * 0.01), 0.35, 2);
    setPlaced((p) => p.map((x) => (x.id === s.id ? { ...x, scale: next } : x)));
  };
  const removePlaced = (id: string) => setPlaced((p) => p.filter((s) => s.id !== id));
  /* Double-tap removal rules:
     • your OWN sticker → removed for everyone (drop it from the collage; the
       backend broadcasts the removal).
     • someone ELSE's sticker → removed only from YOUR feed (a local hide; it
       stays for everyone else). In this single-client prototype both drop from
       local state, but the branches are kept distinct for the real wiring. */
  const removeOnDoubleTap = (s: StkPlaced) => {
    if ((s.owner ?? 'me') === 'me') removePlaced(s.id);   // gone for everyone
    else setPlaced((p) => p.filter((x) => x.id !== s.id)); // local hide only
  };

  /* ── Make a sticker inline: compose → an "AI" die-cut pass → drag out ───────
     Mirrors the photo doll: you compose (type / write), a short generation
     shimmer plays, then a finished die-cut sticker sits in the cell that you
     drag into the room exactly like a photo. (No real model here — the text is
     set in Pecita and the ink is tidied with midpoint smoothing.) */

  // TEXT — composed in the canonical AliaText block; committing (Enter/blur)
  // runs the "AI" pass, turning the line into a Pecita die-cut sticker.
  const generateText = (v: string) => {
    const t = (v || '').trim();
    if (!t) return;
    setTextValue(t);
    setTextStatus('gen');
    clearTimeout(genTimer.current);
    genTimer.current = window.setTimeout(() => setTextStatus('ready'), 900);
  };

  /* seed the AliaText compose line when (re)entering edit — mirrors AliaField's
     `initial`, so re-editing shows the last committed text */
  useEffect(() => {
    if (textStatus !== 'edit') return;
    const el = textRef.current;
    if (el) el.textContent = textValue;
    setTextEmpty(!textValue.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textStatus]);

  // WRITE — the pad (draw + tidy) is the AliaWrite block; when it commits the
  // tidied ink, run the same short "AI" shimmer, then it's a die-cut sticker.
  const onInkCommit = (data: { paths: string[]; vb: string; w: number }) => {
    setInkSticker({ kind: 'ink', paths: data.paths, vb: data.vb, w: data.w });
    setInkStatus('gen');
    window.setTimeout(() => setInkStatus('ready'), 900);
  };
  // tap the finished ink sticker → wipe it and start over on a blank pad.
  const resetInk = () => { setInkSticker(null); setInkStatus('edit'); };

  /* ── Swipe UP (bottom edge) opens · swipe DOWN (drawer) closes ───────────── */
  const swipeDown = (e: React.PointerEvent) => { sheetY.current = e.clientY; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (_e) {} };
  const swipeMove = (e: React.PointerEvent) => {
    if (sheetY.current == null) return;
    if (sheetY.current - e.clientY > 28) { setTray(true); sheetY.current = null; }
  };
  const swipeEnd = () => { sheetY.current = null; };

  /* Only ONE sheet open at a time (the sticker tray and the Block Drop share the
     room): announce when the tray opens, and close it if another sheet opens. */
  useEffect(() => {
    if (tray) window.dispatchEvent(new CustomEvent('alia:sheet-open', { detail: { id: 'stickers' } }));
  }, [tray]);
  useEffect(() => {
    const onOther = (e: Event) => { if ((e as CustomEvent).detail?.id !== 'stickers') setTray(false); };
    window.addEventListener('alia:sheet-open', onOther as EventListener);
    return () => window.removeEventListener('alia:sheet-open', onOther as EventListener);
  }, []);

  const trayDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.stk-ready, .stk-slot-up')) return; // let slots handle
    closeY.current = e.clientY;
  };
  const trayMove = (e: React.PointerEvent) => {
    if (closeY.current == null) return;
    if (e.clientY - closeY.current > 40) { setTray(false); closeY.current = null; }
  };
  const trayEnd = () => { closeY.current = null; };

  const bodyFor = (s: StkPlaced) => {
    if (s.kind === 'text') return <AliaText committed className="stk-text-sticker made" text={s.text} />;
    if (s.kind === 'ink') return <AliaWrite paths={s.paths || []} vb={s.vb || ''} width={s.w} />;
    return <AliaPhoto cutout src={s.src as string} width={s.w} />;
  };

  const placedNodes = placed.map((s) => {
    return (
      <div
        key={s.id}
        className={'stk-placed' + (dragId === s.id ? ' dragging' : '')}
        style={{
          left: s.xPct + '%', top: s.yPx + 'px', zIndex: 30 + (s.z || 1),
          transform: `translate(-50%, -50%) scale(${s.scale || 1}) rotate(${s.rot || 0}deg)`,
        }}
        onPointerDown={(e) => onStickerDown(e, s)}
        onPointerMove={onStickerMove}
        onPointerUp={onStickerUp}
        onPointerCancel={onStickerUp}
        onWheel={(e) => onStickerWheel(e, s)}
        onDoubleClick={() => removeOnDoubleTap(s)}
      >
        {bodyFor(s)}
      </div>
    );
  });

  return (
    <div className="stk-layer">
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

      {/* die-cut filter — dilates the content's alpha into a white sticker body
          (the same white-margin cut-out the photo stickers get), content on top */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id="stk-diecut" x="-40%" y="-40%" width="180%" height="180%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d" />
          <feFlood floodColor="#ffffff" result="w" />
          <feComposite in="w" in2="d" operator="in" result="body" />
          <feMerge>
            <feMergeNode in="body" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>

      {/* placed stickers portal into the feed's scroll content → they scroll with the room */}
      {feedEl ? ReactDOM.createPortal(placedNodes, feedEl) : null}

      {/* invisible swipe-up zone (bottom edge) */}
      <button
        ref={swipeRef}
        className="stk-swipe"
        aria-label="open your stickers"
        onPointerDown={swipeDown}
        onPointerMove={swipeMove}
        onPointerUp={swipeEnd}
      />

      {/* the drawer — swipe it down to close */}
      <section
        ref={traySecRef}
        className={'stk-tray' + (tray ? ' open' : '')}
        onPointerDown={trayDown}
        onPointerMove={trayMove}
        onPointerUp={trayEnd}
        onPointerCancel={trayEnd}
      >
        <div className="stk-grid">
          {slots.filter((slot) => slot.primary).map((slot) => {
            const isReady = slot.status === 'ready' && slot.src;
            const isGen = slot.status === 'generating' && slot.src;
            return (
              <div key={slot.id} className="stk-cell">
                {isReady ? (
                  <div className={'stk-ready' + (dragSlot === slot.id ? ' lifting' : '')}
                    onPointerDown={(e) => startStickerDrag(e, { kind: 'cut', src: slot.src }, slot.id, slot.primary ? () => openUpload(slot.id) : undefined)}>
                    <AliaPhoto cutout src={slot.src as string} />
                  </div>
                ) : isGen ? (
                  <div className="stk-gen">
                    <img src={slot.src as string} alt="" />
                    <div className="stk-shimmer" />
                  </div>
                ) : (
                  <div className="stk-slot-empty" />
                )}
                {!isReady && !isGen ? (
                  <button className="stk-replace" onClick={() => openUpload(slot.id)}>
                    photo
                  </button>
                ) : null}
              </div>
            );
          })}

          {/* text maker — composed with the canonical AliaText block (placeholder
              "text" + its own cursor); commit runs the pass → Pecita die-cut,
              which you drag out like a photo · tap to edit */}
          <div className="stk-cell">
            {textStatus === 'ready' ? (
              <div className={'stk-maker-ready' + (dragSlot === 'text' ? ' lifting' : '')}
                onPointerDown={(e) => startStickerDrag(e, { kind: 'text', text: textValue }, 'text', () => setTextStatus('edit'))}>
                <AliaText committed className="stk-text-sticker made" text={textValue} />
              </div>
            ) : textStatus === 'gen' ? (
              <div className="stk-maker-gen">
                <div className="stk-gen-inner">
                  <AliaText committed className="stk-text-sticker made" text={textValue} />
                  <div className="stk-shimmer" />
                </div>
              </div>
            ) : (
              <div className="stk-text-compose">
                <AliaText
                  editable
                  ref={textRef}
                  className={'stk-text-sticker' + (textEmpty ? ' empty' : '')}
                  placeholder="text"
                  onInput={(e) => setTextEmpty(!(e.currentTarget.textContent || '').trim())}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
                  onBlur={(e) => generateText((e.currentTarget.textContent || '').replace(/\u00a0/g, ' '))}
                />
              </div>
            )}
          </div>

          {/* write maker — write on a bounded black pad; 5s after you stop, an
              "AI" pass tidies it into a die-cut sticker; tap to start over */}
          <div className="stk-cell">
            {inkStatus === 'ready' && inkSticker ? (
              <div className={'stk-maker-ready' + (dragSlot === 'ink' ? ' lifting' : '')}
                onPointerDown={(e) => startStickerDrag(e, inkSticker, 'ink', resetInk)}>
                {bodyFor(inkSticker)}
              </div>
            ) : inkStatus === 'gen' && inkSticker ? (
              <div className="stk-maker-gen">
                <div className="stk-gen-inner">
                  {bodyFor(inkSticker)}
                  <div className="stk-shimmer" />
                </div>
              </div>
            ) : (
              <AliaWritePad onCommit={onInkCommit} />
            )}
          </div>
        </div>
      </section>

      {/* lifted ghost — carries whatever kind of sticker you're dragging out */}
      {ghost && (
        <div className="stk-ghost" style={{ width: ghost.payload.kind === 'cut' ? ghost.w : 'max-content', transform: `translate(${ghost.x}px, ${ghost.y}px)` }}>
          {bodyFor(ghost.payload)}
        </div>
      )}
    </div>
  );
}
