/* ───────────────────────────────────────────────────────────────────────────
   Alia — feed data + waveform helpers (FEED, MEMBER_IMGS, SHOT, AMP).
   ─────────────────────────────────────────────────────────────────────────── */

import type { FeedEntry } from './types';

/* ── Images — public Supabase Storage bucket ───────────────────────────────── */
// Base derives from NEXT_PUBLIC_SUPABASE_URL when set, else falls back to the
// known public project so images keep resolving out of the box.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ryozlodskekojirellxa.supabase.co';
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

/** Full roster — used to extend an orbit pool as engagement grows. */
export const MEMBERS = [
  'SR', 'MC', 'AV', 'EL', 'JS', 'RY', 'LB', 'ZK', 'PM', 'NW',
  'CG', 'TF', 'HA', 'BL', 'IM', 'OV', 'KD', 'SC',
];

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

/** GIF picker pool (reply mode). */
export const GIFS = [
  img('alia flash glare nightlife ugc selfie.png'),
  img('alia downward outfit selfie.png'),
  img('alia full body friend photo.png'),
  img('alia necklace detail selfie.png'),
  img('alia accidental turned-head selfie body.png'),
  img('alia nail detail selfie.png'),
];

/** Transcript spoken when a fresh voice note is recorded in the composer. */
export const REC_TRANSCRIPT =
  'okay the chateau it is. i\u2019ll book the corner suite and we figure out the rest when we land.';

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

/** Build the bar model for a wave at a given fill `progress` (0–1). */
export function voiceBars(progress = 0, count = AMP.length): WaveBar[] {
  const cutoff = Math.floor(count * progress);
  return Array.from({ length: count }, (_, i) => ({
    h: AMP[i % AMP.length],
    on: i < cutoff,
    delay: (i * 53) % 1100,
  }));
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

export const FEED: FeedEntry[] = [
  // ── Opening burst: three posts inside two minutes → all "tight" (<5 min) ──
  {
    ts: at(0),
    user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR },
    isOwn: false,
    blocks: [{ type: 'text', text: 'why does every brand suddenly have a "house"' }],
    hearts: [],
    interactions: [],
  },
  {
    ts: at(1),
    user: { name: 'Mira Cole', initials: 'MC', img: MEMBER_IMGS.MC },
    isOwn: false,
    blocks: [
      { type: 'text', text: 'because they read one ssense editorial and panicked' },
      { type: 'link-ref', label: 'editorial ssense.com' },
    ],
    hearts: ['JS', 'AV'],
    interactions: ['JS'],
  },
  {
    ts: at(2),
    user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR },
    isOwn: false,
    blocks: [{ type: 'text', text: 'and it\u2019s always a "bench" and a single ceramic bowl' }],
    hearts: ['MC'],
    interactions: [],
  },
  // ── 9-minute lull → "short" (5–14 min) ──
  {
    ts: at(11),
    user: { name: 'Mira Cole', initials: 'MC', img: MEMBER_IMGS.MC },
    isOwn: true,
    blocks: [
      { type: 'image', src: SHOT.necklace, label: 'editorial · the row', w: 220, h: 280 },
      { type: 'text', text: 'this is what I mean. no merchandising. just rooms.' },
    ],
    hearts: ['JS', 'SR', 'AV', 'EL'],
    interactions: ['EL', 'AV', 'SR'],
    edited: true,
    replies: [
      {
        user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR },
        isOwn: false,
        blocks: [{ type: 'text', text: 'and the staff doesn\u2019t hover. nobody asks if i\u2019m \u201clooking for something specific\u201d' }],
        hearts: ['MC', 'JS'],
      },
      {
        user: { name: 'Mira Cole', initials: 'MC', img: MEMBER_IMGS.MC },
        isOwn: false,
        blocks: [{ type: 'text', text: 'the bench!! that\u2019s the entire pitch' }],
        hearts: ['JS', 'SR'],
      },
    ],
  },
  // ── 18-minute lull → "medium" (15–59 min) ──
  {
    ts: at(29),
    user: { name: 'Adaeze Vance', initials: 'AV', img: MEMBER_IMGS.AV },
    isOwn: false,
    blocks: [
      { type: 'voice', duration: 38, progress: 0.4, transcript: 'staying at the chateau or the mercer next week? i can never decide between the two' },
    ],
    hearts: ['JS'],
    interactions: ['SR'],
  },
  // ── 3 minutes later → back to "tight" ──
  { ts: at(32), phrase: 'gone in 24 hours.\nnot archived, not saved.' },
  // ── 88-minute lull → "long" (60+ min): the biggest break in the feed ──
  {
    ts: at(120),
    user: { name: 'Elise Park', initials: 'EL', img: MEMBER_IMGS.EL },
    isOwn: false,
    blocks: [
      { type: 'text', text: 'someone send me the toteme cardigan in cream before they all go again' },
      { type: 'link-image', src: SHOT.outfit, label: 'toteme · cardigan', w: 200, h: 240 },
    ],
    hearts: ['MC', 'AV', 'SR'],
    interactions: ['AV', 'SR', 'JS'],
    replies: [
      {
        user: { name: 'Adaeze Vance', initials: 'AV', img: MEMBER_IMGS.AV },
        isOwn: false,
        blocks: [{ type: 'text', text: 'last one was a 36 at the soho store yesterday fyi' }],
        hearts: ['EL'],
      },
    ],
  },
  // ── 6 minutes later → "short" ──
  {
    ts: at(126),
    user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS },
    isOwn: true,
    blocks: [
      { type: 'text', text: 'that lobby energy is exactly what i want every store to have honestly' },
      { type: 'image', src: SHOT.faceF, label: 'ref', w: 220, h: 280 },
    ],
    hearts: ['SR', 'MC'],
    interactions: [],
    edited: true,
  },
  // ── Closing burst: two replies inside a minute → "tight" again ──
  {
    ts: at(127),
    user: { name: 'Sasha Renoir', initials: 'SR', img: MEMBER_IMGS.SR },
    isOwn: false,
    blocks: [{ type: 'text', text: 'wait did you actually book the chateau' }],
    hearts: ['MC'],
    interactions: [],
  },
  {
    ts: at(128),
    user: { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS },
    isOwn: true,
    blocks: [{ type: 'text', text: 'corner suite. sorted.' }],
    hearts: ['SR', 'AV'],
    interactions: [],
  },
];
