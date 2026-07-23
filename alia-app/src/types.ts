/* ───────────────────────────────────────────────────────────────────────────
   Alia — shared types (room model + composer items).
   ─────────────────────────────────────────────────────────────────────────── */

/** A room member / speaker. `img` is a portrait URL; `initials` keys avatars. */
export interface Member {
  name: string;
  initials: string;
  img?: string;
}

/** The content of a block, minus identity. Every block IS one of these plus a
 *  stable `id`. Split out so the seed-authoring shape can reuse it id-lessly. */
export type BlockBody = (
  | { type: 'text'; text: string }
  | { type: 'link-ref'; label: string; url?: string }
  | { type: 'image'; src?: string; label?: string; w?: number; h?: number; aspect?: number; rowBreak?: boolean }
  | { type: 'video'; src?: string; label?: string; w?: number; h?: number; duration?: number; captions?: Array<{ t: number; s: string }>; captionsSrc?: string; attention?: number; rowBreak?: boolean }
  | { type: 'link-image'; src?: string; label?: string; w?: number; h?: number }
  | { type: 'voice'; duration: number; progress?: number; transcript?: string; src?: string }
);

/** A single content block inside a message body. Messages are an ordered
 *  stream of these — text, media, voice, link.
 *  `id` is REQUIRED: it is the block's permanent identity — the key block-level
 *  replies pin to, and the key/column its data persists under. Blocks are only
 *  ever created through `nextId()` (runtime) or `stableSeed()` (seed load), so
 *  a live block without an id cannot exist. Author seed blocks as `SeedBlock`
 *  (id-less); `stableSeed()` stamps the id on load. */
export type Block = BlockBody & { id: string };

/** Seed-authoring block — same content, no id yet (stamped by stableSeed). */
export type SeedBlock = BlockBody & { id?: string };

/** High-level "kind" used to decide same/different gap spacing between blocks. */
export type BlockKind = 'media' | 'link' | 'voice' | 'text';

/** A posted message (or reply — replies are the same shape, scaled down).
 *  `id` is assigned at runtime so reply / edit / unsend can target it. */
export interface MessageEntry {
  id?: string;
  /** Backend send timestamp (epoch ms). Drives message-level gap spacing. */
  ts?: number;
  user: Member;
  isOwn: boolean;
  blocks: Block[];
  interactions?: string[];
  edited?: boolean;
  /** Block-level replies — pinned to a specific block INSIDE this message and
   *  rendered inline right under that block (avatar indented into the body
   *  column). Keyed by the STABLE Block.id of the block they hang under, so they
   *  TRAVEL with the block across reorders and are DROPPED when the block is
   *  deleted (see handleSendEdit's prune). */
  blockReplies?: Record<string, MessageEntry[]>;
}

/** Seed-authoring shape. Static seed data (data.ts) writes `blockReplies`
 *  POSITIONALLY (indexed by block position) because block ids don't exist at
 *  author time; `stableSeed()` stamps block ids and converts these into the
 *  id-keyed runtime form above. */
export interface SeedEntry {
  id?: string;
  ts?: number;
  user: Member;
  isOwn: boolean;
  blocks: SeedBlock[];
  interactions?: string[];
  edited?: boolean;
  blockReplies?: (SeedEntry[] | undefined)[];
}
