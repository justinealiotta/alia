/* ───────────────────────────────────────────────────────────────────────────
   AliaMessageBlocks — renders one content block of a message body in the feed.

   Thin dispatcher over the canonical block components (blocks/*). The SAME
   blocks are used by the composing pages, so a text/photo/voice/video/link
   block looks identical whether it's being composed or read here. Keeps the
   feed's `.block` wrapper + interaction hooks; delegates all inner markup.
   (`gif` is retired — AliaGif removed.)

   `blockIndex` stamps each wrapper with data-block-index so a block can be
   PICKED UP out of the feed (FeedDragLayer resolves msgId + blockIndex → Block).
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React from 'react';
import type { Block, Member } from './types';
import AliaText from './blocks/AliaText';
import AliaLinkFallback from './blocks/AliaLinkFallback';
import AliaLinkPreview from './blocks/AliaLinkPreview';
import AliaMediaGrid from './blocks/AliaMediaGrid';
import AliaVideo from './blocks/AliaVideo';
import AliaVoice from './blocks/AliaVoice';
import AliaAvatar from './blocks/AliaAvatar';
import AliaName from './blocks/AliaName';

export interface AliaMessageBlocksProps {
  block: Block;
  cls: string;
  /** orbit interaction hooks */
  onInteract?: () => void;
  /** position of this block inside its message body — stamped for pick-up. */
  blockIndex?: number;
  /** composer quote: remove the whole quote via a hot zone anchored to the media
      box (only wired for single-media quote content). */
  onRemoveMedia?: () => void;
}

export default function AliaMessageBlocks({ block: b, cls, onInteract, blockIndex, onRemoveMedia }: AliaMessageBlocksProps) {
  switch (b.type) {
    case 'text':
      return <div className={cls} data-block-index={blockIndex}><AliaText text={b.text} /></div>;

    case 'link-ref':
      return <div className={cls} data-block-index={blockIndex}><AliaLinkFallback label={b.label} onClick={onInteract} /></div>;

    case 'image':
      return (
        <div className={cls} data-block-index={blockIndex} onClick={onInteract}>
          <AliaMediaGrid items={[{ kind: 'photo', src: b.src, label: b.label, aspect: b.aspect }]} w={b.w} h={b.h} onRemove={onRemoveMedia} />
        </div>
      );

    case 'video':
      return (
        <div className={cls} data-block-index={blockIndex} onClick={onInteract}>
          <AliaMediaGrid items={[{ kind: 'video', src: b.src, label: b.label, w: b.w, h: b.h, duration: b.duration, captions: b.captions, captionsSrc: b.captionsSrc, attention: b.attention }]} w={b.w} h={b.h} onRemove={onRemoveMedia} />
        </div>
      );

    case 'link-image':
      return (
        <div className={cls} data-block-index={blockIndex} onClick={onInteract}>
          <AliaLinkPreview src={b.src} label={b.label} w={b.w} h={b.h} onRemove={onRemoveMedia} />
        </div>
      );

    case 'voice':
      return (
        <div className={cls} data-block-index={blockIndex}>
          <AliaVoice duration={b.duration} transcript={b.transcript} progress={b.progress} src={b.src} onPlay={onInteract} />
        </div>
      );

    default:
      return null;
  }
}
