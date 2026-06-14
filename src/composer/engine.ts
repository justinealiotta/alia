/* ───────────────────────────────────────────────────────────────────────────
   composer/engine.ts — Alia composer engine (TipTap / ProseMirror).

   TipTap v2 + ProseMirror (loaded from esm.sh), with custom BLOCK atom nodes
   (photo · voice · gif · linkref · linkpreview), a Gapcursor caret model,
   drag-to-reorder, inline URL→link-ref conversion, paste-image→photo, a
   recording surface, draft autosave, and deterministic serialize() ordering.

   Rather than a global singleton, this exports a factory,
   `createAliaComposer()`, that resolves to a controller bound to one editor
   instance. All engine internals live inside the factory closure, so nothing
   leaks to the global scope. `addgif` is routed to an `onAddGif` config
   callback (the GIF sheet is owned by React).
   ─────────────────────────────────────────────────────────────────────────── */

import { cmIcon } from './iconHtml';
import { cmLooksLikeUrl, cmParseLink } from './links';

export interface ComposerMountOpts {
  mode?: string;
  placeholder?: string;
  onSend?: (items: any[]) => void;
  onChange?: (() => void) | null;
  onAddGif?: (() => void) | null;
  disableMedia?: boolean;
  disableVoice?: boolean;
  disableLinks?: boolean;
  showGif?: boolean;
  textOnly?: boolean;
  keepIcons?: boolean;
  avatarPicker?: boolean;
  maxPhotos?: number;
  maxVoice?: number;
  maxGif?: number;
  voiceTranscript?: string;
  preload?: any[] | null;
}

export interface AliaComposerController {
  mount: (dockEl: HTMLElement, opts: ComposerMountOpts) => void;
  serialize: () => any[];
  isEmpty: () => boolean;
  reset: () => void;
  focus: () => void;
  insertPhoto: (src: string) => void;
  insertNode: (dom: HTMLElement) => void;
  photoCount: () => number;
  setScale: (n: number) => void;
  destroy: () => void;
}

/** Optional renderer the host injects so the composer's voice atom is drawn by
 *  the canonical <AliaVoice> React component (instead of the engine's fallback
 *  imperative DOM). Receives the `.atom-voice` container + the atom's data;
 *  returns a cleanup that unmounts whatever it mounted. */
export type VoiceAtomRenderer = (
  container: HTMLElement,
  props: { duration: number; transcript: string },
) => (() => void);

export interface CreateComposerOpts {
  /** Render voice atoms with the shared <AliaVoice> component. */
  renderVoiceAtom?: VoiceAtomRenderer;
}

/** Build a composer engine instance. Resolves once TipTap has loaded. */
export async function createAliaComposer(
  engineOpts: CreateComposerOpts = {},
): Promise<AliaComposerController> {
  const renderVoiceAtom = engineOpts.renderVoiceAtom;
  /* ── 1. Load TipTap ──────────────────────────────────────────────────── */
  const [
    { Editor, Node, Extension, mergeAttributes },
    { default: StarterKit },
    { Selection, TextSelection },
    { GapCursor },
  ] = await Promise.all([
    import('https://esm.sh/@tiptap/core@2'),
    import('https://esm.sh/@tiptap/starter-kit@2'),
    import('https://esm.sh/@tiptap/pm@2/state'),
    import('https://esm.sh/@tiptap/pm@2/gapcursor'),
  ]);

  /* ── 2. Helpers ──────────────────────────────────────────────────────── */
  const icon = cmIcon;
  const looksLikeUrl = cmLooksLikeUrl;
  const parseLink = cmParseLink;

  function esc(s = ''): string {
    return String(s).replace(/[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  const AMP = [
    0.55, 0.78, 0.42, 0.92, 0.60, 0.35,
    0.88, 0.50, 0.70, 1.00, 0.58, 0.46,
    0.82, 0.66, 0.40, 0.74, 0.52, 0.90,
    0.60, 0.48, 0.72, 0.38,
  ];
  const NBARS = AMP.length;

  function barCountForDuration(dur: number): number {
    return Math.round(Math.max(8, Math.min(44, 6 + Math.sqrt(dur) * 2.5)));
  }
  function voiceBars(progress = 0, count?: number): string {
    count = count || AMP.length;
    const cutoff = Math.floor(count * progress);
    return Array.from({ length: count }, (_, i) => {
      const h = AMP[i % AMP.length];
      const cls = i < cutoff ? ' class="on"' : '';
      return `<i${cls} style="--h:${h};--d:${(i * 53) % 1100}ms"></i>`;
    }).join('');
  }
  function miniWave(): string {
    return AMP.slice(0, 16).map((h, i) => `<i style="--h:${h};--d:${(i * 61) % 1100}ms"></i>`).join('');
  }
  function fmt(s: number): string {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  const VOICE_TRANSCRIPT =
    'hey — pulled you into p2p, that thing i kept talking about. ' +
    "use the password i'm sending, and keep it to yourself.";
  const MAX_ATOMS = 10;
  const VK = () => (window as any).VoiceKaraoke;

  /* ── 3. Module state ─────────────────────────────────────────────────── */
  let tiptap: any = null;
  let dock: HTMLElement | null = null;
  let cfg: ComposerMountOpts & Record<string, any> = {
    placeholder: 'write something…',
    onSend: () => {},
    disableMedia: false, disableVoice: false, showGif: false, textOnly: false,
    maxPhotos: 5, maxVoice: 1, voiceTranscript: VOICE_TRANSCRIPT, preload: null, onChange: null,
  };
  let currentScale = 1;
  const recState = { mode: 'idle' as 'idle' | 'recording' | 'paused' };
  let recElapsed = 0;
  let recTimer: any = null;
  let recRAF: any = null;

  const MODES: Record<string, Record<string, any>> = {
    room: {
      placeholder: '', disableMedia: false, disableVoice: false, showGif: false, textOnly: false,
      maxPhotos: 5, maxVoice: 2,
    },
    application: {
      placeholder: 'dm alia', disableMedia: false, disableVoice: false, showGif: false, textOnly: false,
      maxPhotos: 5, maxVoice: 1,
    },
    otp: {
      placeholder: 'dm alia', disableMedia: true, disableVoice: true, showGif: false, textOnly: false,
      keepIcons: true, disableLinks: true, maxPhotos: 0, maxVoice: 0,
    },
    'p2p-onboarding': {
      placeholder: 'dm alia', disableMedia: false, disableVoice: true, showGif: false, textOnly: false,
      keepIcons: true, avatarPicker: true, maxPhotos: 1, maxVoice: 0,
    },
    'casting-onboarding': {
      placeholder: 'dm alia', disableMedia: false, disableVoice: true, showGif: false, textOnly: false,
      keepIcons: true, avatarPicker: true, maxPhotos: 1, maxVoice: 0,
    },
    'p2p-referral': {
      placeholder: 'dm alia', disableMedia: false, disableVoice: false, showGif: false, textOnly: false,
      maxPhotos: 5, maxVoice: 2,
    },
    profile: {
      placeholder: 'dm alia', disableMedia: true, disableVoice: true, showGif: false, textOnly: false,
      keepIcons: true, disableLinks: true, maxPhotos: 0, maxVoice: 0,
    },
    reply: {
      placeholder: '', disableMedia: true, disableVoice: false, showGif: true, textOnly: false,
      maxPhotos: 0, maxVoice: 1, maxGif: 1,
    },
    edit: {
      placeholder: 'edit your message…', disableMedia: false, disableVoice: false, showGif: false, textOnly: false,
      maxPhotos: 5, maxVoice: 1,
    },
  };

  /* ── 4. Selection helpers ────────────────────────────────────────────── */
  const isNodeSel = (sel: any) => !!sel?.node;
  const isGapSel = (sel: any) => sel?.toJSON?.().type === 'gapcursor';

  function selectionAfterPos(doc: any, pos: number) {
    const $pos = doc.resolve(pos);
    if ($pos.nodeAfter?.isTextblock) return TextSelection.create(doc, pos + 1);
    try {
      if (!GapCursor.valid || GapCursor.valid($pos)) return new GapCursor($pos);
    } catch { /* noop */ }
    return Selection.near($pos, -1);
  }

  const ATOM_TYPES = new Set(['photo', 'voice', 'gif', 'linkref', 'linkpreview']);

  /* ── 5. Custom Nodes ─────────────────────────────────────────────────── */
  const PhotoNode = Node.create({
    name: 'photo', group: 'block', inline: false, atom: true,
    selectable: true, draggable: true, isolating: true,
    addAttributes() { return { src: { default: null }, kind: { default: 'photo' } }; },
    parseHTML() { return [{ tag: 'div[data-type="photo"]' }]; },
    renderHTML({ HTMLAttributes }: any) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'photo' })]; },
    addNodeView() {
      return ({ node }: any) => {
        const { src, kind } = node.attrs;
        if (kind === 'avatar') {
          const D = 160;
          let ratio = 1, zoom = 1, tx = 0, ty = 0;
          const dom = document.createElement('div');
          dom.className = 'atom atom-avatar'; dom.contentEditable = 'false'; dom.draggable = true;
          const view = document.createElement('span'); view.className = 'av-view';
          const img = document.createElement('img'); img.src = src || ''; img.alt = ''; img.draggable = false;
          view.appendChild(img); dom.appendChild(view);
          const dimsFor = (z: number) => ratio >= 1 ? { w: D * z * ratio, h: D * z } : { w: D * z, h: D * z / ratio };
          const clampPos = () => { const { w, h } = dimsFor(zoom); const mx = Math.max(0, (w - D) / 2), my = Math.max(0, (h - D) / 2); tx = Math.min(mx, Math.max(-mx, tx)); ty = Math.min(my, Math.max(-my, ty)); };
          const applyToImg = () => { const { w, h } = dimsFor(zoom); img.style.width = w + 'px'; img.style.height = h + 'px'; img.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`; };
          const ready = () => { ratio = (img.naturalWidth / img.naturalHeight) || 1; zoom = 1; tx = 0; ty = 0; clampPos(); applyToImg(); };
          if (img.complete && img.naturalWidth) ready(); else img.addEventListener('load', ready);
          const pts = new Map<number, { x: number; y: number }>();
          let sx = 0, sy = 0, ox = 0, oy = 0, pinchDist = 0, pinchZoom = 1;
          const dist2 = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
          const setZoom = (z: number) => { zoom = Math.min(3, Math.max(1, z)); clampPos(); applyToImg(); };
          const release = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size === 1) { const [p] = [...pts.values()]; sx = p.x; sy = p.y; ox = tx; oy = ty; } };
          view.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); view.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { sx = e.clientX; sy = e.clientY; ox = tx; oy = ty; } else if (pts.size === 2) { pinchDist = dist2(); pinchZoom = zoom; } });
          view.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size >= 2) { const d = dist2(); if (pinchDist > 0) setZoom(pinchZoom * (d / pinchDist)); } else { tx = ox + (e.clientX - sx) / (currentScale || 1); ty = oy + (e.clientY - sy) / (currentScale || 1); clampPos(); applyToImg(); } });
          view.addEventListener('pointerup', release);
          view.addEventListener('pointercancel', release);
          view.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * (1 - e.deltaY * 0.0015)); }, { passive: false });
          return { dom };
        }
        const dom = document.createElement('div');
        dom.className = 'atom atom-photo'; dom.contentEditable = 'false'; dom.draggable = true;
        const media = kind === 'video'
          ? Object.assign(document.createElement('video'), { src, muted: true, playsInline: true, preload: 'metadata' })
          : Object.assign(document.createElement('img'), { src: src || '', alt: '', draggable: false });
        Object.assign(media.style, { width: '56px', height: 'auto', display: 'block', pointerEvents: 'none' });
        dom.appendChild(media);
        return { dom };
      };
    },
  });

  const VoiceNode = Node.create({
    name: 'voice', group: 'block', inline: false, atom: true,
    selectable: true, draggable: true, isolating: true,
    addAttributes() { return { duration: { default: 6 }, transcript: { default: '' } }; },
    parseHTML() { return [{ tag: 'div[data-type="voice"]' }]; },
    renderHTML({ HTMLAttributes }: any) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'voice' })]; },
    addNodeView() {
      return ({ node }: any) => {
        const { duration, transcript } = node.attrs;
        const dom = document.createElement('div');
        dom.className = 'atom atom-voice'; dom.contentEditable = 'false'; dom.draggable = true;

        /* Preferred path: render the canonical <AliaVoice> component (injected
           by the React host). Same component the feed uses — one source of
           truth for the voice message. */
        if (renderVoiceAtom) {
          // Don't let a tap on the play button start a node drag / selection.
          dom.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).closest('.play-btn')) e.stopPropagation();
          }, true);
          const cleanup = renderVoiceAtom(dom, { duration, transcript });
          return {
            dom,
            // React owns the subtree — ProseMirror must not read/rewrite it.
            ignoreMutation: () => true,
            destroy: () => { try { cleanup(); } catch { /* */ } },
          };
        }

        /* Fallback path: framework-free imperative DOM (kept so the engine can
           run without a React host). */
        const avRow = document.createElement('span'); avRow.className = 'voice-row';
        const playBtn = document.createElement('button');
        playBtn.className = 'play-btn'; playBtn.setAttribute('data-play', ''); playBtn.setAttribute('aria-label', 'Play');
        playBtn.innerHTML = icon('play', 18); playBtn.draggable = false;
        playBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
        const waveEl = document.createElement('span'); waveEl.className = 'wave'; waveEl.innerHTML = miniWave();
        const durEl = document.createElement('span'); durEl.className = 'dur'; durEl.textContent = fmt(duration);
        avRow.append(playBtn, waveEl, durEl); dom.appendChild(avRow);
        if (transcript) {
          const trEl = document.createElement('span'); trEl.className = 'av-tr';
          trEl.innerHTML = VK() ? VK().wrapWords(transcript) : esc(transcript);
          dom.appendChild(trEl);
        }
        playBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const playing = dom.classList.toggle('playing');
          playBtn.innerHTML = playing ? icon('pause', 18) : icon('play', 18);
          if (playing) {
            VK()?.start(dom, duration, () => { dom.classList.remove('playing'); playBtn.innerHTML = icon('play', 18); });
            startWaveProgress(dom, waveEl, duration);
          } else { VK()?.pause(dom); }
        });
        return { dom };
      };
    },
  });

  const GifNode = Node.create({
    name: 'gif', group: 'block', inline: false, atom: true,
    selectable: true, draggable: true, isolating: true,
    addAttributes() { return { src: { default: null } }; },
    parseHTML() { return [{ tag: 'div[data-type="gif"]' }]; },
    renderHTML({ HTMLAttributes }: any) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'gif' })]; },
    addNodeView() {
      return ({ node }: any) => {
        const dom = document.createElement('div');
        dom.className = 'atom atom-gif'; dom.contentEditable = 'false'; dom.draggable = true;
        const img = Object.assign(document.createElement('img'), { src: node.attrs.src || '', alt: '', draggable: false });
        Object.assign(img.style, { width: '116px', height: 'auto', display: 'block', pointerEvents: 'none' });
        dom.appendChild(img);
        return { dom };
      };
    },
  });

  const LinkRefNode = Node.create({
    name: 'linkref', group: 'block', inline: false, atom: true,
    selectable: true, draggable: true, isolating: true,
    addAttributes() { return { url: { default: '' }, platform: { default: 'web' }, label: { default: '' } }; },
    parseHTML() { return [{ tag: 'div[data-type="linkref"]' }]; },
    renderHTML({ HTMLAttributes }: any) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'linkref' })]; },
    addNodeView() {
      return ({ node }: any) => {
        const dom = document.createElement('div');
        dom.className = 'atom atom-linkref'; dom.contentEditable = 'false'; dom.draggable = true;
        const labelEl = document.createElement('span'); labelEl.className = 'lr-label';
        labelEl.textContent = (node.attrs.label || '').toLowerCase();
        dom.appendChild(labelEl);
        return { dom };
      };
    },
  });

  const LinkPreviewNode = Node.create({
    name: 'linkpreview', group: 'block', inline: false, atom: true,
    selectable: true, draggable: true, isolating: true,
    addAttributes() { return { url: { default: '' }, platform: { default: 'web' }, label: { default: '' }, imageUrl: { default: null } }; },
    parseHTML() { return [{ tag: 'div[data-type="linkpreview"]' }]; },
    renderHTML({ HTMLAttributes }: any) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'linkpreview' })]; },
    addNodeView() {
      return ({ node }: any) => {
        const dom = document.createElement('div');
        dom.className = 'atom atom-link'; dom.contentEditable = 'false'; dom.draggable = true;
        const tile = document.createElement('span'); tile.className = 'lp-tile';
        if (node.attrs.imageUrl) {
          const img = document.createElement('img');
          img.src = node.attrs.imageUrl; img.alt = ''; img.draggable = false;
          img.style.cssText = 'width:100%;height:auto;display:block;pointer-events:none;';
          tile.appendChild(img);
        } else {
          const ph = document.createElement('span'); ph.className = 'img-ph'; ph.style.setProperty('--ar', '44 / 56');
          tile.appendChild(ph);
        }
        dom.appendChild(tile);
        return { dom };
      };
    },
  });

  /* ── 6. Node-type counting ───────────────────────────────────────────── */
  function countNodeType(name: string): number {
    if (!tiptap) return 0;
    let n = 0;
    tiptap.state.doc.descendants((node: any) => { if (node.type.name === name) n++; });
    return n;
  }
  function totalAtomCount(): number {
    return countNodeType('photo') + countNodeType('voice') + countNodeType('gif') + countNodeType('linkref') + countNodeType('linkpreview');
  }

  function tryConvertUrlBeforeCaret(): boolean {
    if (!tiptap || cfg.disableLinks) return false;
    const { selection } = tiptap.state;
    if (!selection.empty) return false;
    const nodeBefore = selection.$from.nodeBefore;
    if (!nodeBefore || !nodeBefore.isText) return false;
    const m = nodeBefore.text.match(/(\S+)$/);
    if (!m) return false;
    const word = m[1].replace(/\u200b/g, '');
    if (!looksLikeUrl(word) || totalAtomCount() >= MAX_ATOMS) return false;
    const to = selection.$from.pos;
    const from = to - m[1].length;
    const info = parseLink(word);
    tiptap.chain().deleteRange({ from, to }).run();
    insertAtom('linkref', { url: info.url, platform: info.platform, label: info.label });
    return true;
  }

  /* ── 7. Keyboard extension ───────────────────────────────────────────── */
  const ComposerKeys = Extension.create({
    name: 'composerKeys',
    addKeyboardShortcuts() {
      return {
        ' ': () => tryConvertUrlBeforeCaret(),
        Enter: () => {
          if (tryConvertUrlBeforeCaret()) return true;
          const sel = tiptap?.state.selection;
          if (isGapSel(sel)) {
            const pos = sel.head;
            tiptap.chain().insertContentAt(pos, { type: 'paragraph' }).setTextSelection(pos + 1).run();
            return true;
          }
          return false;
        },
        'Mod-Enter': () => { if (!isEmpty()) trySend(); return true; },
      };
    },
  });

  /* ── 8. Paste handler ────────────────────────────────────────────────── */
  function handlePaste(event: ClipboardEvent): boolean {
    const cd = event.clipboardData || (window as any).clipboardData;
    const imgItems = [...(cd?.items || [])].filter((it: any) => it.type.startsWith('image/'));
    if (imgItems.length) {
      event.preventDefault();
      imgItems.forEach((item: any) => {
        const file = item.getAsFile();
        if (file && totalAtomCount() < MAX_ATOMS) insertAtom('photo', { src: URL.createObjectURL(file), kind: 'photo' });
      });
      return true;
    }
    const txt = cd.getData('text');
    if (!txt) return false;
    const trimmed = txt.trim();
    if (!cfg.disableLinks && looksLikeUrl(trimmed) && totalAtomCount() < MAX_ATOMS) {
      event.preventDefault();
      const info = parseLink(trimmed);
      insertAtom('linkref', { url: info.url, platform: info.platform, label: info.label });
      return true;
    }
    return false;
  }

  /* ── 9. State + drafts ───────────────────────────────────────────────── */
  function isEmpty(): boolean { return tiptap ? tiptap.isEmpty : true; }

  let draftSaveTimer: any = null;
  function draftKey(): string | null { const m = cfg.mode || 'room'; return m === 'edit' ? null : `alia_draft_${m}`; }
  function saveDraft(): void {
    const key = draftKey(); if (!key) return;
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      const items = serialize();
      const sendBtn = dock?.querySelector('.icon-btn.send');
      if (!items.length) { try { localStorage.removeItem(key); } catch { /* */ } sendBtn?.removeAttribute('data-draft'); }
      else { try { localStorage.setItem(key, JSON.stringify(items)); sendBtn?.setAttribute('data-draft', ''); } catch { /* */ } }
    }, 800);
  }
  function clearDraft(): void {
    clearTimeout(draftSaveTimer);
    const key = draftKey(); if (!key) return;
    try { localStorage.removeItem(key); } catch { /* */ }
    dock?.querySelector('.icon-btn.send')?.removeAttribute('data-draft');
  }
  function restoreDraft(): void {
    const key = draftKey(); if (!key || !tiptap) return;
    let raw: string | null = null;
    try { raw = localStorage.getItem(key); } catch { /* */ }
    if (!raw) return;
    try {
      const items = JSON.parse(raw);
      const restorable = (items || []).filter((it: any) => !(it.type === 'photo' && /^blob:/.test(it.src || '')));
      if (!restorable.length) return;
      tiptap.commands.setContent(itemsToContent(restorable));
      dock?.querySelector('.icon-btn.send')?.setAttribute('data-draft', '');
      onChanged();
    } catch { /* */ }
  }

  function onChanged(): void {
    if (!tiptap) return;
    tiptap.view.dom.classList.toggle('empty', isEmpty());
    const sendBtn = dock?.querySelector('.icon-btn.send');
    if (sendBtn) sendBtn.classList.toggle('ready', !isEmpty());
    const cmEl = dock?.querySelector('.composer.cm-idle');
    if (cmEl) cmEl.classList.toggle('has-atoms', totalAtomCount() > 0);
    saveDraft();
    cfg.onChange?.();
  }

  /* ── 10. Wave progress (composer voice atoms) ────────────────────────── */
  function startWaveProgress(atomEl: any, waveEl: HTMLElement, durSec: number): void {
    const bars = [...waveEl.querySelectorAll('i')];
    if (!bars.length) return;
    const durMs = Math.max(1200, durSec * 1000);
    const tick = () => {
      if (!atomEl.classList.contains('playing')) return;
      const elapsed = atomEl._kara?.elapsed || 0;
      const cutoff = Math.floor(bars.length * Math.min(1, elapsed / durMs));
      bars.forEach((b, i) => b.classList.toggle('on', i < cutoff));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── 11. Recording engine (simulated amplitude) ──────────────────────── */
  const simAmps = Array.from({ length: NBARS }, () => 0.3 + Math.random() * 0.5);
  const curAmps = Array.from({ length: NBARS }, () => 0.25);
  function recTick(): void {
    if (!dock) { cancelAnimationFrame(recRAF); recRAF = null; return; }
    for (let i = 0; i < NBARS; i++) { if (Math.random() < 0.14) simAmps[i] = 0.1 + Math.random() * 0.9; curAmps[i] += (simAmps[i] - curAmps[i]) * 0.2; }
    dock.querySelectorAll('.rec-live .wave i').forEach((el: any, i: number) => { el.style.transform = `scaleY(${Math.max(0.08, curAmps[i % NBARS])})`; });
    recRAF = requestAnimationFrame(recTick);
  }
  function startRec(): void { recState.mode = 'recording'; recElapsed = 0; renderRec(); recTimer = setInterval(() => { recElapsed++; updateElapsed(); }, 1000); recRAF = requestAnimationFrame(recTick); }
  function pauseRec(): void { recState.mode = 'paused'; clearInterval(recTimer); recTimer = null; cancelAnimationFrame(recRAF); recRAF = null; renderRec(); }
  function resumeRec(): void { recState.mode = 'recording'; renderRec(); recTimer = setInterval(() => { recElapsed++; updateElapsed(); }, 1000); recRAF = requestAnimationFrame(recTick); }
  function stopRec(): void {
    clearInterval(recTimer); recTimer = null; cancelAnimationFrame(recRAF); recRAF = null;
    recState.mode = 'idle'; renderIdle();
    insertAtom('voice', { duration: Math.max(2, recElapsed), transcript: cfg.voiceTranscript || VOICE_TRANSCRIPT });
  }
  function updateElapsed(): void { const el = dock?.querySelector('.rec-elapsed'); if (el) el.textContent = fmt(recElapsed); }

  /* ── 12. Composer shell renders ──────────────────────────────────────── */
  function initComposerShell(): void {
    const ms = cfg.disableMedia ? (cfg.keepIcons ? ' style="color:var(--fg-25);pointer-events:none"' : ' style="display:none"') : '';
    const vs = cfg.disableVoice ? (cfg.keepIcons ? ' style="color:var(--fg-25);pointer-events:none"' : ' style="display:none"') : '';
    const leftBtn = cfg.textOnly ? ''
      : cfg.showGif
        ? `<button class="icon-btn gif" data-act="addgif" aria-label="Add GIF">GIF</button>`
        : `<button class="icon-btn" data-act="addphoto" aria-label="Add photos or videos"${ms}>${icon('image')}</button>`;
    const rightBtn = cfg.textOnly ? '' : `<button class="icon-btn" data-act="mic" aria-label="Record voice message"${vs}>${icon('mic')}</button>`;
    dock!.innerHTML = `
      <div class="composer-wrap" data-mode="idle" data-composer-mode="${cfg.mode || 'room'}">
        <div class="composer cm-idle">
          ${leftBtn}
          <div class="stream-host"></div>
          ${rightBtn}
          <button class="icon-btn send" data-act="send" aria-label="Send">${icon('send')}</button>
        </div>
        <div class="composer cm-rec"></div>
      </div>`;
    createEditor(dock!.querySelector('.stream-host'));
    bindToolbar();
  }

  function renderRecUI(): void {
    const cmRec = dock?.querySelector('.cm-rec');
    if (!cmRec) return;
    const isRec = recState.mode === 'recording';
    cmRec.innerHTML = `
      <span class="rec-dot"${isRec ? '' : ' style="animation:none;opacity:0.3"'}></span>
      <div class="rec-live${isRec ? ' playing' : ''}">
        <div class="wave">${voiceBars(1)}</div>
        <span class="rec-elapsed">${fmt(recElapsed)}</span>
      </div>
      <button class="icon-btn rec-mid" data-act="${isRec ? 'pause' : 'resume'}" aria-label="${isRec ? 'Pause' : 'Resume'}">${isRec ? icon('pause') : icon('mic')}</button>
      <button class="icon-btn" data-act="stop" style="color:#fff" aria-label="Stop">${icon('stop')}</button>`;
    const wrap = dock!.querySelector('.composer-wrap') as HTMLElement;
    if (wrap) wrap.dataset.mode = recState.mode;
    bindToolbar();
  }
  function renderRec(): void { if (!tiptap) initComposerShell(); renderRecUI(); }

  function renderIdle(): void {
    if (!tiptap) {
      initComposerShell();
    } else {
      const cmIdle = dock?.querySelector('.composer.cm-idle');
      const sh = cmIdle?.querySelector('.stream-host');
      if (cmIdle && sh) {
        let leftBtn: HTMLButtonElement | null = null;
        if (!cfg.textOnly) {
          leftBtn = document.createElement('button');
          if (cfg.showGif) { leftBtn.className = 'icon-btn gif'; leftBtn.setAttribute('data-act', 'addgif'); leftBtn.setAttribute('aria-label', 'Add GIF'); leftBtn.textContent = 'GIF'; }
          else {
            leftBtn.className = 'icon-btn'; leftBtn.setAttribute('data-act', 'addphoto'); leftBtn.setAttribute('aria-label', 'Add photos or videos'); leftBtn.innerHTML = icon('image');
            if (cfg.disableMedia) { if (cfg.keepIcons) { leftBtn.style.color = 'var(--fg-25)'; leftBtn.style.pointerEvents = 'none'; } else leftBtn.style.display = 'none'; }
          }
        }
        let micBtn: HTMLButtonElement | null = null;
        if (!cfg.textOnly) {
          micBtn = document.createElement('button');
          micBtn.className = 'icon-btn'; micBtn.setAttribute('data-act', 'mic'); micBtn.setAttribute('aria-label', 'Record voice message'); micBtn.innerHTML = icon('mic');
          if (cfg.disableVoice) { if (cfg.keepIcons) { micBtn.style.color = 'var(--fg-25)'; micBtn.style.pointerEvents = 'none'; } else micBtn.style.display = 'none'; }
        }
        const sendBtn = document.createElement('button');
        sendBtn.className = 'icon-btn send'; sendBtn.setAttribute('data-act', 'send'); sendBtn.setAttribute('aria-label', 'Send'); sendBtn.innerHTML = icon('send');
        cmIdle.innerHTML = '';
        if (leftBtn) cmIdle.appendChild(leftBtn);
        cmIdle.appendChild(sh);
        if (micBtn) cmIdle.appendChild(micBtn);
        cmIdle.appendChild(sendBtn);
        const wrap = dock?.querySelector('.composer-wrap') as HTMLElement;
        if (wrap) wrap.dataset.composerMode = cfg.mode || 'room';
      }
      dock?.querySelector('.reply-context')?.remove();
      const wrapReply = dock?.querySelector('.composer-wrap');
      if (wrapReply) wrapReply.classList.toggle('reply', !!cfg.showGif);
      const pmEl = tiptap.view.dom;
      pmEl.dataset.ph = cfg.placeholder;
      pmEl.style.setProperty('--placeholder', `"${(cfg.placeholder || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
      if (cfg.preload) { tiptap.commands.setContent(itemsToContent(cfg.preload)); cfg.preload = null; }
    }
    const wrap = dock?.querySelector('.composer-wrap') as HTMLElement;
    if (wrap) wrap.dataset.mode = 'idle';
    bindToolbar();
    onChanged();
  }

  /* ── 13. Editor ──────────────────────────────────────────────────────── */
  function createEditor(hostEl: any): void {
    if (tiptap) { tiptap.destroy(); tiptap = null; }
    tiptap = new Editor({
      element: hostEl,
      extensions: [
        StarterKit.configure({
          heading: false, bulletList: false, orderedList: false, listItem: false,
          codeBlock: false, code: false, blockquote: false,
          strike: false, italic: false, bold: false, horizontalRule: false,
          dropcursor: { width: 1 }, gapcursor: true,
        }),
        PhotoNode, VoiceNode, GifNode, LinkRefNode, LinkPreviewNode, ComposerKeys,
      ],
      content: cfg.preload ? itemsToContent(cfg.preload) : '',
      editorProps: {
        attributes: { spellcheck: 'false' },
        handlePaste: (_view: any, event: any) => handlePaste(event),
        handleTextInput: (view: any, _from: number, _to: number, text: string) => {
          const sel = view.state.selection;
          if (isNodeSel(sel) && ATOM_TYPES.has(sel.node.type.name)) {
            const para = view.state.schema.nodes.paragraph.create(null, view.state.schema.text(text));
            const tr = view.state.tr.insert(sel.to, para);
            tr.setSelection(TextSelection.create(tr.doc, sel.to + 1 + text.length));
            view.dispatch(tr);
            return true;
          }
          return false;
        },
      },
      onUpdate: onChanged,
      onTransaction: () => onChanged(),
    });

    const pmEl = tiptap.view.dom;
    pmEl.classList.add('stream', 'empty');
    pmEl.addEventListener('dragstart', () => { pmEl.dataset.dragging = '1'; });
    pmEl.addEventListener('dragend', () => {
      setTimeout(() => {
        if (tiptap) { const sel = tiptap.state.selection; if (sel.node) tiptap.commands.setTextSelection(sel.$to.pos); }
        delete pmEl.dataset.dragging;
      }, 50);
    });
    pmEl.dataset.ph = cfg.placeholder;
    pmEl.style.setProperty('--placeholder', `"${(cfg.placeholder || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    if (cfg.preload) cfg.preload = null;

    hostEl.addEventListener('dragover', (e: DragEvent) => {
      const hasFiles = [...(e.dataTransfer?.items || [])].some((it: any) => it.kind === 'file');
      if (!hasFiles) return;
      e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; hostEl.classList.add('drag-over');
    });
    hostEl.addEventListener('dragleave', (e: DragEvent) => { if (!hostEl.contains(e.relatedTarget)) hostEl.classList.remove('drag-over'); });
    hostEl.addEventListener('drop', (e: DragEvent) => {
      hostEl.classList.remove('drag-over');
      const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (!files.length) return;
      e.preventDefault();
      files.forEach((f) => { if (totalAtomCount() < MAX_ATOMS) { const kind = f.type.startsWith('video/') ? 'video' : 'photo'; insertAtom('photo', { src: URL.createObjectURL(f), kind }); } });
    });
  }

  /* ── 14. Toolbar binding ─────────────────────────────────────────────── */
  function bindToolbar(): void {
    dock!.querySelectorAll('[data-act]:not([data-bound])').forEach((btn: any) => {
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        const a = btn.dataset.act;
        if (a === 'addphoto') openPicker();
        else if (a === 'addgif') cfg.onAddGif?.();
        else if (a === 'mic') startRec();
        else if (a === 'pause') pauseRec();
        else if (a === 'resume') resumeRec();
        else if (a === 'stop') stopRec();
        else if (a === 'send') trySend();
      });
    });
  }

  /* ── 15. Media picker ────────────────────────────────────────────────── */
  let photoInput: HTMLInputElement | null = null;
  function openPicker(): void {
    tiptap?.commands.focus();
    if (!photoInput) {
      photoInput = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*,video/*', multiple: true });
      photoInput.style.display = 'none';
      photoInput.addEventListener('change', () => {
        [...(photoInput!.files || [])].forEach((f) => {
          const kind = cfg.avatarPicker ? 'avatar' : (f.type.startsWith('video/') ? 'video' : 'photo');
          insertAtom('photo', { src: URL.createObjectURL(f), kind });
        });
        photoInput!.value = '';
      });
      document.body.appendChild(photoInput);
    }
    photoInput.multiple = !cfg.avatarPicker;
    photoInput.accept = cfg.avatarPicker ? 'image/*' : 'image/*,video/*';
    photoInput.click();
  }

  /* ── 16. Atom insertion ──────────────────────────────────────────────── */
  function insertAtom(type: string, attrs: any): void {
    if (!tiptap) return;
    const state = tiptap.state;
    const nodeType = state.schema.nodes[type];
    if (!nodeType) return;
    const atom = nodeType.create(attrs);
    const tr = state.tr;
    const sel = state.selection;
    let atomPos: number;
    if (isNodeSel(sel) || isGapSel(sel)) {
      atomPos = sel.to; tr.insert(atomPos, atom);
    } else {
      if (!sel.empty) tr.deleteSelection();
      const $pos = tr.selection.$from;
      if ($pos.depth === 0) { atomPos = $pos.pos; tr.insert(atomPos, atom); }
      else {
        const parent = $pos.parent;
        const atStart = $pos.parentOffset === 0;
        const atEnd = $pos.parentOffset === parent.content.size;
        if (parent.content.size === 0) { atomPos = $pos.before(); tr.replaceWith($pos.before(), $pos.after(), atom); }
        else if (atStart) { atomPos = $pos.before(); tr.insert(atomPos, atom); }
        else if (atEnd) { atomPos = $pos.after(); tr.insert(atomPos, atom); }
        else { tr.split($pos.pos); atomPos = $pos.pos + 1; tr.insert(atomPos, atom); }
      }
    }
    tr.setSelection(selectionAfterPos(tr.doc, atomPos + atom.nodeSize));
    tiptap.view.dispatch(tr);
    tiptap.view.focus();
  }

  function insertFromDom(domNode: any): void {
    if (!tiptap || !domNode?.dataset?.type) return;
    const t = domNode.dataset;
    const map: Record<string, () => any> = {
      avatar: () => ({ type: 'photo', attrs: { src: t.src, kind: 'avatar' } }),
      gif: () => { if (cfg.maxGif !== undefined && countNodeType('gif') >= cfg.maxGif) return null; return { type: 'gif', attrs: { src: t.src } }; },
      photo: () => ({ type: 'photo', attrs: { src: t.src, kind: t.kind || 'photo' } }),
      voice: () => ({ type: 'voice', attrs: { duration: +t.dur || 6, transcript: t.tr || '' } }),
      linkref: () => ({ type: 'linkref', attrs: { url: t.url, platform: t.platform, label: t.label } }),
      linkpreview: () => ({ type: 'linkpreview', attrs: { url: t.url, platform: t.platform || 'web', label: t.label || '', imageUrl: t.imageUrl || null } }),
    };
    const make = map[t.type];
    if (make) { const content = make(); if (content) insertAtom(content.type, content.attrs); }
  }

  /* ── 17. Serialize / deserialize ─────────────────────────────────────── */
  function serialize(): any[] {
    if (!tiptap) return [];
    const items: any[] = [];
    tiptap.state.doc.forEach((node: any) => {
      const t = node.type.name;
      if (t === 'paragraph') {
        let text = '';
        node.forEach((child: any) => { if (child.isText) text += child.text; else if (child.type.name === 'hardBreak') text += '\n'; });
        text = text.replace(/\u200b/g, '').trim();
        if (!text) return;
        const last = items[items.length - 1];
        if (last && last.type === 'text') last.text += '\n' + text;
        else items.push({ type: 'text', text });
      }
      else if (t === 'photo') items.push({ type: 'photo', src: node.attrs.src, kind: node.attrs.kind || 'photo' });
      else if (t === 'voice') items.push({ type: 'voice', duration: node.attrs.duration, transcript: node.attrs.transcript });
      else if (t === 'gif') items.push({ type: 'gif', src: node.attrs.src });
      else if (t === 'linkref') items.push({ type: 'linkref', url: node.attrs.url, platform: node.attrs.platform, label: node.attrs.label });
      else if (t === 'linkpreview') items.push({ type: 'linkpreview', url: node.attrs.url, platform: node.attrs.platform, label: node.attrs.label, imageUrl: node.attrs.imageUrl });
    });
    return items;
  }

  function itemsToContent(items: any[]): any {
    if (!items?.length) return '';
    const blocks: any[] = [];
    for (const it of items) {
      if (it.type === 'text') {
        const inline: any[] = [];
        it.text.split('\n').forEach((line: string, i: number) => { if (i > 0) inline.push({ type: 'hardBreak' }); if (line) inline.push({ type: 'text', text: line }); });
        blocks.push({ type: 'paragraph', content: inline.length ? inline : undefined });
      }
      else if (it.type === 'photo') blocks.push({ type: 'photo', attrs: { src: it.src, kind: it.kind || 'photo' } });
      else if (it.type === 'voice') blocks.push({ type: 'voice', attrs: { duration: it.duration, transcript: it.transcript || '' } });
      else if (it.type === 'gif') blocks.push({ type: 'gif', attrs: { src: it.src } });
      else if (it.type === 'linkref') blocks.push({ type: 'linkref', attrs: { url: it.url, platform: it.platform, label: it.label } });
      else if (it.type === 'linkpreview') blocks.push({ type: 'linkpreview', attrs: { url: it.url, platform: it.platform || 'web', label: it.label || '', imageUrl: it.imageUrl || null } });
    }
    return { type: 'doc', content: blocks.length ? blocks : undefined };
  }

  /* ── 18. Send ────────────────────────────────────────────────────────── */
  function trySend(): void { if (isEmpty()) return; cfg.onSend!(serialize()); clearDraft(); }

  /* ── 19. Public mount / reset ────────────────────────────────────────── */
  function mount(dockEl: HTMLElement, opts: ComposerMountOpts): void {
    dock = dockEl;
    const modeDefaults = (opts?.mode && MODES[opts.mode]) ? MODES[opts.mode] : {};
    cfg = Object.assign({
      placeholder: 'write something…', onSend: () => {},
      disableMedia: false, disableVoice: false, showGif: false, textOnly: false,
      maxPhotos: 5, maxVoice: 1, voiceTranscript: VOICE_TRANSCRIPT, preload: null, onChange: null, onAddGif: null,
    }, modeDefaults, opts || {});
    recState.mode = 'idle';
    renderIdle();
    restoreDraft();
  }
  function reset(): void { if (tiptap) { tiptap.commands.clearContent(); clearDraft(); onChanged(); } }

  /* ── 20. Controller ──────────────────────────────────────────────────── */
  return {
    mount, serialize, isEmpty, reset,
    focus: () => tiptap?.commands.focus(),
    insertPhoto: (src: string) => insertAtom('photo', { src, kind: 'photo' }),
    insertNode: (dom: HTMLElement) => insertFromDom(dom),
    photoCount: () => countNodeType('photo'),
    setScale: (s: number) => { currentScale = s || 1; },
    destroy: () => { if (tiptap) { tiptap.destroy(); tiptap = null; } },
  };
}
