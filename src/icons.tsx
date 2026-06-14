/* ───────────────────────────────────────────────────────────────────────────
   Alia — icon set
   Hand-considered glyphs, single 1.4 stroke, currentColor. `data-icon` is
   preserved so existing CSS
   hooks (orbit spin, send seam, light-mode send detail) keep working.
   ─────────────────────────────────────────────────────────────────────────── */

import React from 'react';

export type IconName =
  | 'key' | 'image' | 'mic' | 'send' | 'play' | 'pause'
  | 'heart' | 'heart-filled' | 'orbit' | 'stop' | 'save'
  | 'check' | 'search' | 'x' | 'alia-down'
  | 'plus' | 'grip' | 'link' | 'ig' | 'tt'
  | 'restart' | 'arrow' | 'copy' | 'share' | 'chat' | 'camera';

type Glyph = (s: number) => React.ReactElement;

const GLYPHS: Record<IconName, Glyph> = {
  key: (s) => (
    <svg data-icon="key" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 10.6 C 12 10.6 8.5 8.4 8.5 6.2 C 8.5 4.9 9.5 4 10.6 4 C 11.5 4 12 4.6 12 5.4 C 12 4.6 12.5 4 13.4 4 C 14.5 4 15.5 4.9 15.5 6.2 C 15.5 8.4 12 10.6 12 10.6 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
      <line x1="12" y1="10.6" x2="12" y2="20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="16.5" x2="15" y2="16.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="19.5" x2="14.2" y2="19.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  image: (s) => (
    <svg data-icon="image" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="3.5" width="15" height="17" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <rect x="6.8" y="5.8" width="10.4" height="9" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  mic: (s) => (
    <svg data-icon="mic" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <line x1="4.5" y1="11" x2="4.5" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="8" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="11.5" y1="5" x2="11.5" y2="19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="15" y1="8" x2="15" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="18.5" y1="10" x2="18.5" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  send: (s) => (
    <svg data-icon="send" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5 L21 4 L14 21 L12 13 Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 13 L21 4" stroke="#000" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  play: (s) => (
    <svg data-icon="play" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M8 5.5 L18.5 12 L8 18.5 Z" fill="currentColor" />
    </svg>
  ),
  pause: (s) => (
    <svg data-icon="pause" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <line x1="9" y1="6" x2="9" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="6" x2="15" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  heart: (s) => (
    <svg data-icon="heart" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12.2 20.2 C 6.3 16.3 3.2 13.4 3.2 9.6 C 3.2 7 5.3 5 7.9 5 C 9.9 5 11.2 6.1 12.2 7.7 C 13.2 6.1 14.6 5 16.6 5 C 19.2 5 21.2 7 21.2 9.6 C 21.2 13.4 18.1 16.3 12.2 20.2 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  'heart-filled': (s) => (
    <svg data-icon="heart-filled" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12.2 20.2 C 6.3 16.3 3.2 13.4 3.2 9.6 C 3.2 7 5.3 5 7.9 5 C 9.9 5 11.2 6.1 12.2 7.7 C 13.2 6.1 14.6 5 16.6 5 C 19.2 5 21.2 7 21.2 9.6 C 21.2 13.4 18.1 16.3 12.2 20.2 Z" fill="currentColor" />
    </svg>
  ),
  orbit: (s) => (
    <svg data-icon="orbit" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <g className="orbiters">
        <circle cx="18.55" cy="7.41" r="1.7" fill="currentColor" />
        <circle cx="5.45" cy="16.59" r="1.7" fill="currentColor" />
      </g>
    </svg>
  ),
  stop: (s) => (
    <svg data-icon="stop" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
    </svg>
  ),
  save: (s) => (
    <svg data-icon="save" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 4 L12 15.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7.5 11.5 L12 16 L16.5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="5" y1="20" x2="19" y2="20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  check: (s) => (
    <svg data-icon="check" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4.5 12.5 L9.5 17.5 L19.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  search: (s) => (
    <svg data-icon="search" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="10" cy="10" r="5.8" stroke="currentColor" strokeWidth="1.4" />
      <line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  x: (s) => (
    <svg data-icon="x" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  'alia-down': (s) => (
    <svg data-icon="alia-down" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4.5 4 L12 20 L19.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (s) => (
    <svg data-icon="plus" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 5 V19 M5 12 H19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  grip: (s) => (
    <svg data-icon="grip" width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  ),
  link: (s) => (
    <svg data-icon="link" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M10 13.5 a3.2 3.2 0 0 0 4.6 0 l3-3 a3.2 3.2 0 0 0 -4.6 -4.6 l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 10.5 a3.2 3.2 0 0 0 -4.6 0 l-3 3 a3.2 3.2 0 0 0 4.6 4.6 l1.4 -1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ig: (s) => (
    <svg data-icon="ig" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="4.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.6" cy="7.4" r="1.05" fill="currentColor" />
    </svg>
  ),
  tt: (s) => (
    <svg data-icon="tt" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M14 4 c0.5 2.6 2.2 4.3 4.8 4.6 v2.7 c-1.8 0.05 -3.4 -0.5 -4.8 -1.5 v5.6 a5 5 0 1 1 -5 -5 c0.35 0 0.7 0.03 1 0.1 v2.8 a2.2 2.2 0 1 0 1.5 2.1 V4 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  restart: (s) => (
    <svg data-icon="restart" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 4v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrow: (s) => (
    <svg data-icon="arrow" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 12 H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 6 L19 12 L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  copy: (s) => (
    <svg data-icon="copy" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="8" y="8" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 16 V5 a2 2 0 0 1 2 -2 h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  share: (s) => (
    <svg data-icon="share" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5 V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 7 L12 3.5 L16 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 11 H6 a1.5 1.5 0 0 0 -1.5 1.5 V18.5 A1.5 1.5 0 0 0 6 20 H18 a1.5 1.5 0 0 0 1.5 -1.5 V12.5 A1.5 1.5 0 0 0 18 11 H17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chat: (s) => (
    <svg data-icon="chat" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 6 a2 2 0 0 1 2 -2 h12 a2 2 0 0 1 2 2 v8 a2 2 0 0 1 -2 2 H9 l-4 4 V6 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  camera: (s) => (
    <svg data-icon="camera" width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 8.5 a1.5 1.5 0 0 1 1.5 -1.5 H8 l1.2 -2 h5.6 L16 7 h2.5 A1.5 1.5 0 0 1 20 8.5 V18 a1.5 1.5 0 0 1 -1.5 1.5 H5.5 A1.5 1.5 0 0 1 4 18 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12.8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/** Render a named glyph at `size` px (default 22). */
export function Icon({ name, size = 22, className }: IconProps) {
  const glyph = GLYPHS[name];
  if (!glyph) return null;
  const svg = glyph(size);
  return className ? React.cloneElement(svg, { className }) : svg;
}
