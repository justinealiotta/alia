/* ───────────────────────────────────────────────────────────────────────────
   MessageBlocks — renders one content block of a message body.
   Matches messages.css DOM (.block / .img-with-save / .img-wrap / .imgs-stack /
   .link-ref / .gif-wrap). Voice delegates to <AliaVoice>.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useState } from 'react';
import type { Block } from './types';
import { Icon } from './icons';
import AliaVoice from './AliaVoice';

export interface MediaOpen {
  (src: string, isAvatar: boolean): void;
}

/** Save button that flashes on tap (prototype feedback only). */
function SaveButton() {
  const [saved, setSaved] = useState(false);
  return (
    <button
      className={`save-btn${saved ? ' saved' : ''}`}
      aria-label="Save image"
      onClick={(e) => {
        e.stopPropagation();
        setSaved(true);
        setTimeout(() => setSaved(false), 600);
      }}
    >
      <Icon name="save" size={18} />
    </button>
  );
}

function Img({ src, label, onOpen }: { src?: string; label?: string; onOpen?: MediaOpen }) {
  if (!src) return <div className="img-ph" data-label={label || ''} />;
  return (
    <img
      src={src}
      alt=""
      style={{ cursor: 'zoom-in' }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(src, false);
      }}
    />
  );
}

export interface MessageBlockProps {
  block: Block;
  cls: string;
  onOpenMedia?: MediaOpen;
  /** orbit interaction hooks */
  onInteract?: () => void;
}

export default function MessageBlock({ block: b, cls, onOpenMedia, onInteract }: MessageBlockProps) {
  switch (b.type) {
    case 'text':
      return (
        <div className={cls}>
          <p className="text">{b.text}</p>
        </div>
      );

    case 'link-ref':
      return (
        <div className={cls}>
          <span className="link-ref" onClick={onInteract}>
            {(b.label || '').toLowerCase()}
          </span>
        </div>
      );

    case 'image':
    case 'video': {
      const w = b.w || 220;
      const h = b.h || 280;
      return (
        <div className={cls} onClick={onInteract}>
          <div className="img-with-save">
            <div className="img-wrap" style={{ width: '100%', aspectRatio: `${w}/${h}` }}>
              <Img src={b.src} label={b.label} onOpen={onOpenMedia} />
              {b.type === 'video' ? <span className="vid-badge"><Icon name="play" /></span> : null}
            </div>
            <SaveButton />
          </div>
        </div>
      );
    }

    case 'images':
      return (
        <div className={cls} onClick={onInteract}>
          <div className="imgs-stack" style={{ width: '100%' }}>
            {b.items.map((it, i) => (
              <div className="img-with-save" key={i}>
                <div className="img-wrap" style={{ width: '100%', aspectRatio: `1/${it.aspect || 1.2}` }}>
                  <Img src={it.src} label={it.label} onOpen={onOpenMedia} />
                </div>
                <SaveButton />
              </div>
            ))}
          </div>
        </div>
      );

    case 'link-image': {
      const w = b.w || 200;
      const h = b.h || 240;
      return (
        <div className={cls} onClick={onInteract}>
          <div className="img-wrap link-img" style={{ width: '100%', aspectRatio: `${w}/${h}`, background: '#fff' }}>
            <Img src={b.src} label={b.label} onOpen={onOpenMedia} />
          </div>
        </div>
      );
    }

    case 'gif': {
      const ar = b.ar || '180/120';
      return (
        <div className={cls} onClick={onInteract}>
          <div className="gif-wrap" style={{ aspectRatio: ar }}>
            <Img src={b.src} label={b.label} onOpen={onOpenMedia} />
          </div>
        </div>
      );
    }

    case 'avatar':
      return (
        <div className={cls}>
          <div className="msg-avatar">
            {b.src ? (
              <img
                src={b.src}
                alt=""
                style={{ cursor: 'zoom-in' }}
                onClick={(e) => { e.stopPropagation(); onOpenMedia?.(b.src!, true); }}
              />
            ) : null}
          </div>
        </div>
      );

    case 'voice':
      return (
        <div className={cls}>
          <AliaVoice duration={b.duration} transcript={b.transcript} progress={b.progress} onPlay={onInteract} />
        </div>
      );

    default:
      return null;
  }
}
