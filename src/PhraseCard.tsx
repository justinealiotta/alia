/* ───────────────────────────────────────────────────────────────────────────
   PhraseCard — the 24h ephemeral "big text" message.

   A first-class message type: a large, unadorned line (or two) that lives in
   the feed for 24 hours after it was sent, then quietly disappears — not
   archived, not saved. There is deliberately NO timer chrome (no countdown,
   no "expires in…" label). The only signal of its impermanence is that one
   day it is simply gone.

   Props:
     · phrase — the text. A single '\n' splits it into two stacked lines.
     · ts     — backend send time (epoch ms). The card removes itself 24h
                after this. Omit to render a non-expiring card (e.g. previews).
     · gap    — send-time gap tier; drives the top-margin rhythm in the feed,
                shared with .msg (see room.css / responsive.css).
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useState } from 'react';
import type { GapTier } from './utils';

/** A phrase is visible for exactly one day from its send time. */
export const PHRASE_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface PhraseCardProps {
  phrase: string;
  ts?: number;
  gap?: GapTier | null;
}

export default function PhraseCard({ phrase, ts, gap }: PhraseCardProps) {
  const expiresAt = ts != null ? ts + PHRASE_LIFETIME_MS : null;
  const [expired, setExpired] = useState(
    () => expiresAt != null && Date.now() >= expiresAt,
  );

  // Schedule the card's own removal at the 24h mark. While the room stays open
  // past expiry, the phrase drops out of the feed on its own — no reload, no
  // trace. (setTimeout's max delay comfortably covers a 24h window.)
  useEffect(() => {
    if (expiresAt == null || expired) return;
    const ms = expiresAt - Date.now();
    if (ms <= 0) {
      setExpired(true);
      return;
    }
    const t = window.setTimeout(() => setExpired(true), ms);
    return () => window.clearTimeout(t);
  }, [expiresAt, expired]);

  if (expired) return null;

  const lines = (phrase || '').split('\n');
  return (
    <div className="phrase-card" data-gap={gap || undefined}>
      {lines.map((l, i) => (
        <React.Fragment key={i}>
          {l}
          {i < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}
