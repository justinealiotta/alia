/* ───────────────────────────────────────────────────────────────────────────
   Landing — the public marketing screen.

   A looping room "peek" that reads like watching a message land and scrolling
   to see it:
     1. a typing indicator (a message is being sent to the room)
     2. the message arrives — Alia's "heading out" + a stack of outfit photos
     3. the view eases downward through the photos (as if the user scrolled)
     4. a reply starts typing, then the scene resets and loops

   Room chrome up top (logo + log in), a gradient CTA bar at the bottom
   ("do you have immaculate taste?" → Application; terms / privacy links).

   Reuses: ChatMessage (message + photo stack) · TypingIndicator. No composer.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import { img } from './../data';
import type { Block } from './../types';
import { nextId } from './../utils';
import { ChatMessage, ChatEntry } from './../shared/chat';
import TypingIndicator from './../TypingIndicator';

const ALIA = img('alia avatar.png');
const PHOTOS = [
  img('alia top of outfit selfie.png'),
  img('alia downward outfit selfie.png'),
  img('alia necklace detail selfie.png'),
  img('alia shoe detail selfie.png'),
  img('alia bag detail selfie.png'),
];
const ASPECT = 1448 / 1086;

const MESSAGE_BLOCKS: Block[] = [
  { type: 'text', text: 'heading out' },
  { type: 'images', items: PHOTOS.map((src) => ({ src, aspect: ASPECT })) },
];

const ENTRY: ChatEntry = { id: 'land-msg', who: 'alia', name: 'Alia', img: ALIA, blocks: MESSAGE_BLOCKS };

export default function Landing() {
  // 'idle' = empty, 'typing' = composing, 'message' = message shown, 'reply' = message + reply typing
  const [phase, setPhase] = useState<'idle' | 'typing' | 'message' | 'reply'>('idle');
  const feedRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(true);

  /* Smooth, duration-based scroll (deterministic — no lerp stalls). */
  const scrollTo = (target: number, ms: number) =>
    new Promise<void>((resolve) => {
      const el = feedRef.current;
      if (!el) return resolve();
      const start = el.scrollTop;
      const delta = target - start;
      if (Math.abs(delta) < 1 || ms <= 0) { el.scrollTop = target; return resolve(); }
      const t0 = performance.now();
      const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
      const step = (now: number) => {
        if (!aliveRef.current) return resolve();
        const t = Math.min(1, (now - t0) / ms);
        el.scrollTop = start + delta * ease(t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

  /* Wait until the message's images have laid out (so scrollHeight is final). */
  const waitForImages = () =>
    new Promise<void>((resolve) => {
      const el = feedRef.current;
      if (!el) return resolve();
      const imgs = Array.from(el.querySelectorAll('img'));
      if (!imgs.length) return resolve();
      let left = imgs.filter((im) => !im.complete).length;
      if (left === 0) return resolve();
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      imgs.forEach((im) => {
        if (im.complete) return;
        const onDone = () => { left -= 1; if (left <= 0) finish(); };
        im.addEventListener('load', onDone, { once: true });
        im.addEventListener('error', onDone, { once: true });
      });
      setTimeout(finish, 1600); // safety
    });

  useEffect(() => {
    aliveRef.current = true;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(() => aliveRef.current && r(), ms));

    (async () => {
      // eslint-disable-next-line no-constant-condition
      while (aliveRef.current) {
        setPhase('idle');
        await wait(700);
        if (!aliveRef.current) break;

        // 1. a message is being sent to the room
        setPhase('typing');
        await wait(1900);
        if (!aliveRef.current) break;

        // 2. the message arrives
        setPhase('message');
        await waitForImages();
        if (feedRef.current) feedRef.current.scrollTop = 0;
        await wait(1600); // eye lands on the opener (text + first photo)
        if (!aliveRef.current) break;

        // 3. the user scrolls down through the photos to see it
        const el = feedRef.current;
        if (el) await scrollTo(el.scrollHeight - el.clientHeight, 5200);
        await wait(1100);
        if (!aliveRef.current) break;

        // 4. a reply starts typing
        setPhase('reply');
        if (el) await scrollTo(el.scrollHeight - el.clientHeight, 600);
        await wait(2600);
        if (!aliveRef.current) break;

        // reset: ease back to the top, then loop
        if (el) await scrollTo(0, 900);
        await wait(500);
      }
    })();

    return () => { aliveRef.current = false; };
  }, []);

  const go = (href: string) => () => { window.location.href = href; };

  return (
    <div className="app-root" id="landing">
      <div className="room-chrome">
        <span className="logo">Alia</span>
        <button className="signin" type="button" onClick={go('/signin')}>log in</button>
      </div>

      <div className="screen">
        <div className={`feed${phase === 'typing' ? ' feed-typing' : ''}`} ref={feedRef}>
          {phase === 'typing' ? <TypingIndicator /> : null}
          {phase === 'message' || phase === 'reply' ? <ChatMessage entry={ENTRY} /> : null}
          {phase === 'reply' ? <TypingIndicator /> : null}
        </div>
      </div>

      <div className="cta-bar">
        <button className="want-in" type="button" onClick={go('/application')}>
          do you have immaculate taste?
        </button>
        <div className="cta-links">
          <a href="/terms">terms of service</a>
          <a href="/privacy">privacy policy</a>
        </div>
      </div>
    </div>
  );
}
