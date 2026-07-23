/* ───────────────────────────────────────────────────────────────────────────
   AliaPhoto — the atomic SINGLE-photo block.

   One photo, three treatments (chosen by prop, never by a separate component):
     • default (feed)  → lifts out in place on pinch / ctrl-wheel (the old
                          PhotoHold). `solo` = a lone full-width photo; otherwise
                          a packed grid cell.
     • `zoomable={false}` (editable / composer / apply) → a plain, static <img>
                          that the surrounding grid can drag + remove. No zoom.
     • `cutout` (sticker) → the die-cut contour treatment (`.stk-cut`), the same
                          way AliaAvatar has a crop variant. Presence stickers use
                          this; it is a VARIANT of a photo, not a separate block.

   AliaMediaGrid arranges a set of these (+ AliaVideo) into justified rows.
   `cutoutFromFile` (in-browser background removal → transparent PNG) lives here
   because the cutout variant owns that step. ──────────────────────────────── */

'use client';

import React from 'react';
import { useZoomHold } from '../media';

const photoBlobToDataURL = (b: Blob): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b); });

/* Turn an uploaded look into a TRANSPARENT die-cut cut-out, so the white
   contour hugs the person (not a rectangle). The stylised illustration render
   needs an image model + your key in the real app; here we do the genuine
   in-browser cut-out and fall back to the raw photo if the model can't load. */
export async function cutoutFromFile(file: File): Promise<string> {
  try {
    // Resolved by the browser at runtime (webpackIgnore keeps it a native URL
    // import — see next.config.mjs); TypeScript can't type a remote URL module.
    // @ts-expect-error — remote URL import has no local type declarations
    const mod: any = await import(/* webpackIgnore: true */ 'https://esm.sh/@imgly/background-removal@1.5.8');
    const remove = mod.removeBackground || (mod.default && mod.default.removeBackground);
    const cut = await remove(file);          // transparent-background PNG blob
    return await photoBlobToDataURL(cut);
  } catch (err) {
    console.warn('[AliaPhoto] background removal unavailable, keeping raw photo:', err);
    return await photoBlobToDataURL(file);   // raw photo fallback
  }
}

export interface AliaPhotoProps {
  src?: string;
  label?: string;
  /** lone full-width photo (natural height) vs a packed grid cell (cover). */
  solo?: boolean;
  /** die-cut sticker treatment — the cut-out contour variant. */
  cutout?: boolean;
  /** feed cells lift out on pinch / ctrl-wheel; editable cells pass false. */
  zoomable?: boolean;
  /** intrinsic display width (px) — cutout sticker sizing. */
  width?: number;
  className?: string;
}

/* die-cut cut-out variant (presence stickers) */
function CutoutPhoto({ src, width, className = '' }: AliaPhotoProps) {
  return (
    <img
      className={'stk-cut' + (className ? ' ' + className : '')}
      src={src}
      alt=""
      draggable={false}
      style={{ width: width ? width + 'px' : undefined }}
    />
  );
}

/* static cell — a plain image the grid drags / removes. No zoom, no wrapper, so
   `.rb-gal-cell > img`, `.mmi-cell > img` and `.img-wrap > img` all still apply. */
function StaticPhoto({ src, label }: AliaPhotoProps) {
  if (!src) return <div className="img-ph" data-label={label || ''} />;
  return <img src={src} alt={label || ''} draggable={false} onDragStart={(e) => e.preventDefault()} />;
}

/* feed cell — lifts the REAL <img> out in place on pinch / ctrl-wheel (was
   PhotoHold). No lightbox, no clone: a CSS transform grows it from its own spot,
   with a transparent backdrop catching the outside tap. */
function HoldPhoto({ src, label, solo }: AliaPhotoProps) {
  const { rootRef, screenRef, held, heldRect, closeHold, zoomGuard, rootStyle } = useZoomHold(true);
  const node = (
    <div ref={rootRef} className={'ph' + (solo ? ' ph-solo' : '') + (held ? ' held' : '')} style={rootStyle}>
      <div className="ph-screen" ref={screenRef}>
        {src
          ? (
            <img
              className="ph-img" src={src} alt={label || ''} draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onClick={(e) => { if (zoomGuard.current) { e.stopPropagation(); return; } if (held) { e.stopPropagation(); closeHold(); } /* plain tap bubbles up to select */ }}
            />
          )
          : <div className="img-ph" data-label={label || ''} />}
      </div>
    </div>
  );
  return (
    <React.Fragment>
      {held && heldRect ? <div key="slot" className="av-placeholder" style={{ width: heldRect.width, height: heldRect.height }} aria-hidden="true" /> : null}
      {held ? <div key="bd" className="av-zoom-backdrop" onClick={closeHold} /> : null}
      {React.cloneElement(node, { key: 'ph' })}
    </React.Fragment>
  );
}

export default function AliaPhoto(props: AliaPhotoProps) {
  if (props.cutout) return <CutoutPhoto {...props} />;
  if (props.zoomable === false) return <StaticPhoto {...props} />;
  return <HoldPhoto {...props} />;
}
