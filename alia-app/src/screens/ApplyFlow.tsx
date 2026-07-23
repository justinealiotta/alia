/* ───────────────────────────────────────────────────────────────────────────
   ApplyFlow — Alia · the apply page.

   One page, one scroll. The casting call sits at the top; the apply talent card
   (<ApplyCard>) is embedded directly beneath it — its own photos, voice block,
   and identity fields, unchanged. The only page-level job here is stacking the
   call over the card; all card styling stays canonical (composer.css).
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React from 'react';
import ApplyCard from './../ApplyCard';

export default function ApplyFlow() {
  const [applied, setApplied] = React.useState(false);
  return (
    <div className={'apply-page' + (applied ? ' applied' : '')} data-screen-label="apply">
      {/* ── The casting call ─────────────────────────────────────────────── */}
      <div className="apply-call">
        <p className="apply-line">casting rn.</p>
        <div className="apply-stanza">
          <p className="apply-line">fashion baddies to the front.</p>
          <p className="apply-line">immaculate taste only.</p>
        </div>
        <div className="apply-stanza">
          <p className="apply-line">you&rsquo;re early.</p>
          <p className="apply-line">keep it cute.</p>
        </div>
      </div>

      {/* ── The payoff — swaps in on top where the call was, same scale ──── */}
      {applied ? (
        <div className="apply-done">
          <p className="apply-line">face card strong.</p>
        </div>
      ) : null}

      {/* ── The apply talent card, embedded right below ───────────────────── */}
      <div className="apply-build">
        <ApplyCard onPhase={(p) => setApplied(p === 'done')} />
      </div>
    </div>
  );
}
