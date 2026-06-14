/* ───────────────────────────────────────────────────────────────────────────
   composer/iconHtml.ts — SVG icon strings for the composer engine.

   The composer engine has no React tree for its icons — its NodeViews +
   toolbar build DOM via innerHTML — so the glyphs are provided here as HTML
   strings. Markup matches icons.tsx and carries the same data-icon hooks the
   CSS targets.
   ─────────────────────────────────────────────────────────────────────────── */

const CM_ICONS: Record<string, string> = {
  image:
    '<svg data-icon="image" width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="3.5" width="15" height="17" rx="1.4" stroke="currentColor" stroke-width="1.4"/><rect x="6.8" y="5.8" width="10.4" height="9" stroke="currentColor" stroke-width="1.2"/></svg>',
  mic:
    '<svg data-icon="mic" width="22" height="22" viewBox="0 0 24 24" fill="none"><line x1="4.5" y1="11" x2="4.5" y2="13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="8" y1="8" x2="8" y2="16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="11.5" y1="5" x2="11.5" y2="19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="15" y1="8" x2="15" y2="16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="18.5" y1="10" x2="18.5" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  send:
    '<svg data-icon="send" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 11.5 L21 4 L14 21 L12 13 Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 13 L21 4" stroke="#000" stroke-width="0.9" stroke-linecap="round" opacity="0.5"/></svg>',
  play:
    '<svg data-icon="play" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M8 5.5 L18.5 12 L8 18.5 Z" fill="currentColor"/></svg>',
  pause:
    '<svg data-icon="pause" width="22" height="22" viewBox="0 0 24 24" fill="none"><line x1="9" y1="6" x2="9" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="15" y1="6" x2="15" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  stop:
    '<svg data-icon="stop" width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/></svg>',
  search:
    '<svg data-icon="search" width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="10" cy="10" r="5.8" stroke="currentColor" stroke-width="1.4"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  x:
    '<svg data-icon="x" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/** Icon HTML string, optionally resized. */
export function cmIcon(name: string, size?: number): string {
  let html = CM_ICONS[name] || '';
  if (size) {
    html = html.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
  }
  return html;
}
