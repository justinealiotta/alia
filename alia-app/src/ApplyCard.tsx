/* ───────────────────────────────────────────────────────────────────────────
   ApplyCard — Alia · the apply talent card.

   The casting apply, built as one tight card the applicant assembles and "sends"
   like a physical comp card. Fixed order, top to bottom:

     hero photo  →  photo grid  →  voice message  →  identity fields

   Each identity field is its OWN line with its own cursor. Empty, every field is
   the same quiet placeholder size. Once you fill one and move on, it FORMATS and
   turns white on its line:
     name → the name, big
     bday → age
     city → nearest big city
     instagram / tiktok → @handle
     email → normalized email
     number → formatted phone
   Tap a formatted line to edit it again.

   Photos snap to the nearest broadcast ratio on upload (16:9 · 9:16 · 3:4 · 4:3)
   and are DRAGGABLE — drop any shot into another slot to reorder; whatever lands
   first is the hero. Five max; the "photos" trigger hides at five and returns if
   one is removed. Desktop files can be dropped straight onto the card.

   On "apply" the loose stack draws together into one lifted card, shrinks, and
   floats up — a card handed over — and stays parked as "face card strong." lands
   above it.

   Reuses the canonical comp-card type scale + voice atoms; layout in
   composer.css under .mmi-*. Apply-only — the room uses AliaComposerBlocks.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import AliaVoice, { AliaVoiceRecorder } from './blocks/AliaVoice';
import AliaField from './blocks/AliaField';
import AliaMediaGrid, { MMIPhoto } from './blocks/AliaMediaGrid';
import { fmtField, type FieldKey } from './fieldFormat';
import { nextId } from './utils';

const APPLY_MIN = 3;
const APPLY_MAX = 6;

interface MMIVoice { id: string; duration: number; transcript?: string; src?: string; }
type Fields = Record<FieldKey, string>;
const EMPTY_FIELDS: Fields = { name: '', bday: '', city: '', ig: '', tt: '', email: '', phone: '' };

/* ── draft persistence ───────────────────────────────────────────────────────
   The in-progress application autosaves to storage and HOLDS across navigation
   and full reloads — media is stored as data URLs so blob srcs survive a reload.
   The draft clears only when the applicant empties it (removes all content) or
   on a successful apply. */
const DRAFT_KEY = 'alia.apply.draft';
interface ApplyDraft { shots: MMIPhoto[]; voice: MMIVoice | null; fields: Fields; }
const readDraft = (): Partial<ApplyDraft> => {
  try { return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null') || {}; }
  catch (_e) { return {}; }
};
/* blob: srcs die on reload — bake them to data: URLs before persisting. */
async function toDataURL(src?: string): Promise<string | undefined> {
  if (!src || src.startsWith('data:')) return src;
  try {
    const blob = await fetch(src).then((r) => r.blob());
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch (_e) { return src; }   // keep the blob url (still valid within this session)
}

const applyNewId = () => nextId('apply');

/* photos are the canonical <AliaMediaGrid editable photosOnly> block (upload ·
   native-ratio justified rows · drag-reorder · tap-remove · file-drop) — MMIPhoto
   is its type. A comp card is photos, so this grid takes no video. */

/* the identity fields, in fixed order */
const FIELD_DEFS: Array<{ key: FieldKey; ph: string; big?: boolean }> = [
  { key: 'name', ph: 'name', big: true },
  { key: 'bday', ph: 'bday' },
  { key: 'city', ph: 'city' },
  { key: 'ig', ph: 'instagram' },
  { key: 'tt', ph: 'tiktok' },
  { key: 'email', ph: 'email' },
  { key: 'phone', ph: 'number' },
];

/* pretty US-style phone from the parser's "+digits" form */

/* format one field's raw text into its display value — the ONE shared treatment
   (see fieldFormat.ts), identical on every page that renders an identity line. */

/* the identity fields are the canonical <AliaField> block (edit-in-place,
   pre-styled at the value size — the same treatment as the casting/referral
   dossier). fmtField formats each on blur; onChange stores the formatted value. */

type Phase = 'build' | 'assemble' | 'done';

export default function ApplyCard({ onPhase }: { onPhase?: (p: Phase) => void } = {}) {
  const draft0 = useRef(readDraft()).current;
  const [shots, setShots] = useState<MMIPhoto[]>(draft0.shots ?? []);
  const [voice, setVoice] = useState<MMIVoice | null>(draft0.voice ?? null);
  const [fields, setFields] = useState<Fields>({ ...EMPTY_FIELDS, ...(draft0.fields ?? {}) });
  const [recording, setRecording] = useState(false);
  const [phase, setPhase] = useState<Phase>('build');

  const cardRef = useRef<HTMLDivElement>(null);

  const locked = phase !== 'build';
  useEffect(() => { onPhase?.(phase); }, [phase]);
  const setField = (k: FieldKey, v: string) => setFields((f) => ({ ...f, [k]: v }));

  /* ── autosave / clear the draft ─────────────────────────────────────────── */
  useEffect(() => {
    if (locked) return;   // frozen after apply — nothing left to save
    let cancelled = false;
    (async () => {
      const pShots = await Promise.all(shots.map(async (s) => ({ ...s, src: (await toDataURL(s.src)) as string })));
      const pVoice = voice ? { ...voice, src: await toDataURL(voice.src) } : null;
      if (cancelled) return;
      const empty = !pShots.length && !pVoice && !Object.values(fields).some((v) => v.trim());
      try {
        if (empty) window.localStorage.removeItem(DRAFT_KEY);
        else window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ shots: pShots, voice: pVoice, fields }));
      } catch (_e) { /* quota — degrade quietly (text/voice still fit next write) */ }
    })();
    return () => { cancelled = true; };
  }, [shots, voice, fields, locked]);

  /* ── voice ─────────────────────────────────────────────────────────────── */
  const armVoice = () => setRecording(true);

  /* ── age — fields now store the FORMATTED value (AliaField formats on blur),
        so bday is already the derived age string. Valid when it's a plain number. */
  const bdayVal = fields.bday.trim();
  const ageOk = /^\d{1,3}$/.test(bdayVal) && +bdayVal >= 0 && +bdayVal <= 120;

  /* ── completion + send ─────────────────────────────────────────────────── */
  const complete =
    shots.length >= APPLY_MIN && !!voice &&
    !!fields.name.trim() && ageOk && !!fields.city.trim() && !!fields.email.trim() && !!fields.phone.trim();

  /* ── send: square up (gaps collapse) → the card lifts toward you in 3D and
     settles, resting slightly tilted like a physical card presented. It stays
     exactly where casting sees it — full size, in place — then the payoff lands
     under it. Nothing about the card's look changes; it just becomes an object. */
  const apply = () => {
    if (!complete) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (_e) {}   // draft consumed
    setPhase('done'); // the card locks + draws together into one solid card
    // bring the payoff line into view as the first line of copy, card below it
    requestAnimationFrame(() => {
      (cardRef.current?.closest('.apply-page') as HTMLElement | null)?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  return (
    <div className={'cc-root mmi' + (phase === 'done' ? ' sent' : '')}>
      <div className="cc-stage">
        <div
          ref={cardRef}
          className={'mmi-card' + (phase === 'assemble' ? ' assemble' : '') + (phase === 'done' ? ' sent' : '')}
        >
          {/* ── photos first — AliaMediaGrid, photos-only ───────────────── */}
          <AliaMediaGrid editable photosOnly locked={locked} min={APPLY_MIN} max={APPLY_MAX} initial={draft0.shots} onChange={setShots} />

          {/* ── then voice ─────────────────────────────────────────────── */}
          {recording ? (
            <div className="mmi-voice">
              <AliaVoiceRecorder
                onComplete={(v) => { setVoice({ id: applyNewId(), duration: v.duration, transcript: v.transcript, src: v.src }); setRecording(false); }}
                onCancel={() => setRecording(false)}
              />
            </div>
          ) : voice ? (
            <div className="mmi-voice" onClick={(e) => { if (locked || (e.target as HTMLElement).closest('.play-btn')) return; setVoice(null); }}>
              <AliaVoice duration={voice.duration} transcript={voice.transcript} src={voice.src} />
            </div>
          ) : !locked ? (
            <button className="cc-tool mmi-add" onClick={armVoice}>voice</button>
          ) : null}

          {/* ── then the identity — one live, self-formatting cursor per field ── */}
          <div className="mmi-fields">
            {FIELD_DEFS.map((f) => (
              <AliaField
                key={f.key}
                id={f.key}
                className={'mmi-field' + (f.big ? ' mmi-field-name' : '') + (f.key === 'ig' || f.key === 'tt' ? ' mmi-field-handle' : '')}
                placeholder={f.ph}
                initial={fields[f.key]}
                locked={locked}
                format={(raw) => fmtField(f.key, raw)}
                onChange={(v) => setField(f.key, v)}
              />
            ))}
          </div>

          {/* apply lives outside the card (below) so it can sit at the page's right edge */}
        </div>

        {/* ── apply — appears only when everything required is in; blinks; page-right ── */}
        {!locked && complete ? (
          <div className="mmi-tools">
            <button className="cc-tool cc-apply-inline mmi-apply" onClick={apply}>apply</button>
          </div>
        ) : null}

        {/* the payoff "face card strong." now lands at the TOP (rendered by ApplyFlow) */}
      </div>
    </div>
  );
}
