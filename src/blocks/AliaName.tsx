/* ───────────────────────────────────────────────────────────────────────────
   AliaName — the canonical display-name block. A single `.name` element, used
   wherever a member's display name appears (feed messages, replies, referral
   notes). It's an item placed in the message row next to <AliaAvatar> — it owns
   nothing else (not the layout, not the body). Pass-through span props carry
   per-surface behaviour (e.g. the feed's double-tap-to-report gesture).
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React from 'react';

export interface AliaNameProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
}

export default function AliaName({ name, className = '', ...rest }: AliaNameProps) {
  return <span className={'name' + (className ? ' ' + className : '')} {...rest}>{name}</span>;
}
