/* AliaLinkFallback — a link with no scraped image: the label only (lowercased).
   The `link-ref` treatment. Backend TODO: real scrape → AliaLinkPreview instead. */
'use client';
import React from 'react';

export default function AliaLinkFallback({ label, onClick }: { label?: string; onClick?: () => void }) {
  return (
    <span className="link-ref" onClick={onClick}>
      {(label || '').toLowerCase()}
    </span>
  );
}
