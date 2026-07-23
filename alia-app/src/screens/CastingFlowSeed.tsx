/* ───────────────────────────────────────────────────────────────────────────
   CastingFlowSeed — Alia · the casting verdict + pre-pulled member card.

   "you're cast. here's what i have on you. fix anything." followed by the data
   Alia already has on file (mock seed → Supabase later): avatar + identity lines
   the member can edit, styled as the apply card's identity treatment. Built on
   the canonical blocks — AliaAvatar + AliaField — no hand-rolled copies.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useState, useRef } from 'react';
import AliaAvatar from '../blocks/AliaAvatar';
import AliaField from '../blocks/AliaField';
import { fmtField } from '../fieldFormat';
import { img } from '../data';

/* Pre-pulled member row (mock seed). Field order mirrors the apply comp card. */
const MEMBER = {
  avatar: img('alia avatar.png'),
  name: 'justine aliotta',
  bday: 'april 13, 1999',
  city: 'new york',
  ig: 'justinealiotta',
  tt: 'justine',
  email: 'justine@alia.club',
  phone: '+1 917 488 6203',
};

export default function CastingFlowSeed() {
  const [saved, setSaved] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const onSave = () => {
    if (saved) return;
    const root = rootRef.current;
    const fields = root ? [...root.querySelectorAll<HTMLElement>('.cast-seed .editable')].reduce(
      (acc, el) => { acc[el.dataset.blockId || ''] = (el.textContent || '').trim(); return acc; }, {} as Record<string, string>) : {};
    const av = root?.querySelector<HTMLImageElement>('.av-crop img');
    const payload = {
      ...fields,
      avatar: av ? { src: av.getAttribute('src'), width: av.style.width, height: av.style.height, transform: av.style.transform } : null,
    };
    // eslint-disable-next-line no-console
    console.log('[casting] profile saved →', payload);
    setSaved(true);
  };

  return (
    <div className="flow-root" id="casting-flow" ref={rootRef}>
      <div className="flow-intro">
        <div className="flow-stack">
          <div className="flow-call">
            <p className="flow-line">you&rsquo;re cast.</p>
            <p className="flow-line">here&rsquo;s what i have on you.</p>
            <p className="flow-line">fix anything.</p>
          </div>

          <div className="cast-seed">
            <AliaAvatar crop id="avatar" src={MEMBER.avatar} locked={saved} />
            <AliaField className="cast-seed-name" id="name" initial={fmtField('name', MEMBER.name)} placeholder="name" locked={saved} format={(raw) => fmtField('name', raw)} />
            <AliaField className="cast-seed-line" id="bday" initial={fmtField('bday', MEMBER.bday)} placeholder="bday" locked={saved} format={(raw) => fmtField('bday', raw)} />
            <AliaField className="cast-seed-line" id="city" initial={fmtField('city', MEMBER.city)} placeholder="city" locked={saved} format={(raw) => fmtField('city', raw)} />
            <AliaField className="cast-seed-line" id="email" initial={fmtField('email', MEMBER.email)} placeholder="email" locked={saved} format={(raw) => fmtField('email', raw)} />
            <AliaField className="cast-seed-line" id="phone" initial={fmtField('phone', MEMBER.phone)} placeholder="number" locked={saved} format={(raw) => fmtField('phone', raw)} />
          </div>

          {saved
            ? <a className="cast-enter" href="/room">enter alia</a>
            : <button className="cast-save" onClick={onSave}>save</button>}
        </div>
      </div>
    </div>
  );
}
