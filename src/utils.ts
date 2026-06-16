/* ───────────────────────────────────────────────────────────────────────────
   Alia — block / item conversion helpers
   Bridges the composer's `ComposerItem[]` model and the feed's `Block[]` model
   (renderItemsHtml batching, blocksToItems).
   ─────────────────────────────────────────────────────────────────────────── */

import type { Block, BlockKind, ComposerItem, MessageEntry } from './types';

let _id = 0;
/** Monotonic runtime id for feed entries / replies. */
export const nextId = (prefix = 'm'): string => `${prefix}${Date.now().toString(36)}-${_id++}`;

/** Stamp ids onto a seed feed (messages + their replies) so they're targetable. */
export function seedIds<T extends { replies?: MessageEntry[] }>(entries: T[]): T[] {
  return entries.map((e) => {
    const withId = { ...e, id: (e as any).id ?? nextId() } as T & { id: string };
    if ((e as unknown as MessageEntry).replies) {
      (withId as unknown as MessageEntry).replies = seedIds((e as unknown as MessageEntry).replies!);
    }
    return withId;
  });
}

/* ── Message-level spacing by send-time gap ─────────────────────────────────
   Posts are spaced by the minutes elapsed between their backend send
   timestamps, so a burst reads tight and a long lull opens visible air.
   Tier → margin is set in room.css; the rule table:
     <5 min → 'tight' · 5–14 → 'short' · 15–59 → 'medium' · 60+ → 'long'      */
export type GapTier = 'tight' | 'short' | 'medium' | 'long';

/** Spacing tier between two adjacent posts from their send timestamps (epoch ms).
 *  Returns null when either timestamp is missing (e.g. the first post). */
export function gapTier(prevTs?: number, curTs?: number): GapTier | null {
  if (prevTs == null || curTs == null) return null;
  const min = Math.max(0, (curTs - prevTs) / 60000);
  if (min < 5) return 'tight';
  if (min < 15) return 'short';
  if (min < 60) return 'medium';
  return 'long';
}

/** Coarse kind of a block, for same/different gap spacing decisions. */
export function blockKind(t: Block['type']): BlockKind {
  if (t === 'image' || t === 'images' || t === 'link-image' || t === 'video') return 'media';
  if (t === 'link-ref') return 'link';
  if (t === 'voice') return 'voice';
  if (t === 'gif') return 'gif';
  return 'text';
}

/** Gap class between two adjacent blocks ('block' | 'block gap-same' | 'block gap-diff'). */
export function gapClass(prevKind: BlockKind | null, curKind: BlockKind): string {
  if (prevKind === null) return 'block';
  return prevKind === curKind ? 'block gap-same' : 'block gap-diff';
}

/**
 * Convert a freshly-sent `ComposerItem[]` into feed `Block[]`.
 * Consecutive photos batch into one `images` stack (matching renderItemsHtml).
 */
export function itemsToBlocks(items: ComposerItem[]): Block[] {
  const clean = items.filter((b) => (b.type === 'text' ? !!b.text.trim() : true));
  const blocks: Block[] = [];
  let i = 0;
  while (i < clean.length) {
    const b = clean[i];
    if (b.type === 'photo') {
      // A cropped avatar (onboarding profile pic) renders as its own circular
      // block — never batched into the full-image stack.
      if ((b as any).kind === 'avatar') {
        blocks.push({ type: 'avatar', src: (b as any).src });
        i += 1;
        continue;
      }
      const run: ComposerItem[] = [];
      let j = i;
      while (j < clean.length && clean[j].type === 'photo' && (clean[j] as any).kind !== 'avatar') run.push(clean[j++]);
      if (run.length === 1) {
        const p = run[0] as Extract<ComposerItem, { type: 'photo' }>;
        blocks.push({ type: p.kind === 'video' ? 'video' : 'image', src: p.src, w: 220, h: 280 });
      } else {
        blocks.push({
          type: 'images',
          items: run.map((p) => ({ src: (p as any).src, aspect: 1.2 })),
        });
      }
      i = j;
      continue;
    }
    if (b.type === 'text') blocks.push({ type: 'text', text: b.text.trim() });
    else if (b.type === 'voice') blocks.push({ type: 'voice', duration: b.duration, transcript: b.transcript });
    else if (b.type === 'gif') blocks.push({ type: 'gif', src: b.src });
    else if (b.type === 'linkref') blocks.push({ type: 'link-ref', label: b.label });
    i++;
  }
  return blocks;
}

/** Reverse: feed `Block[]` → `ComposerItem[]` for edit-mode preload. */
export function blocksToItems(blocks: Block[]): ComposerItem[] {
  const items: ComposerItem[] = [];
  (blocks || []).forEach((b) => {
    if (b.type === 'text') items.push({ type: 'text', text: b.text });
    else if (b.type === 'image' && b.src) items.push({ type: 'photo', src: b.src, kind: 'photo' });
    else if (b.type === 'avatar' && b.src) items.push({ type: 'photo', src: b.src, kind: 'avatar' });
    else if (b.type === 'images') b.items.forEach((it) => it.src && items.push({ type: 'photo', src: it.src, kind: 'photo' }));
    else if (b.type === 'voice') items.push({ type: 'voice', duration: b.duration, transcript: b.transcript || '' });
    else if (b.type === 'link-ref') items.push({ type: 'linkref', label: b.label, url: '#', platform: 'web' });
  });
  return items;
}
