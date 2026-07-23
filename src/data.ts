/* ───────────────────────────────────────────────────────────────────────────
   Alia — feed data + waveform helpers (FEED, MEMBER_IMGS, SHOT, AMP).
   ─────────────────────────────────────────────────────────────────────────── */

import type { SeedEntry } from './types';

/* ── Images — public Supabase Storage bucket ───────────────────────────────── */
// Base derives from NEXT_PUBLIC_SUPABASE_URL when set, else falls back to the
// known public project so images keep resolving out of the box.
const SUPABASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  'https://ryozlodskekojirellxa.supabase.co';
const IMG_BASE = `${SUPABASE_URL}/storage/v1/object/public/images/`;
/** Resolve a stored image filename to its public Supabase URL. */
export function img(file: string): string {
  return IMG_BASE + encodeURIComponent(file);
}

/** Member portrait lookup (Alia shots, rotated for variety). */
export const MEMBER_IMGS: Record<string, string> = {
  SR: img('alia front-facing face selfie.png'),
  MC: img('alia accidental turned-head selfie face.png'),
  AV: img('alia avatar.png'),
  EL: img('alia flash glare nightlife ugc selfie.png'),
  JS: img('alia necklace detail selfie.png'),
  RY: img('alia front-facing face selfie.png'),
  LB: img('alia accidental turned-head selfie face.png'),
  ZK: img('alia avatar.png'),
  CY: img('alia flash glare nightlife ugc selfie.png'),
  PM: img('alia necklace detail selfie.png'),
  NW: img('alia front-facing face selfie.png'),
  CG: img('alia accidental turned-head selfie face.png'),
  TF: img('alia avatar.png'),
  HA: img('alia flash glare nightlife ugc selfie.png'),
  BL: img('alia necklace detail selfie.png'),
  IM: img('alia front-facing face selfie.png'),
  OV: img('alia accidental turned-head selfie face.png'),
  KD: img('alia avatar.png'),
  SC: img('alia flash glare nightlife ugc selfie.png'),
};

/** Named sample shots used in feed content. */
export const SHOT = {
  outfit: img('alia downward outfit selfie.png'),
  necklace: img('alia necklace detail selfie.png'),
  full: img('alia full body friend photo.png'),
  flash: img('alia flash glare nightlife ugc selfie.png'),
  nails: img('alia nail detail selfie.png'),
  hand: img('alia downward hand detail selfie.png'),
  faceF: img('alia front-facing face selfie.png'),
  faceT: img('alia accidental turned-head selfie face.png'),
};

/* ── Live speech-to-text ─────────────────────────────────────────────────────
   Browser-native transcription (Web Speech API), shared by every recording
   surface (AliaVoice's recorder + the room composer). It
   transcribes what the user actually says — there is NO canned fallback. When a
   browser has no speech recognition (Safari / Firefox) or nothing is heard,
   finish() returns '' and the voice note simply carries no karaoke.

   committed = words folded in from finished (paused) sessions;
   session   = words from the live, in-progress session. */
export interface Transcriber {
  start(): void;     // begin or resume a recognition session
  pause(): void;     // end the current session, folding its words in
  reset(): void;     // clear everything captured so far
  finish(): string;  // stop and return everything heard ('' if none)
  readonly supported: boolean;
}
export function createTranscriber(lang = 'en-US', onText?: (t: string) => void): Transcriber {
  const SR: any =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  let rec: any = null;
  let committed = '';
  let session = '';
  const emit = (interim = '') => { if (onText) onText((committed + ' ' + session + ' ' + interim).replace(/\s+/g, ' ').trim()); };
  const fold = () => { if (session) { committed = (committed + ' ' + session).trim(); session = ''; } };
  function start(): void {
    if (!SR || rec) return;
    try {
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = lang;
      r.onresult = (e: any) => {
        let finals = '', interim = '';
        for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; if (res.isFinal) finals += res[0].transcript; else interim += res[0].transcript; }
        session = finals; emit(interim);
      };
      r.onend = () => { fold(); rec = null; };
      r.onerror = () => {};
      rec = r; r.start();
    } catch (_e) { rec = null; }
  }
  function pause(): void { try { rec?.stop(); } catch (_e) {} rec = null; fold(); emit(); }
  function reset(): void { committed = ''; session = ''; emit(); }
  function finish(): string { pause(); return (committed + ' ' + session).replace(/\s+/g, ' ').trim(); }
  return { start, pause, reset, finish, get supported() { return !!SR; } };
}

/* ── Waveform amplitude engine ─────────────────────────────────────────────── */

export const AMP = [
  0.55, 0.78, 0.42, 0.92, 0.60, 0.35,
  0.88, 0.50, 0.70, 1.00, 0.58, 0.46,
  0.82, 0.66, 0.40, 0.74, 0.52, 0.90,
  0.60, 0.48, 0.72, 0.38,
];

/** Number of bars to draw for a clip of `dur` seconds. */
export function barCountForDuration(dur: number): number {
  return Math.round(Math.max(8, Math.min(44, 6 + Math.sqrt(dur) * 2.5)));
}

export interface WaveBar {
  h: number;
  on: boolean;
  delay: number;
}

/** "m:ss" duration string. */
export function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/* ── The seed feed ─────────────────────────────────────────────────────────── */

/** Seed-feed clock. Posts carry backend send timestamps; the room derives
 *  message-level spacing from the minutes between them. `at(min)` = minutes
 *  after the room opened. The chosen offsets exercise every spacing tier. */
const FEED_T0 = Date.parse('2026-06-14T20:42:00Z');
const at = (min: number): number => FEED_T0 + min * 60000;

export const FEED: SeedEntry[] = [
  // ── Opening: the "house" rant — text + ref + a posted look + voice ──
  {
    ts: at(0),
    user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR },
    isOwn: false,
    blocks: [
      { type: 'text', text: 'why does every brand suddenly have a "house"' },
      { type: 'image', src: SHOT.outfit, label: 'the row · resort', w: 210, h: 280 },
      { type: 'text', text: 'third "residence" invite this month and it\u2019s always a bench and one ceramic bowl' },
      { type: 'link-ref', label: 'therow.com/house' },
    ],
    interactions: ['MC', 'AV', 'EL'],
    blockReplies: [
      [
        { user: { name: 'Elise Park', initials: 'EL', img: MEMBER_IMGS.EL }, isOwn: false, blocks: [{ type: 'voice', duration: 7, progress: 0, transcript: 'a house. for who. nobody lives there' }] },
      ],
      [
        { user: { name: 'Adaeze Vance', initials: 'AV', img: MEMBER_IMGS.AV }, isOwn: false, blocks: [{ type: 'text', text: 'one bench. one bowl. every time.' }] },
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'voice', duration: 5, progress: 0, transcript: 'genuinely would live on that bench, no notes' }] },
      ],
      undefined,
      [
        { user: { name: 'Mira Cole', initials: 'MC', img: MEMBER_IMGS.MC }, isOwn: false, blocks: [{ type: 'text', text: 'do not rsvp to this one i beg' }] },
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'text', text: 'already declined. here’s the one worth it' }, { type: 'link-ref', label: 'therow.com/house' }] },
      ],
    ],
  },
  // ── Elise: masonry dump (TEST — aspect-ratio masonry grid, not justified rows) ──
  {
    ts: at(6),
    user: { name: 'Elise Park', initials: 'EL', img: MEMBER_IMGS.EL },
    isOwn: false,
    blocks: [
      { type: 'text', text: 'camera roll dump from last night — no order, just vibes' },
      { type: 'image', src: SHOT.full, aspect: 1.777 },
      { type: 'image', src: SHOT.flash, aspect: 0.75 },
      { type: 'image', src: SHOT.outfit, aspect: 1.333 },
      { type: 'image', src: SHOT.necklace, aspect: 1.0 },
      { type: 'image', src: SHOT.faceT, aspect: 1.25 },
      { type: 'image', src: SHOT.hand, aspect: 0.8 },
    ],
    interactions: ['SR', 'AV'],
    blockReplies: [
      undefined,
      [
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'text', text: 'this one. frame it.' }] },
      ],
      undefined,
      undefined,
      [
        { user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR }, isOwn: false, blocks: [{ type: 'text', text: 'the lighting here is unreal' }] },
        { user: { name: 'Adaeze Vance', initials: 'AV', img: MEMBER_IMGS.AV }, isOwn: false, blocks: [{ type: 'text', text: 'send me this full res pls' }] },
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'voice', duration: 4, progress: 0, transcript: 'sending them all to you now hold on' }] },
      ],
    ],
  },
  // ── Adaeze: where to stay — voice-led, with a side-by-side and a ref ──
  {
    ts: at(14),
    user: { name: 'Adaeze Vance', initials: 'AV', img: MEMBER_IMGS.AV },
    isOwn: false,
    blocks: [
      { type: 'voice', duration: 38, progress: 0.4, transcript: 'staying at the chateau or the mercer next week i genuinely cannot decide between the two' },
      { type: 'image', src: SHOT.full, label: 'chateau', aspect: 1.777 },
      { type: 'image', src: SHOT.flash, label: 'mercer', aspect: 1.333 },
      { type: 'link-ref', label: 'mercerhotel.com' },
    ],
    interactions: ['SR', 'EL', 'JS'],
    blockReplies: [
      [
        { user: { name: 'Mira Cole', initials: 'MC', img: MEMBER_IMGS.MC }, isOwn: false, blocks: [{ type: 'voice', duration: 6, progress: 0, transcript: 'chateau. do not overthink this one' }] },
      ],
      [
        { user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR }, isOwn: false, blocks: [{ type: 'text', text: 'chateau. no contest.' }] },
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'text', text: 'chateau every time, the light in the mornings' }] },
      ],
      [
        { user: { name: 'Elise Park', initials: 'EL', img: MEMBER_IMGS.EL }, isOwn: false, blocks: [{ type: 'text', text: 'mercer bar though. counterpoint.' }, { type: 'link-ref', label: 'mercerhotel.com/bar' }] },
      ],
      [
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'link-ref', label: 'mercerhotel.com' }] },
      ],
    ],
  },
  // ── Elise: the toteme hunt — text + shoppable + gif + voice ──
  {
    ts: at(30),
    user: { name: 'Elise Park', initials: 'EL', img: MEMBER_IMGS.EL },
    isOwn: false,
    blocks: [
      { type: 'text', text: 'someone send me the toteme cardigan in cream before they all go again' },
      { type: 'link-image', src: SHOT.outfit, label: 'toteme · cardigan', w: 210, h: 280 },
      { type: 'text', text: 'i have looked at this exact page for nine days' },
    ],
    interactions: ['AV', 'SR', 'JS'],
    blockReplies: [
      undefined,
      [
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'voice', duration: 6, progress: 0, transcript: 'on it — checking soho stock for you right now' }] },
      ],
      [
        { user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR }, isOwn: false, blocks: [{ type: 'text', text: 'cream is gone everywhere online, i looked all week' }, { type: 'link-ref', label: 'net-a-porter.com/toteme' }] },
      ],
    ],
  },
  // ── You: the residence opening clip — text + video + text + ref ──
  {
    ts: at(36),
    user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS },
    isOwn: true,
    blocks: [
      { type: 'text', text: 'okay the fit finally came together — filming before we head out' },
      { type: 'video', src: '/media/ambient-clip.mp4', label: 'the fit', w: 240, h: 427, duration: 14, attention: 5, captions: [
        { t: 0.4, s: 'okay the vintage set finally came in' },
        { t: 4.0, s: 'and i am not taking it off' },
        { t: 8.0, s: 'tell me the fit actually works' },
        { t: 11.5, s: 'because i am kind of obsessed' },
      ] },
      { type: 'text', text: 'tell me it works before i wear it out tonight' },
      { type: 'link-ref', label: 'instagram.com/reel' },
    ],
    interactions: [],
    blockReplies: [
      undefined,
      [
        { user: { name: 'Mira Cole', initials: 'MC', img: MEMBER_IMGS.MC }, isOwn: false, blocks: [{ type: 'voice', duration: 8, progress: 0, transcript: 'the pleats especially — that fit is genuinely unreal on you' }] },
        { user: { name: 'Adaeze Vance', initials: 'AV', img: MEMBER_IMGS.AV }, isOwn: false, blocks: [{ type: 'text', text: 'okay this genuinely made me want to steal it' }] },
      ],
      undefined,
      [
        { user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR }, isOwn: false, blocks: [{ type: 'link-ref', label: 'instagram.com/reel' }] },
      ],
    ],
    edited: true,
  },
  // ── Mira: paris dinner plan — text + look + voice + booking + text ──
  {
    ts: at(52),
    user: { name: 'Mira Cole', initials: 'MC', img: MEMBER_IMGS.MC },
    isOwn: false,
    blocks: [
      { type: 'text', text: 'paris next week — who is around and who has the reservation' },
      { type: 'image', src: SHOT.full, label: 'rue de rivoli', aspect: 1.777 },
      { type: 'image', src: SHOT.outfit, label: 'le mary', aspect: 1.333 },
      { type: 'text', text: 'wear something you can sit in for four hours' },
    ],
    interactions: ['EL', 'AV', 'SR'],
    blockReplies: [
      undefined,
      undefined,
      undefined,
      [
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'text', text: 'booked le mary for thursday, 8pm' }, { type: 'link-ref', label: 'lemary.paris/reservations' }] },
        { user: { name: 'Elise Park', initials: 'EL', img: MEMBER_IMGS.EL }, isOwn: false, blocks: [{ type: 'voice', duration: 5, progress: 0, transcript: 'putting it in the calendar right now, do not move it' }] },
      ],
    ],
  },
  // ── Elise: the reel + set — a MIXED media grid (photos + a clip together) ──
  {
    ts: at(60),
    user: { name: 'Elise Park', initials: 'EL', img: MEMBER_IMGS.EL },
    isOwn: false,
    blocks: [
      { type: 'text', text: 'pulled a few frames from the fitting — the last one sold me' },
      { type: 'image', src: SHOT.outfit, label: 'look 1', aspect: 1.333 },
      { type: 'video', src: '/media/ambient-clip.mp4', label: 'the reel', w: 240, h: 427, duration: 14, captions: [
        { t: 0.4, s: 'pulled a few frames from the fitting' },
        { t: 4.2, s: 'watch how the light lands on it' },
        { t: 9.0, s: 'the last look is the one' },
      ] },
      { type: 'image', src: SHOT.full, label: 'look 2', aspect: 1.777 },
      { type: 'text', text: 'that second look is the whole story' },
    ],
    interactions: ['MC', 'AV', 'SR'],
    blockReplies: [
      undefined,
      undefined,
      undefined,
      [
        { user: { name: 'Adaeze Vance', initials: 'AV', img: MEMBER_IMGS.AV }, isOwn: false, blocks: [{ type: 'voice', duration: 5, progress: 0, transcript: 'look two is the one you wear thursday, final answer' }] },
      ],
      [
        { user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS }, isOwn: true, blocks: [{ type: 'text', text: 'the reel is the one. obviously.' }] },
      ],
    ],
  },
  // ── Sasha: the chateau follow-up — text + suite + voice ──
  {
    ts: at(120),
    user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR },
    isOwn: false,
    blocks: [
      { type: 'voice', duration: 11, progress: 0, transcript: 'wait did you actually book the chateau too — because if so i am moving my flight to match yours' },
      { type: 'image', src: SHOT.flash, label: 'chateau · suite', w: 210, h: 280 },
    ],
    interactions: [],
  },
  // ── You: close it out — text + confirmation + text + voice ──
  {
    ts: at(122),
    user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS },
    isOwn: true,
    blocks: [
      { type: 'voice', duration: 9, progress: 0, transcript: 'corner suite sorted — same floor as last time, the quiet one. bring the good camera this time' },
      { type: 'image', src: SHOT.full, label: 'confirmation', w: 210, h: 373 },
    ],
    interactions: [],
  },
];
