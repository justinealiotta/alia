/* ───────────────────────────────────────────────────────────────────────────
   Alia — feed helpers: id stamping, gap-spacing tiers, and block gap classes.
   ─────────────────────────────────────────────────────────────────────────── */

import type { Block, BlockKind } from './types';

let _id = 0;
/** The one block/entry id factory for the whole app. Monotonic + time-based so
 *  ids are unique across a session; pass a prefix to namespace by origin
 *  ('m' message · 'it' composer item · 'mmi' apply media · 'apply' voice).
 *  Every runtime-created block goes through here (seed blocks get deterministic
 *  ids from stableSeed instead). */
export const nextId = (prefix = 'm'): string => `${prefix}${Date.now().toString(36)}-${_id++}`;

/** Coarse kind of a block, for same/different gap spacing decisions. */
export function blockKind(t: Block['type']): BlockKind {
  if (t === 'image' || t === 'link-image' || t === 'video') return 'media';
  if (t === 'link-ref') return 'link';
  if (t === 'voice') return 'voice';
  return 'text';
}

/** Gap class between two adjacent blocks ('block' | 'block gap-same' | 'block gap-diff'). */
export function gapClass(prevKind: BlockKind | null, curKind: BlockKind): string {
  if (prevKind === null) return 'block';
  return prevKind === curKind ? 'block gap-same' : 'block gap-diff';
}
