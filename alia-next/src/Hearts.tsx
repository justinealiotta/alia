/* ───────────────────────────────────────────────────────────────────────────
   Hearts — love button + floating-heart layer.
   Floaters rise from the message's right edge; tapping the heart bursts five
   and, past 3 loves, starts an ambient loop.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

export interface Floater {
  id: number;
  size: number;
  dur: number;
  style: React.CSSProperties;
}

function lovesToInterval(n: number): number {
  // Density scales with TOTAL loves: aim for ~N concurrent floaters where N grows
  // with the count, then interval = avg life / N. ~1 at 3 loves, ~4 at 25, ~13 at 100.
  const concurrency = Math.min(0.5 + n * 0.13, 16);
  return Math.max(110, FLOATER_LIFE / concurrency);
}

const FLOATER_LIFE = 2100; // ≈ average floater rise time (makeFloater dur 1600–2600ms)
const CLICK_BURST = 7;     // hearts thrown on a fresh tap — constant for everyone

function makeFloater(id: number): Floater {
  const size = 13 + Math.random() * 9; // px at the mobile floor
  const dur = 1600 + Math.random() * 1000;
  // Emit in em so floaters scale with the .msg-hearts fluid font-size (16px base).
  const em = (px: number) => `${(px / 16).toFixed(3)}em`;
  const style: React.CSSProperties = {
    right: em(2 + Math.random() * 18),
    bottom: em(8 + Math.random() * 20),
    width: em(size),
    height: em(size),
    ['--fx1' as any]: em(-8 - Math.random() * 48),
    ['--fy1' as any]: em(-90 - Math.random() * 180),
    ['--fr0' as any]: `${Math.random() * 22 - 11}deg`,
    ['--fr1' as any]: `${Math.random() * 26 - 13}deg`,
    animation: `msgFloatUp ${dur}ms cubic-bezier(0.2,0.5,0.3,1) forwards`,
  };
  return { id, size, dur, style };
}

/** Hearts state + floater spawning for a single message. */
export function useHearts(initialLoves: number, ownMessage: boolean) {
  const [loved, setLoved] = useState(false);
  const [loves, setLoves] = useState(initialLoves);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const seq = useRef(0);
  const ambient = useRef(false);
  // Live love count the ambient loop reads each tick, so density tracks the
  // CURRENT total (it keeps growing as loves climb, not frozen at start).
  const lovesRef = useRef(initialLoves);
  useEffect(() => { lovesRef.current = loves; }, [loves]);

  const spawn = () => {
    const f = makeFloater(seq.current++);
    setFloaters((list) => [...list, f]);
    // Remove once the rise finishes (use the floater's own duration — never re-parse
    // it out of the animation string, which mis-captures the float's decimals).
    setTimeout(() => setFloaters((list) => list.filter((x) => x.id !== f.id)), f.dur + 200);
  };

  // Ambient drift: ONE self-rescheduling loop whose interval is recomputed from the
  // current love count every tick — sparse at a few loves, a dense cloud at 100+.
  const startAmbient = () => {
    if (ambient.current) return;
    ambient.current = true;
    const loop = () => {
      if (lovesRef.current >= 3) spawn();
      const iv = lovesToInterval(lovesRef.current);
      window.setTimeout(loop, iv * (0.75 + Math.random() * 0.5));
    };
    window.setTimeout(loop, lovesToInterval(lovesRef.current) * Math.random());
  };

  // Kick the ambient loop for already-loved messages (loves ≥ 3) on mount.
  useEffect(() => {
    if (initialLoves >= 3) startAmbient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const nextLoved = !loved;
    setLoved(nextLoved);
    const nextLoves = nextLoved ? loves + 1 : Math.max(0, loves - 1);
    setLoves(nextLoves);
    lovesRef.current = nextLoves;
    if (nextLoved) {
      // Click burst: a fixed, generous pop — identical for every love, regardless of
      // the message's total. (Separate from the love-count-driven ambient drift.)
      for (let i = 0; i < CLICK_BURST; i++) setTimeout(spawn, i * 80);
      if (nextLoves >= 3) startAmbient();
    }
  };

  return { loved, loves, floaters, toggle, ownMessage };
}

/** The absolutely-positioned floater layer (child of .msg). */
export function HeartFloaterLayer({ floaters }: { floaters: Floater[] }) {
  if (!floaters.length) return null;
  return (
    <div className="msg-hearts">
      {floaters.map((f) => (
        <span key={f.id} className="msg-floater" style={f.style}>
          <Icon name="heart-filled" size={Math.round(f.size)} />
        </span>
      ))}
    </div>
  );
}

/** The love button shown in a message's heart zone (hidden for own messages). */
export function HeartZone({
  loved,
  loves,
  onToggle,
  own,
}: {
  loved: boolean;
  loves: number;
  onToggle: () => void;
  own: boolean;
}) {
  return (
    <div className="heart-zone" data-loves={loves}>
      {own ? (
        <button className={`heart-btn heart-btn--own${loves > 0 ? ' loved' : ''}`} disabled aria-label="Love" aria-disabled="true" tabIndex={-1}>
          <span className="heart-outline">
            <Icon name="heart" />
          </span>
          <span className="heart-fill">
            <Icon name="heart-filled" />
          </span>
        </button>
      ) : (
        <button className={`heart-btn${loved ? ' loved' : ''}`} onClick={onToggle} aria-label="Love">
          <span className="heart-outline">
            <Icon name="heart" />
          </span>
          <span className="heart-fill">
            <Icon name="heart-filled" />
          </span>
        </button>
      )}
    </div>
  );
}
