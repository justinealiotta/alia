/* ───────────────────────────────────────────────────────────────────────────
   TypingIndicator — the one canonical "someone is typing" row.

   Used by every feed (Room + all Alia-led pages). It renders the standard
   .typing-row → .typing-bubble → three .dot markup; the shared CSS (chat.css +
   responsive.css) pins it to the bottom of the feed and aligns it left to the
   message column (flush under the display name).

   Two ways to drive it — one component either way:
     • Controlled (default): the parent conditionally mounts it, e.g.
         {typing ? <TypingIndicator /> : null}
       It fades/slides in via the `show` class on mount.
     • Ambient: <TypingIndicator ambient /> stays mounted and runs its own
       random show/hide loop (the Room's anonymous "someone is typing…").
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useState } from 'react';

export interface TypingIndicatorProps {
  /** Controlled visibility (ignored when `ambient`). Default: true. */
  show?: boolean;
  /** Play the slide-up entrance on mount (controlled use). Default: true. */
  entering?: boolean;
  /** Self-run the random show/hide loop (the Room's ambient typing). */
  ambient?: boolean;
}

export default function TypingIndicator({ show = true, entering = true, ambient = false }: TypingIndicatorProps) {
  const [autoShow, setAutoShow] = useState(false);

  useEffect(() => {
    if (!ambient) return;
    let alive = true;
    const loop = (duration: number) => {
      if (!alive) return;
      setAutoShow(true);
      window.setTimeout(() => {
        if (!alive) return;
        setAutoShow(false);
        window.setTimeout(() => loop(2500 + Math.random() * 2000), 9000 + Math.random() * 7000);
      }, duration);
    };
    const t = window.setTimeout(() => loop(3000 + Math.random() * 2000), 5000 + Math.random() * 4000);
    return () => { alive = false; clearTimeout(t); };
  }, [ambient]);

  const visible = ambient ? autoShow : show;

  return (
    <div className={`typing-row${visible ? ' show' : ''}${entering && !ambient ? ' enter-up' : ''}`} aria-hidden={!visible}>
      <div className="typing-bubble" aria-label="someone is typing">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
