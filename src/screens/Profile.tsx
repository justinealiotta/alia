/* ───────────────────────────────────────────────────────────────────────────
   Profile — Alia · the member's own account card, LIVE.

   The same pre-pulled identity card the Casting seed shows, minus the casting
   verdict copy: just the member as they exist on file — avatar + identity lines
   they can edit and re-save at any time. Built on the canonical blocks
   (AliaAvatar + AliaField), styled with the seed treatment (#profile mirror
   of #casting-flow). Opened from the room as the RIGHT-side drawer.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { img } from '../data';
import AliaAvatar from '../blocks/AliaAvatar';
import AliaField from '../blocks/AliaField';
import { Icon } from '../icons';
import { fmtField } from '../fieldFormat';

/* Autosave settles this long after the last keystroke — no save button; the
   card just commits itself once you've stopped typing. */
const AUTOSAVE_MS = 5 * 1000; // 5 seconds

/* Logged-in member row (mock seed → Supabase later). */
const PROFILE_ME = {
  avatar: img('alia avatar.png'),
  name: 'justine aliotta',
  age: '27',
  city: 'new york',
  email: 'justine@alia.club',
  phone: '+1 917 488 6203',
};

export default function Profile() {
  const [saved, setSaved] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [left, setLeft] = useState(false);
  const timer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const commit = () => {
    const root = rootRef.current;
    const fields = root ? [...root.querySelectorAll<HTMLElement>('.prof-seed .editable')].reduce(
      (acc, el) => { acc[el.dataset.blockId || ''] = (el.textContent || '').trim(); return acc; }, {} as Record<string, string>) : {};
    const av = root?.querySelector<HTMLImageElement>('.av-crop img');
    const payload = {
      ...fields,
      avatar: av ? { src: av.getAttribute('src'), width: av.style.width, height: av.style.height, transform: av.style.transform } : null,
    };
    // eslint-disable-next-line no-console
    console.log('[profile] autosaved →', payload);
    setSaved(true);
  };

  /* Every edit clears the badge and restarts the idle clock; the card commits
     itself once you've stopped typing for AUTOSAVE_MS. While the leave-alia
     confirm is up, editing is frozen — no idle clock, no autosave — so a stray
     commit can't fire behind the confirm. */
  const onEdit = () => {
    if (leaving) return;
    setSaved(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commit, AUTOSAVE_MS);
  };

  /* Entering the leave flow cancels any pending autosave immediately. */
  const startLeaving = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setSaved(false);
    setLeaving(true);
  };

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <div className="flow-root" id="profile" ref={rootRef}>
      <div className="flow-intro">
        <div className="flow-stack">
          <div className="prof-seed" onInput={onEdit}>
            <AliaAvatar crop id="avatar" locked={leaving} src={PROFILE_ME.avatar} className="prof-seed-avatar" onCropChange={onEdit} />
            <AliaField locked={leaving} id="name" className="prof-seed-name" initial={fmtField('name', PROFILE_ME.name)} placeholder="name" format={(raw) => fmtField('name', raw)} />
            <AliaField locked={leaving} id="bday" className="prof-seed-line" initial={fmtField('bday', PROFILE_ME.age)} placeholder="age" format={(raw) => fmtField('bday', raw)} />
            <AliaField locked={leaving} id="city" className="prof-seed-line" initial={fmtField('city', PROFILE_ME.city)} placeholder="city" format={(raw) => fmtField('city', raw)} />
            <AliaField locked={leaving} id="email" className="prof-seed-line" initial={fmtField('email', PROFILE_ME.email)} placeholder="email" format={(raw) => fmtField('email', raw)} />
            <AliaField locked={leaving} id="phone" className="prof-seed-line" initial={fmtField('phone', PROFILE_ME.phone)} placeholder="number" format={(raw) => fmtField('phone', raw)} />
            {leaving ? (
              <div className="prof-leaving">
                <p className="prof-seed-line">your spot won't be waiting.</p>
                <p className="prof-seed-line">your info disappears in 90 days.</p>
              </div>
            ) : (
              <button type="button" className="prof-leave" onClick={startLeaving}>leave alia</button>
            )}
          </div>
        </div>
      </div>

      {/* confirm — pinned bottom-right of the surface, blinks fully; a direct
         child of the screen root so no card transform can trap it. On confirm it
         stops blinking and the moderation check appears inline beside it. */}
      {leaving ? (
        <div className={'prof-leave-go' + (left ? ' is-left' : '')}>
          <button type="button" className="prof-leave-go-btn" onClick={() => setLeft(true)}>leave alia</button>
          {left ? <span className="prof-leave-check" aria-label="left"><Icon name="check" size={22} /></span> : null}
        </div>
      ) : null}

      {/* autosave status — pinned bottom-right, quiet (like the composer draft) */}
      {saved ? <div className="prof-saved">saved</div> : null}
    </div>
  );
}
