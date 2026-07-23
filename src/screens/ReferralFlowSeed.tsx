/* ───────────────────────────────────────────────────────────────────────────
   ReferralFlowSeed — Alia · the +1 invite landing.

   Screen 1: the referrer's note (their avatar + name + voice message they left
   with the invite). Screen 2: the member's pre-pulled card (from Supabase later)
   to finish + save. Built on the canonical blocks — AliaVoice + AliaAvatar +
   AliaField — no hand-rolled copies.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useState, useRef } from 'react';
import AliaMessageBlocks from '../AliaMessageBlocks';
import AliaName from '../blocks/AliaName';
import AliaField from '../blocks/AliaField';
import AliaAvatar from '../blocks/AliaAvatar';
import { img } from '../data';
import { fmtField } from '../fieldFormat';

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

/* The referrer who spent an invite token on this member (resolved from the invite
   token in production). */
const REFERRER = {
  name: 'mara levin',
  avatar: img('alia front-facing face selfie.png'),
  message: 'been telling you about this for months. they finally opened a spot — i used mine on you. don’t make me look bad x',
};
const REFERRER_FIRST = REFERRER.name.split(' ')[0];
const MEMBER_FIRST = MEMBER.name.split(' ')[0];

export default function ReferralFlowSeed() {
  const [step, setStep] = useState<'note' | 'form'>('note');
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
    console.log('[referral] profile saved →', payload);
    setSaved(true);
  };

  return (
    <div className="flow-root" id="referral-flow" ref={rootRef}>
      <div className="flow-intro">
        {step === 'note' ? (
          <div className="flow-stack ref-note-screen" key="note">
            <div className="ref-msg">
              <div className="msg">
                <div className="msg-inner">
                  <div className="avatar-col"><div className="avatar-sticky"><AliaAvatar src={REFERRER.avatar} /></div></div>
                  <div className="msg-main"><div className="col">
                    <div className="name-row"><AliaName name={REFERRER.name} /></div>
                  <div className="body">
                    <AliaMessageBlocks block={{ type: 'voice', duration: 11, transcript: REFERRER.message, progress: 0 }} cls="block" />
                  </div>
                  </div></div>
                </div>
              </div>
            </div>

            <button className="cast-save ref-next" onClick={() => setStep('form')}>{MEMBER_FIRST}&rsquo;s spot</button>
          </div>
        ) : (
          <div className="flow-stack" key="form">
            <div className="flow-call">
              <p className="flow-line">{REFERRER_FIRST} started.</p>
              <p className="flow-line">finish and hit save.</p>
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
        )}
      </div>
    </div>
  );
}
