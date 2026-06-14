/* ───────────────────────────────────────────────────────────────────────────
   AliaComposer — React wrapper around the canonical TipTap engine.

   The composer logic IS composer/engine.ts (the TipTap/ProseMirror engine).
   This component owns only the React lifecycle: it builds the engine once,
   mounts it into a dock element, and re-mounts on mode / edit changes. The
   engine renders the entire composer DOM (toolbar, ProseMirror editor,
   recording surface) inside the dock — React never reaches into it.

   The GIF picker (reply mode) is the one piece React owns: the engine emits an
   `onAddGif` callback when the GIF button is tapped, and inserted GIFs are
   handed back through `controller.insertNode()`.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { ComposerItem, ComposerMode } from './types';
import { createAliaComposer, AliaComposerController, VoiceAtomRenderer } from './composer/engine';
import { Icon } from './icons';
import AliaVoice from './AliaVoice';
import { GIFS, REC_TRANSCRIPT } from './data';

/** Imperative handle Room uses for tap-away dismiss decisions. */
export interface ComposerControl {
  isEmpty: () => boolean;
  isDirty: () => boolean;
  shake: () => void;
}

export interface AliaComposerProps {
  mode: ComposerMode;
  preload?: ComposerItem[] | null;
  /** Optional placeholder override. */
  placeholder?: string;
  /** Imperative handle (isEmpty / isDirty / shake) for the host. */
  controlRef?: React.MutableRefObject<ComposerControl | null>;
  /** Return `false` to KEEP the composer content (e.g. a failed gate); any
   *  other return value resets it after send. */
  onSend: (items: ComposerItem[]) => void | boolean;
  onDismissEmpty?: () => void;
  /** Override the simulated voice-note transcript (per mode/page). */
  voiceTranscript?: string;
}

/** Build the GIF atom DOM the engine's insertNode() expects (reads dataset). */
function gifAtomEl(src: string): HTMLElement {
  const a = document.createElement('span');
  a.className = 'atom atom-gif';
  a.contentEditable = 'false';
  a.dataset.type = 'gif';
  a.dataset.src = src;
  a.draggable = false;
  return a;
}

/** Render the composer's voice atom with the canonical <AliaVoice> component.
 *  Mounts a small React root into the engine's `.atom-voice` container and
 *  returns a cleanup that unmounts it (deferred a tick so it never unmounts
 *  synchronously inside a ProseMirror transaction). */
const renderVoiceAtom: VoiceAtomRenderer = (container, { duration, transcript }) => {
  const root = ReactDOM.createRoot(container);
  root.render(<AliaVoice duration={duration} transcript={transcript} />);
  return () => { setTimeout(() => root.unmount(), 0); };
};

export default function AliaComposer({ mode, preload, placeholder, controlRef, onSend, onDismissEmpty, voiceTranscript }: AliaComposerProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<AliaComposerController | null>(null);
  const [ready, setReady] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState('');

  // keep the latest send callback without forcing a remount
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;
  // edit-mode baseline (for dirty checks on tap-away)
  const baselineRef = useRef<string>('[]');
  /* ── Build the engine once (async — TipTap loads from esm.sh) ──────────── */
  useEffect(() => {
    let alive = true;
    createAliaComposer({ renderVoiceAtom })
      .then((ctrl) => {
        if (!alive) { ctrl.destroy(); return; }
        ctrlRef.current = ctrl;
        setReady(true);
      })
      .catch((err) => console.error('[AliaComposer] engine init failed:', err));
    return () => {
      alive = false;
      ctrlRef.current?.destroy();
      ctrlRef.current = null;
    };
  }, []);

  /* ── Mount / re-mount on mode + preload change ────────────────────────── */
  useEffect(() => {
    const ctrl = ctrlRef.current;
    const dock = dockRef.current;
    if (!ready || !ctrl || !dock) return;
    setShowGif(false);
    ctrl.mount(dock, {
      mode,
      placeholder,
      preload: mode === 'edit' ? (preload || []) : null,
      voiceTranscript: voiceTranscript || REC_TRANSCRIPT,
      onSend: (items) => {
        const keep = onSendRef.current?.(items as ComposerItem[]);
        if (keep !== false) ctrl.reset();
      },
      onAddGif: () => setShowGif(true),
    });
    // Capture baseline AFTER mount so dirty comparison uses the same format.
    baselineRef.current = JSON.stringify(ctrl.serialize());
    if (controlRef) {
      controlRef.current = {
        isEmpty: () => ctrl.isEmpty(),
        isDirty: () => {
          try { return JSON.stringify(ctrl.serialize()) !== baselineRef.current; }
          catch { return false; }
        },
        shake: () => {
          const wrap = dock.querySelector('.composer-wrap') as HTMLElement | null;
          if (!wrap) return;
          wrap.classList.remove('shake');
          void wrap.offsetHeight;
          wrap.classList.add('shake');
          wrap.addEventListener('animationend', () => wrap.classList.remove('shake'), { once: true });
        },
      };
    }
  }, [ready, mode, preload, placeholder, voiceTranscript]);

  const pickGif = (src: string) => {
    ctrlRef.current?.insertNode(gifAtomEl(src));
    setShowGif(false);
    setGifQuery('');
  };

  const gifList = useMemo(
    () => GIFS.filter((g) => !gifQuery || g.toLowerCase().includes(gifQuery.toLowerCase())),
    [gifQuery],
  );

  return (
    <>
      {/* The engine fills this dock with the full .composer-wrap markup. */}
      <div ref={dockRef} data-livedock />

      {/* GIF picker sheet (reply mode) — React-owned, inserts via the engine. */}
      {showGif ? (
        <>
          <div className="gif-backdrop open" onClick={() => setShowGif(false)} />
          <div className="gif-sheet open">
            <div className="gif-search-wrap">
              <span className="gif-search-icon"><Icon name="search" /></span>
              <input
                className="gif-search"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="gif-grid">
              {gifList.map((g, i) => (
                <button className="gif-cell" key={i} onClick={() => pickGif(g)}>
                  <img src={g} alt="" />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
