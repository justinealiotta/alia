/* AliaLinkPreview — a link WITH a scraped image. When the scrape returns an
   image (`src`), render it through the SAME single-cell media sizing as a shared
   photo: aspect-ratio preserved, height capped by the justified packer (never
   full-column, never a white box). When there's NO image, fall back to the
   text-styled link (the `link-ref` treatment). Backend TODO: wire the real
   scrape (edge function) to supply `src`. */
'use client';
import React from 'react';
import AliaMediaGrid from './AliaMediaGrid';
import AliaLinkFallback from './AliaLinkFallback';

export default function AliaLinkPreview({ src, label, w, h, onClick, onRemove }:
  { src?: string; label?: string; w?: number; h?: number; onClick?: () => void; onRemove?: () => void }) {
  if (!src) return <AliaLinkFallback label={label} onClick={onClick} />;
  return <AliaMediaGrid items={[{ kind: 'photo', src, label }]} w={w} h={h} onRemove={onRemove} />;
}
