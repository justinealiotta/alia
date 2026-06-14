/* ───────────────────────────────────────────────────────────────────────────
   OrbitStrip — members orbiting below a message (≥3 interactors required).
   Left-anchored slots extend rightward; each slot independently cycles a new
   member in from the pool over time (arrive / leave / extend the pool). The
   orb-enter + orb-drift keyframes live in messages.css and are driven by the
   CSS vars set per orb here.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import { MEMBER_IMGS, MEMBERS } from './data';

interface Slot {
  x: number;
  y: number;
  fx: number;
  fy: number;
  fx2: number;
  fy2: number;
  dur: number;
}

/* Offsets are in px at the mobile floor; emitted as em (÷28) so the whole
   cluster scales with the .orbit-strip fluid font-size from mobile → desktop. */
const ORB_SLOTS: Slot[] = [
  { x: 0, y: -6, fx: 5, fy: 5, fx2: 3, fy2: 4, dur: 4.2 },
  { x: 30, y: -10, fx: 4, fy: 6, fx2: 4, fy2: 3, dur: 3.8 },
  { x: 60, y: -5, fx: 6, fy: 4, fx2: 3, fy2: 5, dur: 5.1 },
  { x: 90, y: -9, fx: 4, fy: 5, fx2: 5, fy2: 4, dur: 4.6 },
  { x: 120, y: -7, fx: 5, fy: 4, fx2: 4, fy2: 5, dur: 3.7 },
];
const ENTRY_Y = 28;

interface Orb {
  slot: number;
  member: string;
  gen: number; // bump to remount → replay entrance
}

export interface OrbitStripProps {
  interactions: string[];
}

export default function OrbitStrip({ interactions }: OrbitStripProps) {
  if (!interactions || interactions.length < 3) return null;

  const seed = interactions.slice(0, 5);
  const pool = useRef<string[]>([...seed]);
  const poolIdx = useRef(seed.length);
  const [orbs, setOrbs] = useState<Orb[]>(() =>
    seed.map((member, slot) => ({ slot, member, gen: 0 })),
  );

  useEffect(() => {
    let timer: number;
    const cycle = () => {
      // Occasionally pull a fresh member into the pool (engagement growth).
      if (Math.random() < 0.4) {
        const current = new Set(pool.current);
        const fresh = MEMBERS.filter((m) => !current.has(m));
        if (fresh.length) pool.current.push(fresh[(Math.random() * fresh.length) | 0]);
      }
      // Swap one random slot to the next pool member.
      setOrbs((prev) => {
        if (!prev.length) return prev;
        const i = (Math.random() * prev.length) | 0;
        const member = pool.current[poolIdx.current % pool.current.length];
        poolIdx.current += 1;
        const next = prev.slice();
        next[i] = { ...next[i], member, gen: next[i].gen + 1 };
        return next;
      });
      timer = window.setTimeout(cycle, 3500 + Math.random() * 3000);
    };
    timer = window.setTimeout(cycle, 3500 + Math.random() * 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="orbit-strip">
      <div className="orbit">
        {orbs.map((o, i) => {
          const s = ORB_SLOTS[o.slot % ORB_SLOTS.length];
          const ey = ENTRY_Y - s.y;
          const dur = (s.dur + (Math.random() * 1.5 - 0.5)).toFixed(2);
          const em = (px: number) => `${(px / 28).toFixed(3)}em`;
          const style = {
            left: 0,
            bottom: 0,
            '--tx': em(s.x),
            '--ty': em(s.y),
            '--ex': '0em',
            '--ey': em(ey),
            '--enter-dur': `${(0.65 + i * 0.04).toFixed(2)}s`,
            '--ed': o.gen === 0 ? `${(i * 0.12).toFixed(2)}s` : '0s',
            '--fx': em(s.fx),
            '--fy': em(s.fy),
            '--fx2': em(s.fx2),
            '--fy2': em(s.fy2),
            '--dur': `${dur}s`,
          } as React.CSSProperties;
          const img = MEMBER_IMGS[o.member];
          return (
            <div className="orb" key={`${o.slot}-${o.gen}`} style={style}>
              {img ? <img src={img} alt="" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
