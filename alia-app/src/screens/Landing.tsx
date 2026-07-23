/* ───────────────────────────────────────────────────────────────────────────
   Landing v2 — the public marketing screen.

   Room chrome up top (logo + log in), big copy through the middle
   ("your fashion-forward group chat"), and a right-aligned blinking CTA at the
   bottom ("do you have immaculate taste?" → Application; terms / privacy links).
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React from 'react';
import SignInCorner from './SignInCorner';

export default function Landing() {
  const go = (href: string) => () => {
    const w = window as any;
    window.location.href = w.__aliaResolveHref ? w.__aliaResolveHref(href) : href;
  };

  return (
    <div className="app-root" id="landing">
      <div className="room-chrome">
        <span className="logo">Alia</span>
        <SignInCorner />
      </div>

      <div className="screen">
        <div className="v2-hero">
          <p className="v2-hero-line">your<br />fashion-forward<br />group chat</p>
        </div>
      </div>

      <div className="cta-bar">
        <button className="want-in-blink" type="button" onClick={go('/apply')}>
          do you have immaculate taste?
        </button>
        <div className="cta-links">
          <a href="/terms" onClick={(e) => { e.preventDefault(); go('/terms')(); }}>terms</a>
          <a href="/privacy" onClick={(e) => { e.preventDefault(); go('/privacy')(); }}>privacy</a>
        </div>
      </div>
    </div>
  );
}
