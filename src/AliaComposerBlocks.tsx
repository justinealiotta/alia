/* ───────────────────────────────────────────────────────────────────────────
   AliaComposerBlocks — the room throw-in composer.

   A compose-first room draft: the working caret (.rb-live) sits in the feed and
   you type straight into it; Enter commits a line as a block. Any number of any
   block (text · photo · video · voice · link), in any order, drag-reorderable.
   The gate button = "send" — posts the whole draft via onSend(items), then
   clears. Voice capture is delegated to AliaVoice's recorder; media picking,
   text editing, and pointer drag-to-reorder (live in flow, no ghost) are built
   in. One ordered `items` model backs the draft.
   Styled by composer.css + voice.css + shared/shell.css tokens.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useState, useRef, useEffect, Fragment } from 'react';
import { Icon } from './icons';
import AliaVoice, { AliaVoiceRecorder } from './blocks/AliaVoice';
import AliaText, { lightAutocorrect } from './blocks/AliaText';
import AliaVideo from './blocks/AliaVideo';
import AliaMediaGrid from './blocks/AliaMediaGrid';
import { MAX_PER_ROW } from './media';
import AliaLinkPreview from './blocks/AliaLinkPreview';
import AliaLinkFallback from './blocks/AliaLinkFallback';
import { cmLooksLikeUrl, cmParseLink } from './composer/links';
import type { Block } from './types';
import { nextId } from './utils';

/* The composer stores, orders, and emits the SAME shared Block type the feed
   uses (types.ts). While composing, every block also carries a transient id
   (Block.id) for drag-reorder / patch / keys — required internally, so the
   working array is `Draft` (Block with a non-optional id). */
type Draft = Block & { id: string };
type ImgDraft = Extract<Draft, { type: 'image' }>;

/* A real uploaded clip has no caption data of its own; point it at a WebVTT track
   so the caption control renders REAL, browser-parsed cues driven by the clip's
   own timeline (edit / swap this .vtt for the true transcript per clip). */
const AV_CAPTIONS_VTT = '/sample-captions.vtt';

/* ── Justified-rows gallery (room draft) ─────────────────────────────────────
   Same treatment as the feed + apply card: a run of 2+ photos packs into flush
   rows at native ratios, nothing cropped. A single photo renders full width
   (handled by the caller). Row height scales with the column so a narrow room
   column still packs 2-up. */
/* The 2+ photo/video run now renders through <AliaMediaGrid gallery> — see that block. */
const newId = () => nextId('it');

/* Find the nearest scrollable ancestor of a node — so drag auto-scroll works
   in ANY host (the room's .feed, the apply page's own scroll container, …)
   without the component needing to know which page it's on. */
function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  let n = el && el.parentElement;
  while (n) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
    n = n.parentElement;
  }
  return null;
}

/* Feed Block[] → internal drafts for the edit preload. Each draft keeps the
   block's stable id (only new blocks get a fresh one); an `images` stack is split
   back into individual image blocks so each is its own draggable cell (the
   reverse of the send-time batching). link-image round-trips too (rendered as a
   preview card in the composer), so editing never drops a shoppable link. */
function blocksToDrafts(blocks: Block[]): Draft[] {
  const out: Draft[] = [];
  for (const b of blocks || []) {
    // preserve the block's STABLE id so a reordered/kept block keeps identity
    // through the edit (only genuinely new blocks get a fresh id) — this is what
    // lets block-replies follow their block across an edit.
    const keep = b.id ?? newId();
    if (b.type === 'text') out.push({ id: keep, type: 'text', text: b.text });
    else if (b.type === 'image') out.push({ id: keep, type: 'image', src: b.src, aspect: b.aspect, rowBreak: b.rowBreak });
    else if (b.type === 'video') out.push({ id: keep, type: 'video', src: b.src, rowBreak: b.rowBreak });
    else if (b.type === 'voice') out.push({ id: keep, type: 'voice', duration: b.duration, transcript: b.transcript, src: b.src });
    else if (b.type === 'link-ref') out.push({ id: keep, type: 'link-ref', label: b.label, url: b.url ?? '#' });
    else if (b.type === 'link-image') out.push({ id: keep, type: 'link-image', src: b.src, label: b.label, w: b.w, h: b.h });
  }
  return out;
}

/* Internal drafts → feed Block[] for send: consecutive image drafts batch into
   one `images` stack (a lone image stays a single `image`); everything else maps
   1:1. This is the batching that used to live in utils.itemsToBlocks, moved here
   so the composer emits finished Block[] directly. */
function draftsToBlocks(drafts: Draft[]): Block[] {
  const clean = drafts.filter((b) => (b.type === 'text' ? !!b.text.trim() : true));
  const blocks: Block[] = [];
  let i = 0;
  while (i < clean.length) {
    const b = clean[i];
    if (b.type === 'image' || b.type === 'video') {
      // Each photo / video is its OWN block (a block group is a run of these,
      // grouped into a masonry at render time) — never batched into one block.
      // carry the draft id onto the emitted block so posted blocks have a
      // stable identity block-replies can pin to.
      if (b.type === 'video') blocks.push({ id: b.id, type: 'video', src: b.src, w: 240, h: 320, captionsSrc: AV_CAPTIONS_VTT });
      else blocks.push({ id: b.id, type: 'image', src: b.src, aspect: (b as ImgDraft).aspect ?? 1.2 });
      i++;
      continue;
    }
    if (b.type === 'text') blocks.push({ id: b.id, type: 'text', text: b.text.trim() });
    else if (b.type === 'voice') blocks.push({ id: b.id, type: 'voice', duration: b.duration, transcript: b.transcript, src: b.src });
    else if (b.type === 'link-ref') blocks.push({ id: b.id, type: 'link-ref', label: b.label });
    else if (b.type === 'link-image') blocks.push({ id: b.id, type: 'link-image', src: b.src, label: b.label, w: b.w, h: b.h });
    i++;
  }
  return blocks;
}

/* ── draft persistence ───────────────────────────────────────────────────── */
const DRAFT_KEY = 'alia.room.draft';
const serializeItems = (its: Draft[]): string =>
  JSON.stringify(its.map((i) => [i.type, ((i as any).text || '').trim(), (i as any).src || '', (i as any).duration || 0, (i as any).transcript || '', (i as any).url || '', (i as any).label || '']));

type BuilderReplyMode =
  | { kind: 'idle' }
  | { kind: 'reply'; targetId: string; afterReplyId?: string }
  | { kind: 'edit'; targetId: string };

interface Props {
  onSend?: (blocks: Block[]) => void;
  /* edit mode only — removes the message being edited (the "unsend" affordance,
     now a button under send inside the editor). */
  onUnsend?: () => void;
  /* room wiring: reply / edit context driven by the feed */
  replyMode?: BuilderReplyMode;
  editItems?: Block[];
  /* inline = an in-feed reply composer (under a message): no draft persistence,
     no feed auto-scroll. onDirty reports whether it holds unsent content. */
  inline?: boolean;
  onDirty?: (dirty: boolean) => void;
}

export default function AliaComposerBlocks({ onSend, onUnsend, replyMode, editItems, inline, onDirty }: Props) {
  const [items, setItems] = useState<Draft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /* the always-present working caret (a live, in-feed text line) */
  const [hasLive, setHasLive] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);

  const photoInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const surfRef = useRef<HTMLDivElement>(null);   // room scroll container
  const itemsRef = useRef(items); itemsRef.current = items;

  const patch = (id: string, p: Partial<Draft>) => setItems((d) => d.map((x) => (x.id === id ? ({ ...x, ...p } as Draft) : x)));
  const remove = (id: string) => setItems((d) => d.filter((x) => x.id !== id));

  /* ── voice recording — delegated to AliaVoice's recorder ────────── */
  const [recording, setRecording] = useState(false);
  const addVoice = (v: Draft) => setItems((d) => [...d, v]);

  /* ── reply / edit wiring (room) ────────────────────────────────────────
     Edit opens the builder preloaded with the target message's full content.
     Entering or leaving a mode resets the draft; reply keeps the current draft
     (normally empty — you compose a fresh reply toward the clicked message). */
  const loadedKey = useRef<string>('idle::');
  const editBaseline = useRef<string>('');
  useEffect(() => {
    const m: BuilderReplyMode = replyMode || { kind: 'idle' };
    const key = m.kind + ':' + ((m as any).targetId || '') + ':' + ((m as any).afterReplyId || '');
    if (key === loadedKey.current) return;
    loadedKey.current = key;
    if (m.kind === 'edit') {
      const loaded = blocksToDrafts(editItems || []);
      setItems(loaded);
      editBaseline.current = serializeItems(loaded);
      setEditingId(null); setRecording(false); setOpen(false);
    } else if (m.kind === 'idle') {
      setItems([]); setEditingId(null); setRecording(false); setOpen(false);
    }
  }, [replyMode, editItems]);

  /* ── Builder visibility (room) ──────────────────────────────────────────────
     The full-screen builder stays open while you compose. It autosaves as you
     go; tapping "save" dismisses it (draft kept) so the room shows again. A
     dismissed draft is reopened from the fob's blinking "finish". */
  const [dismissed, setDismissed] = useState(false);
  const wakeSheet = () => setDismissed(false);   // any add action ensures the builder is showing

  /* ── Draft autosave ─────────────────────────────────────────────────────────
     Compose / reply drafts persist to storage; edit drafts are in-memory and
     only count once the content actually differs from the original message.
     The draft clears when emptied or sent (send() empties items). */
  const editChanged = replyMode?.kind === 'edit' && serializeItems(items) !== editBaseline.current;
  const hasMeaningful = items.some((i) => i.type !== 'text' || !!(i.text && i.text.trim()));
  /* an inline composer reports its dirty state up so the caret stays locked once
     there's unsent content. An EDIT starts preloaded with the message's body, so
     it's only "dirty" once it's actually TOUCHED (differs from the original) —
     otherwise long-pressing to peek at the editor would trap the caret. */
  const dirtyReport = replyMode?.kind === 'edit' ? editChanged : (hasMeaningful || hasLive);
  useEffect(() => { if (inline) onDirty?.(dirtyReport); }, [inline, dirtyReport, onDirty]);

  /* Per-composer draft key. Edit drafts stay in-memory; each reply / reply-to-
     reply composer keys by the message it answers, so its draft persists on its
     own; the bottom (start-a-message) composer uses the shared top-level key.
     `draftSaved` drives the quiet "saved" status under the blinking send — it
     goes true once the autosave writes, and clears on send or when emptied. */
  const draftKey =
    replyMode?.kind !== 'edit'
      ? (replyMode?.kind === 'reply' && (replyMode as any).targetId
          ? DRAFT_KEY + '.reply.' + (replyMode as any).targetId
          : DRAFT_KEY)
      : null;
  const [draftSaved, setDraftSaved] = useState(false);
  // the uncommitted live caret line persists alongside the committed blocks so a
  // full reload holds the whole draft (it clears on commit / send / clear).
  const liveDraftKey = draftKey ? draftKey + '.live' : null;

  // if a dismissed draft empties out, drop back to the working caret
  useEffect(() => {
    if (dismissed && !hasMeaningful) setDismissed(false);
  }, [dismissed, hasMeaningful]);

  // restore a saved draft once, on mount — every room composer (bottom + each
  // reply / reply-to-reply), each from its own key
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          setItems(arr.map((d: any) => ({ id: newId(), type: d.type ?? d.kind, text: d.text, duration: d.duration, transcript: d.transcript }) as Draft));
          setDraftSaved(true);
          if (!inline) setDismissed(true);   // bottom composer restores quietly
        }
      }
    } catch (_e) { /* ignore */ }
    // restore the uncommitted live caret line as a block (React manages the
    // live <p>, so we can't safely seed its text; committing it survives reload)
    if (liveDraftKey) {
      try {
        const lv = window.localStorage.getItem(liveDraftKey);
        if (lv && lv.trim()) {
          setItems((d) => d.concat({ id: newId(), type: 'text', text: lv.trim() }));
          window.localStorage.removeItem(liveDraftKey);
        }
      } catch (_e) { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist / clear the draft as it changes (edit drafts stay in-memory). The
  // draft clears on send (items emptied) or when the user empties it.
  useEffect(() => {
    if (!draftKey) return;
    if (!hasMeaningful) {
      try { window.localStorage.removeItem(draftKey); } catch (_e) {}
      setDraftSaved(false);
      return;
    }
    const t = setTimeout(() => {
      try {
        const save = items
          .filter((i) => (i.type === 'text' && i.text && i.text.trim()) || i.type === 'voice')
          .map((i) => ({ type: i.type, text: (i as any).text, duration: (i as any).duration, transcript: (i as any).transcript }));
        if (save.length) { window.localStorage.setItem(draftKey, JSON.stringify(save)); setDraftSaved(true); }
        else { window.localStorage.removeItem(draftKey); setDraftSaved(false); }
      } catch (_e) { /* ignore */ }
    }, 350);
    return () => clearTimeout(t);
  }, [items, draftKey, hasMeaningful]);

  /* ── media (photos + video) ──────────────────────────────────────────────
     The room throws in both: an image becomes a `photo` item (batches into the
     AliaMediaGrid gallery), a video becomes a `video` item (photos and videos
     share the same justified gallery). */
  const pickPhotos = () => { setOpen(false); commitLive(); photoInput.current?.click(); };
  const addPhotos = (files: File[]) => {
    const media = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!media.length) return;
    wakeSheet();
    setItems((prev) => {
      const add = media.map<Draft>((f) =>
        f.type.startsWith('video/')
          ? { id: newId(), type: 'video', src: URL.createObjectURL(f) }
          : { id: newId(), type: 'image', src: URL.createObjectURL(f) });
      // capture native ratio for gallery packing so each cell matches its media
      // exactly — nothing is cropped (photos AND videos).
      add.forEach((it) => {
        if (it.type === 'image') {
          const im = new Image();
          im.onload = () => setItems((d) => d.map((x) => (x.id === it.id && x.type === 'image' ? { ...x, aspect: im.naturalWidth / im.naturalHeight } : x)));
          im.src = it.src!;
        } else if (it.type === 'video') {
          const v = document.createElement('video');
          v.preload = 'metadata';
          v.onloadedmetadata = () => { if (!v.videoWidth) return; setItems((d) => d.map((x) => (x.id === it.id && x.type === 'video' ? { ...x, w: v.videoWidth, h: v.videoHeight } : x))); };
          v.src = it.src!;
        }
      });
      return [...prev, ...add];
    });
  };

  /* ── text ──────────────────────────────────────────────────────────────── */
  const commitText = () => {
    const id = editingId; if (!id) return;
    const el = textRef.current;
    const v = lightAutocorrect((el?.innerText || '').replace(/\u00a0/g, ' ').trim());
    setEditingId(null);
    if (!v) remove(id);           // an empty text block is dropped
    else patch(id, { text: v });
  };
  const onTextKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
    if (e.key === 'Escape') { e.preventDefault(); commitText(); }
  };
  const onTextInput = () => {
    const el = textRef.current; if (!el) return;
    el.classList.toggle('empty', !el.textContent?.trim());
  };

  /* ── room working caret ── the live text line at the tail of the feed ────
     Type straight in; Enter commits the line as a text block and keeps the
     caret for the next one. voice / media / send commit it first so nothing
     typed is lost. */
  const onLiveInput = () => {
    const el = liveRef.current; if (!el) return;
    setHasLive(!!el.textContent && !!el.textContent.trim());
    if (liveDraftKey) {
      try {
        const t = (el.innerText || '').replace(/\u00a0/g, ' ');
        if (t.trim()) window.localStorage.setItem(liveDraftKey, t);
        else window.localStorage.removeItem(liveDraftKey);
      } catch (_e) { /* ignore */ }
    }
  };
  const readLive = (): string => {
    const el = liveRef.current;
    return el ? (el.innerText || '').replace(/\u00a0/g, ' ').trim() : '';
  };
  const clearLive = () => {
    const el = liveRef.current; if (el) el.textContent = ''; setHasLive(false);
    if (liveDraftKey) { try { window.localStorage.removeItem(liveDraftKey); } catch (_e) {} }
  };
  /* A bare pasted/typed URL becomes a link item (preview card), not text. */
  const makeLinkItem = (raw: string): Draft => {
    const info = cmParseLink(raw);
    return { id: newId(), type: 'link-ref', url: info.url, label: info.label };
  };
  const commitLive = () => {
    const v = readLive();
    if (v) setItems((d) => [...d, cmLooksLikeUrl(v) ? makeLinkItem(v) : { id: newId(), type: 'text', text: lightAutocorrect(v) }]);
    clearLive();
  };
  /* Paste a link straight into the caret → drop the preview card in-flow.
     Any text already typed before the paste commits first as its own line. */
  const onLivePaste = (e: React.ClipboardEvent) => {
    const raw = (((e.clipboardData || (window as any).clipboardData)?.getData('text')) || '').trim();
    if (!raw || !cmLooksLikeUrl(raw)) return;   // non-URL paste falls through to default
    e.preventDefault();
    const existing = readLive();
    clearLive();
    setItems((d) => {
      const next = [...d];
      if (existing) next.push({ id: newId(), type: 'text', text: lightAutocorrect(existing) });
      next.push(makeLinkItem(raw));
      return next;
    });
  };
  const onLiveKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitLive(); }
  };
  const armVoiceInline = () => { commitLive(); setRecording(true); };
  // seed the editable with the item's text + caret at end when entering edit mode
  useEffect(() => {
    if (!editingId) return;
    const el = textRef.current; if (!el) return;
    const it = itemsRef.current.find((x) => x.id === editingId);
    el.textContent = it && it.type === 'text' ? it.text : '';
    el.classList.toggle('empty', !el.textContent);
    el.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const s = window.getSelection(); if (s) { s.removeAllRanges(); s.addRange(r); }
  }, [editingId]);

  /* the working caret is focus-ready on mount — type straight into the room */
  useEffect(() => {
    if (editingId || recording) return;
    const el = liveRef.current;
    if (el && !el.textContent) el.classList.add('empty');
  }, [editingId, recording]);

  /* keep newest content in view when the surface GROWS (room). Also jump to the
     recorder the moment recording starts, the same way a new text block does. */
  const prevLen = useRef(0);
  const prevRec = useRef(false);
  useEffect(() => {
    const s = document.querySelector('.feed') as HTMLElement | null;
    if (!inline && s) {
      const grew = items.length > prevLen.current;
      const startedRec = recording && !prevRec.current;
      if (grew || startedRec) requestAnimationFrame(() => { s.scrollTop = s.scrollHeight; });
    }
    prevLen.current = items.length;
    prevRec.current = recording;
  }, [items, editingId, recording]);

  /* ── pointer drag-to-reorder — shared across ALL item types ─── */
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<any>(null);
  const itemSel = '.rb-item';

  const moveItem = (from: number, to: number) => {
    if (from < 0 || to < 0 || from === to) return;
    setItems((prev) => { const a = [...prev]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return a; });
  };
  const autoScroll = () => {
    const st = drag.current; if (!st) return;
    const m = 84, speed = 16, y = st.pointerY;
    // scroll whatever container this component actually lives in (captured at
    // drag start); fall back to the window if it flows in the document.
    const sc = st.scroller as HTMLElement | null;
    if (sc) {
      const r = sc.getBoundingClientRect();
      if (y < r.top + m) sc.scrollTop -= speed * ((r.top + m - y) / m);
      else if (y > r.bottom - m) sc.scrollTop += speed * ((y - (r.bottom - m)) / m);
    } else {
      const vh = window.innerHeight;
      if (y < m) window.scrollBy(0, -speed * ((m - y) / m));
      else if (y > vh - m) window.scrollBy(0, speed * ((y - (vh - m)) / m));
    }
    st.raf = requestAnimationFrame(autoScroll);
  };
  /* Lift-and-drop reorder — the fix for the "blinking" jitter. We DON'T reorder
     the list while dragging (that re-justified the gallery every frame, which
     moved the cells under the pointer and oscillated). Instead the grabbed cell
     is lifted out of the flow visually (position:relative + transform, so its
     box stays and nothing else moves) and follows the finger. The drop position
     is computed ONCE on release from the pointer's 2D position — row by Y, slot
     within the row by X — then the list reorders a single time. */
  const liftFollow = () => {
    const st = drag.current; if (!st || !st.rect0) return;
    const dx = st.pointerX - st.grabDx - st.rect0.left;
    const dy = st.pointerY - st.grabDy - st.rect0.top;
    st.cell.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const resetCell = (cell: HTMLElement) => {
    cell.style.position = ''; cell.style.zIndex = ''; cell.style.pointerEvents = '';
    cell.style.transform = ''; cell.style.willChange = '';
  };
  /* which cell the drop lands before (null = append at the end) — 2D, computed
     from the STATIC cells (the lifted cell is skipped, it's under the finger). */
  const dropBeforeId = (): string | null => {
    const st = drag.current; if (!st) return null;
    const cells = (Array.from(document.querySelectorAll(itemSel)) as HTMLElement[]).filter((c) => c !== st.cell);
    for (const c of cells) {
      const r = c.getBoundingClientRect();
      if (st.pointerY < r.top) return c.dataset.id || null;                                  // above this row
      if (st.pointerY <= r.bottom && st.pointerX < r.left + r.width / 2) return c.dataset.id || null; // in row, left of centre
    }
    return null;
  };
  /* Gallery cell drop → explicit rows. Dragging a media cell WITHIN its gallery,
     the release decides its row (Y) and slot (X): drop onto a row to join it
     (capped at MAX_PER_ROW — a full row bumps you to a new row after), or drop
     above the first / below the last / into a between-rows gap to start a new
     row. Returns the run's new order + the cells that now START a row (all rows
     past the first), stored as rowBreak so the split survives into the sent feed.
     null = released outside the gallery → the normal linear reorder handles it. */
  const galleryRunLayout = (st: any): { order: string[]; breaks: Set<string> } | null => {
    const cell = st.cell as HTMLElement;
    if (!cell.classList.contains('rb-gal-cell')) return null;
    const gallery = cell.closest('.imgs-gallery') as HTMLElement | null;
    if (!gallery) return null;
    const gr = gallery.getBoundingClientRect();
    const M = 60, pX = st.pointerX, pY = st.pointerY;
    if (pX < gr.left - M || pX > gr.right + M || pY < gr.top - M || pY > gr.bottom + M) return null;
    const draggedId = st.id as string;
    const rowEls = Array.from(gallery.querySelectorAll('.imgs-row')) as HTMLElement[];
    if (!rowEls.length) return null;
    const rows = rowEls.map((el) => {
      const r = el.getBoundingClientRect();
      const cells = (Array.from(el.querySelectorAll('.rb-gal-cell')) as HTMLElement[]).filter((c) => c.dataset.id !== draggedId);
      return { top: r.top, bottom: r.bottom, cells, ids: cells.map((c) => c.dataset.id as string) };
    });
    const B = 14;
    let placed = false;
    const newRowAt = (i: number) => { rows.splice(i, 0, { top: 0, bottom: 0, cells: [], ids: [draggedId] }); placed = true; };
    if (pY < rows[0].top - B) newRowAt(0);
    else {
      for (let i = 0; i < rows.length && !placed; i++) {
        const r = rows[i];
        const nextTop = i + 1 < rows.length ? rows[i + 1].top : Infinity;
        if (pY >= r.top - B && pY <= r.bottom + B) {
          if (r.ids.length >= MAX_PER_ROW) newRowAt(i + 1);
          else {
            let slot = r.cells.length;
            for (let j = 0; j < r.cells.length; j++) {
              const cr = r.cells[j].getBoundingClientRect();
              if (pX < cr.left + cr.width / 2) { slot = j; break; }
            }
            r.ids.splice(slot, 0, draggedId); placed = true;
          }
        } else if (pY > r.bottom + B && pY < nextTop - B) {
          newRowAt(i + 1);
        }
      }
    }
    if (!placed) rows.push({ top: 0, bottom: 0, cells: [], ids: [draggedId] });
    const order: string[] = [];
    const breaks = new Set<string>();
    rows.map((r) => r.ids).filter((ids) => ids.length).forEach((ids) => {
      for (let s = 0; s < ids.length; s += MAX_PER_ROW) {
        const chunk = ids.slice(s, s + MAX_PER_ROW);
        if (order.length) breaks.add(chunk[0]);
        order.push(...chunk);
      }
    });
    return { order, breaks };
  };
  const onDragMove = (e: PointerEvent) => {
    const st = drag.current; if (!st) return;
    st.pointerX = e.clientX; st.pointerY = e.clientY;
    if (!st.started) {
      if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < 6) return;
      st.started = true; setDragId(st.id);
      const r = st.cell.getBoundingClientRect();
      st.rect0 = r; st.grabDx = st.startX - r.left; st.grabDy = st.startY - r.top;
      st.cell.style.position = 'relative';
      st.cell.style.zIndex = '9999';
      st.cell.style.pointerEvents = 'none';
      st.cell.style.willChange = 'transform';
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
      const layout = galleryRunLayout(st);
      resetCell(cell);                              // clear lift styles BEFORE the reorder re-render
      if (layout) {
        // dragged within a gallery — reorder the run AND record the explicit rows
        const { order, breaks } = layout;
        setItems((prev) => {
          const runIds = new Set(order);
          const idxs = prev.map((x, i) => (runIds.has(x.id) ? i : -1)).filter((i) => i >= 0);
          if (!idxs.length) return prev;
          const byId = new Map(prev.map((x) => [x.id, x] as const));
          const runItems = order.map((rid) => ({ ...(byId.get(rid) as Draft), rowBreak: breaks.has(rid) }));
          const out = [...prev];
          out.splice(idxs[0], idxs.length, ...runItems);
          return out;
        });
      } else {
        // dropped outside a gallery — plain linear reorder; clear any stale row flag
        const beforeId = dropBeforeId();
        setItems((prev) => {
          const dragged = prev.find((x) => x.id === id);
          if (!dragged) return prev;
          const moved = { ...dragged, rowBreak: undefined } as Draft;
          const arr = prev.filter((x) => x.id !== id);
          const idx = beforeId ? arr.findIndex((x) => x.id === beforeId) : arr.length;
          arr.splice(idx < 0 ? arr.length : idx, 0, moved);
          return arr;
        });
      }
    }
    drag.current = null; setDragId(null);
    if (!started) {
      // A tap (no drag) acts on the block directly:
      //   text  → opens the inline editor
      //   everything else → NOTHING. Removal is a deliberate top-right corner
      //   hot zone per block (see .rb-remove-hot), never a tap on the whole cell.
      const it = itemsRef.current.find((x) => x.id === id);
      if (it && it.type === 'text') setEditingId(it.id);
    }
  };
  const onItemPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.play-btn, .icon-btn, .speed, .av-ctrl, .av-track, .transcript, [contenteditable="true"], a')) return;
    const cell = e.currentTarget as HTMLElement;
    drag.current = { id, cell, startX: e.clientX, startY: e.clientY, pointerX: e.clientX, pointerY: e.clientY, started: false, raf: null, rect0: null, grabDx: 0, grabDy: 0 };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp, { once: true });
    window.addEventListener('pointercancel', onDragUp, { once: true });
  };

  /* ── shared bits of render ───────────────────────────────────────────────── */
  const recorder = (
    <AliaVoiceRecorder
      onComplete={(v) => { addVoice({ id: newId(), type: 'voice', duration: v.duration, transcript: v.transcript, src: v.src }); setRecording(false); }}
      onCancel={() => setRecording(false)}
    />
  );
  // the compose text line IS the canonical AliaText block in its editable mode
  const textEditor = (cls: string) => (
    <AliaText
      editable
      ref={textRef}
      className={cls}
      onInput={onTextInput}
      onKeyDown={onTextKey}
      onBlur={commitText}
    />
  );

  function send() {
    const liveText = readLive();
    // fold the uncommitted caret line into the ordered drafts, then batch to Block[]
    const drafts = [...itemsRef.current];
    if (liveText) drafts.push(cmLooksLikeUrl(liveText) ? makeLinkItem(liveText) : { id: newId(), type: 'text', text: lightAutocorrect(liveText) });
    const out = draftsToBlocks(drafts);
    if (out.length) onSend?.(out);
    if (draftKey) { try { window.localStorage.removeItem(draftKey); } catch (_e) {} }
    if (liveDraftKey) { try { window.localStorage.removeItem(liveDraftKey); } catch (_e) {} }
    setDraftSaved(false);
    setItems([]); clearLive(); setEditingId(null); setRecording(false); setOpen(false); setDismissed(false);
  }

  /* ═══ ROOM MODE ═══════════════════════════════════════════════════════════
     Embedded composer — a persistent "you" draft at the TAIL of the feed. No
     bar, no overlay. The working caret (.rb-live) IS the cursor: it sits in the
     feed and you type straight into it; Enter commits the line as a block and
     keeps the caret for the next. voice · media · send are quiet inline tools
     beneath the body. */
  {
    const kindOf = (it: Draft) => (it.type === 'image' ? 'media' : it.type);
    const gapCls = (i: number) => {
      if (i === 0) return 'block';
      return kindOf(items[i - 1]) === kindOf(items[i]) ? 'block gap-same' : 'block gap-diff';
    };
    const hasAnything = items.length > 0 || hasLive;
    const hasDraftText = items.some((i) => i.type === 'text' && i.text && i.text.trim()) || hasLive;
    // translate the draft's text into English (compose in your language, sends in English)
    const translateDraft = () => {
      commitLive();
      setTimeout(async () => {
        const texts = itemsRef.current.filter((i) => i.type === 'text' && i.text && i.text.trim()) as Array<Extract<Draft, { type: 'text' }>>;
        if (!texts.length) return;
        try {
          const prompt =
            'Translate each string in this JSON array into English. Reply with ONLY a JSON array of the translations, in the same order, no other text.\n\n' +
            JSON.stringify(texts.map((t) => t.text));
          const res = await (window as any).claude.complete(prompt);
          let arr: any;
          try { arr = JSON.parse(res); } catch (_e) { const m = String(res).match(/\[[\s\S]*\]/); arr = m ? JSON.parse(m[0]) : null; }
          if (!Array.isArray(arr)) return;
          setItems((d) => d.map((it) => { const k = texts.findIndex((t) => t.id === it.id); return k >= 0 && arr[k] != null && it.type === 'text' ? { ...it, text: String(arr[k]) } : it; }));
        } catch (_e) {}
      }, 0);
    };
    // group consecutive photos so a run of 2+ renders as one justified gallery
    // (a single photo still renders full width); everything else stays per-item.
    type Group =
      | { type: 'single'; it: Draft; index: number }
      | { type: 'media'; run: Draft[]; index: number };
    const groups: Group[] = [];
    for (let i = 0; i < items.length;) {
      if (items[i].type === 'image' || items[i].type === 'video') {
        const run: Draft[] = []; const start = i;
        while (i < items.length && (items[i].type === 'image' || items[i].type === 'video')) run.push(items[i++]);
        groups.push({ type: 'media', run, index: start });
      } else { groups.push({ type: 'single', it: items[i], index: i }); i++; }
    }
    /* Tap anywhere in the open composer (not on a tool / committed block / other
       editable) drops the caret into the live line — so the "second tap" lands
       the cursor no matter where in the composer it falls, not only on the thin
       live-text line. */
    const focusLiveFromSurface = (e: React.MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.rb-tool, .rb-item, .rb-remove-hot, button, a, [contenteditable="true"], .play-btn, video, audio, input, textarea')) return;
      const el = liveRef.current; if (!el) return;
      el.focus();
      const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
      const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
    };
    return (
      <div className={'rb-compose' + (inline ? ' rb-inline' : '') + (dragId ? ' is-dragging' : '')} ref={surfRef} onClick={focusLiveFromSurface}>
        <div className="body">
          {groups.map((g) => {
            if (g.type === 'media') {
              // Any run of photos/videos → the SAME block group the feed uses,
              // AliaMediaGrid layout="masonry": the room's 2-col CSS-multicol grid.
              // The composer owns the cells + cross-block drag (linear reorder).
              return (
                <AliaMediaGrid
                  gallery
                  layout="masonry"
                  key={'gal-' + g.run[0].id}
                  gapClass={gapCls(g.index)}
                  activeDragId={dragId}
                  cells={g.run.map((d) => ({
                    id: d.id,
                    src: d.type === 'image' || d.type === 'video' ? d.src : undefined,
                    kind: d.type === 'video' ? 'video' : 'photo',
                    captionsSrc: d.type === 'video' ? AV_CAPTIONS_VTT : undefined,
                  }))}
                  onCellPointerDown={onItemPointerDown}
                  onCellRemove={remove}
                />
              );
            }
            const it = g.it; const i = g.index;
            // Types whose content is left-aligned and narrower than the column
            // (voice bar, text-styled link, an attributed quote) HUG their content
            // so the top-right remove hot zone lands on the block, not out in the
            // black. Media/video anchor their own hot zone internally.
            const hug = it.type === 'voice' || it.type === 'link-ref';
            return it.type === 'text' && editingId === it.id ? (
              <Fragment key={it.id}>{textEditor('text rb-editing empty ' + gapCls(i))}</Fragment>
            ) : (
              <div
                className={'rb-item ' + (hug ? 'rb-hug ' : '') + gapCls(i) + (dragId === it.id ? ' dragging' : '')}
                key={it.id} data-id={it.id}
                onPointerDown={(e) => onItemPointerDown(e, it.id)}
              >
                {it.type === 'voice' ? <AliaVoice duration={it.duration} transcript={it.transcript} src={it.src} />
                 : it.type === 'video' ? <AliaVideo src={it.src} captionsSrc={AV_CAPTIONS_VTT} autoplay controls />
                 : it.type === 'link-image' ? <AliaLinkPreview src={it.src} label={it.label} onRemove={() => remove(it.id)} />
                 : it.type === 'link-ref' ? <AliaLinkFallback label={it.label} />
                 : it.type === 'text' ? <AliaText text={it.text} />
                 : null}
                {it.type !== 'text' && it.type !== 'link-image' ? (
                  <button type="button" className="rb-remove-hot" aria-label="remove" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(it.id); }} />
                ) : null}
              </div>
            );
          })}
          {recording ? (
            <div className={'block' + (items.length ? ' gap-diff' : '')}>{recorder}</div>
          ) : (
            <p
              ref={liveRef}
              className={'text rb-live' + (items.length ? ' gap-same' : '')}
              contentEditable suppressContentEditableWarning spellCheck={false} autoCorrect="off" autoCapitalize="off"
              onInput={onLiveInput}
              onKeyDown={onLiveKey}
              onPaste={onLivePaste}
              onBlur={commitLive}
            />
          )}
          <div className="rb-tools">
            <button className="rb-tool" onClick={armVoiceInline}>voice</button>
            <button className="rb-tool" onClick={pickPhotos}>media</button>
            {hasDraftText ? <button className="rb-tool" onClick={translateDraft}>translate</button> : null}
            {hasAnything ? <button className="rb-tool rb-send" onClick={send}>send</button> : null}
            {replyMode?.kind === 'edit' && onUnsend ? <button className="rb-tool rb-unsend" onClick={onUnsend}>unsend</button> : null}
            {draftSaved ? <span className="rb-saved">saved</span> : null}
          </div>
        </div>
        <input ref={photoInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addPhotos(Array.from(e.target.files || [])); e.target.value = ''; }} />
      </div>
    );
  }

}
