/* ───────────────────────────────────────────────────────────────────────────
   Alia — shared types (room model + composer items).
   ─────────────────────────────────────────────────────────────────────────── */

/** A room member / speaker. `img` is a portrait URL; `initials` keys avatars. */
export interface Member {
  name: string;
  initials: string;
  img?: string;
}

/** A single content block inside a message body. Messages are an ordered
 *  stream of these — text, media, voice, link. */
export type Block =
  | { type: 'text'; text: string }
  | { type: 'link-ref'; label: string }
  | { type: 'image'; src?: string; label?: string; w?: number; h?: number }
  | { type: 'video'; src?: string; label?: string; w?: number; h?: number }
  | { type: 'images'; items: Array<{ src?: string; label?: string; aspect?: number }> }
  | { type: 'link-image'; src?: string; label?: string; w?: number; h?: number }
  | { type: 'voice'; duration: number; progress?: number; transcript?: string }
  | { type: 'gif'; src?: string; label?: string; ar?: string }
  | { type: 'avatar'; src?: string };

/** High-level "kind" used to decide same/different gap spacing between blocks. */
export type BlockKind = 'media' | 'link' | 'voice' | 'gif' | 'text';

/** A posted message (or reply — replies are the same shape, scaled down).
 *  `id` is assigned at runtime so reply / edit / unsend can target it. */
export interface MessageEntry {
  id?: string;
  /** Backend send timestamp (epoch ms). Drives message-level gap spacing. */
  ts?: number;
  user: Member;
  isOwn: boolean;
  blocks: Block[];
  hearts?: string[];
  interactions?: string[];
  edited?: boolean;
  replies?: MessageEntry[];
}

/** Ephemeral 24h text card that floats in the feed. */
export interface PhraseEntry {
  id?: string;
  /** Backend send timestamp (epoch ms). Drives message-level gap spacing. */
  ts?: number;
  phrase: string;
}

export type FeedEntry = MessageEntry | PhraseEntry;

export const isPhrase = (e: FeedEntry): e is PhraseEntry =>
  (e as PhraseEntry).phrase !== undefined;

/* ── Composer item model ─────────────────────────────────────────────────────
   The ordered array emitted by the composer on send, and consumed by the feed
   to render a freshly-posted message (the composer's serialize() output). */
export type ComposerItem =
  | { type: 'text'; text: string }
  | { type: 'photo'; src: string; kind?: 'photo' | 'video' | 'avatar' }
  | { type: 'voice'; duration: number; transcript?: string }
  | { type: 'gif'; src: string }
  | { type: 'linkref'; url: string; platform?: string; label: string };

export type ComposerMode =
  | 'room'
  | 'reply'
  | 'edit'
  | 'application'
  | 'casting-onboarding'
  | 'otp'
  | 'p2p-onboarding'
  | 'p2p-referral'
  | 'profile';
