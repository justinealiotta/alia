/* AliaVideo — a single video block with Alia's own controls (no native chrome).

   Ambient player. The footage is a clean rectangle on the black surface; the
   only things that ever sit on the image are the centred play glyph (paused),
   the sound glyph (on hover / scrub), and a single hairline scrub on the bottom
   edge. Per Alia's language: no speed, no oversized time, no icons.

   The hairline is a PAUSED-state control: it's hidden while the clip plays and
   appears only when the clip is off, so you can drag it to scrub — and the frame
   seeks live under your finger. It works the same when the clip is lifted big on
   pinch-zoom (the scrub math reads the transformed rect).

   Two sources are supported, both driving the SAME controls:
   • a real video (blob / .mp4 …) → bound to a chromeless <video> element.
   • an image poster (the feed's stills) → playback is SIMULATED, exactly the way
     AliaVoice simulates a voice note, so the block reads as a video in the feed.

   Perf note: progress/caption are updated IMPERATIVELY through refs inside the
   rAF loop. Only coarse state (playing / muted) lives in React, so the opacity
   transitions run smoothly and control taps never get starved by a per-frame
   re-render. */
'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useZoomHold } from '../media';

const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const avFmt = (t: number) => { t = Math.max(0, t); return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); };

export interface Caption { t: number; s: string }

const AV_THUMB_IMG = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;

/* Static thumbnail variant — a covered still + play glyph, no controls, no zoom,
   no playback. This is what an AliaVideo looks like as a DRAGGABLE grid cell in
   the composer (a live player would fight the drag). Renders the inner markup the
   grid cell already styles (footage + .av-play), so no CSS changes. */
function VideoThumb({ src, label }: { src?: string; label?: string }) {
  if (!src) return <div className="img-ph" data-label={label || ''} />;
  return (
    <>
      {AV_THUMB_IMG.test(src)
        ? <img src={src} alt={label || ''} draggable={false} />
        : <video src={src} muted playsInline preload="metadata" disablePictureInPicture />}
    </>
  );
}

export default function AliaVideo(props: { src?: string; label?: string; w?: number; h?: number; duration?: number; captions?: Caption[]; captionsSrc?: string; attention?: number; autoplay?: boolean; startPlaying?: boolean; controls?: boolean; zoomable?: boolean; thumbnail?: boolean; onRemove?: () => void }) {
  if (props.thumbnail) return <VideoThumb src={props.src} label={props.label} />;
  return <AliaVideoPlayer {...props} />;
}

function AliaVideoPlayer({ src, label, w = 220, h = 280, duration, captions, captionsSrc, autoplay = false, startPlaying = false, controls = false, zoomable = false }:
  { src?: string; label?: string; w?: number; h?: number; duration?: number; captions?: Caption[]; captionsSrc?: string; attention?: number; autoplay?: boolean; startPlaying?: boolean; controls?: boolean; zoomable?: boolean; onRemove?: () => void }) {
  const hasSrc = !!src;
  const [failed, setFailed] = useState(false);
  /* iOS Safari refuses to play a <video> served without HTTP byte-range support
     (it errors with MEDIA_ERR_SRC_NOT_SUPPORTED). When a direct load fails we
     fetch the whole file once and hand the <video> a blob: URL instead — blob
     URLs are range-seekable in-browser, so the same clip plays. */
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const triedBlob = useRef(false);
  const playable = hasSrc && !failed && !IMG_EXT.test(src!);
  const videoSrc = blobSrc || src;

  const recoverViaBlob = () => {
    const s = src || '';
    if (triedBlob.current || !s || /^(blob:|data:)/.test(s)) { setFailed(true); return; }
    triedBlob.current = true;
    fetch(s)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then((b) => setBlobSrc(URL.createObjectURL(b)))
      .catch(() => setFailed(true));
  };
  useEffect(() => () => { if (blobSrc) URL.revokeObjectURL(blobSrc); }, [blobSrc]);
  /* Proactively fetch a range-seekable blob up front. Some mobile webviews
     (iOS Safari) STALL on a source without HTTP byte-range support instead of
     firing `error`, so the onError recovery below never runs there and the clip
     shows as a broken black frame. Fetching the whole file to a blob: URL on
     mount sidesteps range requests entirely, so the clip plays everywhere. Skips
     sources that are already seekable (blob:/data:). */
  useEffect(() => {
    if (!playable) return;
    const s = src || '';
    if (!s || /^(blob:|data:)/.test(s)) return;
    if (blobSrc || triedBlob.current) return;
    recoverViaBlob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable, src]);
  // when the blob src arrives, force the element to pick it up
  useEffect(() => { if (blobSrc && videoRef.current) { try { videoRef.current.load(); } catch (_e) {} } }, [blobSrc]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const curRef = useRef(0);
  const durRef = useRef(duration || 14);
  const trackRef = useRef<TextTrack | null>(null);
  const scrubbing = useRef(false);
  const userPaused = useRef(false);
  const maskId = React.useId();

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  // on-the-footage chrome: the sound glyph reveals on hover / scrub.
  const [hovering, setHovering] = useState(false);
  const [scrub, setScrub] = useState(false);

  /* ── Zoom-to-hold (feed only) — shared gesture from useZoomHold. Closing the
     lift pauses the clip. ──────────────────────────────────────────────────── */
  const { rootRef, screenRef, held, heldRect, closeHold, zoomGuard, rootStyle } = useZoomHold(
    zoomable,
    undefined,
    () => { if (playable) videoRef.current?.pause(); setPlaying(false); },
  );

  /* Imperative paint — fill width + caption word-lightup, no React re-render. */
  const paintCap = (text: string, prog: number) => {
    const el = captionRef.current; if (!el) return;
    if (el.getAttribute('data-cap') !== text) {
      el.setAttribute('data-cap', text);
      const ws = text ? text.split(' ') : [];
      el.innerHTML = ws.map((w, i) => `<span class="av-w" data-i="${i}">${w}${i < ws.length - 1 ? ' ' : ''}</span>`).join('');
      el.scrollLeft = 0;
    }
    const spans = el.children as any; const n = spans.length; if (!n) return;
    const said = Math.floor(Math.max(0, Math.min(1, prog)) * n);
    for (let i = 0; i < n; i++) spans[i].classList.toggle('said', i < said);
    const cur = spans[Math.min(n - 1, said)];
    if (cur) { const l = cur.offsetLeft, r = l + cur.offsetWidth; if (r > el.scrollLeft + el.clientWidth) el.scrollLeft = r - el.clientWidth; else if (l < el.scrollLeft) el.scrollLeft = l; }
    /* never show a partially clipped word — hide any word not fully inside the
       visible window, so a word only appears once the whole thing fits */
    const box = el.getBoundingClientRect();
    for (let i = 0; i < n; i++) { const wr = spans[i].getBoundingClientRect(); spans[i].style.visibility = (wr.left >= box.left - 0.5 && wr.right <= box.right + 0.5) ? '' : 'hidden'; }
  };
  const paint = () => {
    const d = durRef.current || 1;
    const f = Math.max(0, Math.min(1, curRef.current / d));
    if (fillRef.current) fillRef.current.style.width = f * 100 + '%';
    if (!captionRef.current) return;
    const t = curRef.current;
    /* poster / simulated clips carry their cues as data; a real clip reads its
       cues from its WebVTT track. Either way the active cue's words light
       grey→white across the cue's own span, one line, auto-scrolling. */
    if (captions && captions.length && !captionsSrc) {
      let idx = -1;
      for (let i = 0; i < captions.length; i++) { if (t >= captions[i].t) idx = i; else break; }
      if (idx < 0) { paintCap('', 0); return; }
      const start = captions[idx].t;
      const end = (idx + 1 < captions.length) ? captions[idx + 1].t : d;
      paintCap(captions[idx].s, end > start ? (t - start) / (end - start) : 1);
    } else if (captionsSrc && trackRef.current) {
      const cues = trackRef.current.cues; let cue: any = null;
      if (cues) for (let i = 0; i < cues.length; i++) { const c = cues[i] as any; if (t >= c.startTime && t < c.endTime) { cue = c; break; } }
      if (!cue) { paintCap('', 0); return; }
      paintCap(cue.text || '', cue.endTime > cue.startTime ? (t - cue.startTime) / (cue.endTime - cue.startTime) : 1);
    }
  };

  /* real video: honour mute live */
  useEffect(() => { const v = videoRef.current; if (v) { v.muted = muted; } }, [muted, playable]);

  /* real captions: read the video's WebVTT text track. mode='hidden' loads the
     cues and fires cuechange (so activeCues populate) WITHOUT the browser drawing
     its own overlay — we render the active cue ourselves, in the black. */
  useEffect(() => {
    const v = videoRef.current;
    if (!playable || !captionsSrc || !v) return;
    let track: TextTrack | null = null;
    let onCue: (() => void) | null = null;
    const attach = () => {
      track = (v.textTracks && v.textTracks[0]) || null;
      if (!track) return false;
      track.mode = 'hidden';
      trackRef.current = track;
      onCue = () => paint();
      track.addEventListener('cuechange', onCue);
      paint();
      return true;
    };
    if (attach()) return () => { if (track && onCue) track.removeEventListener('cuechange', onCue); };
    // textTracks can populate a beat after mount
    const id = window.setInterval(() => { if (attach()) window.clearInterval(id); }, 150);
    const stop = window.setTimeout(() => window.clearInterval(id), 3000);
    return () => { window.clearInterval(id); window.clearTimeout(stop); if (track && onCue) track.removeEventListener('cuechange', onCue); };
  }, [playable, captionsSrc, src]);

  /* poster mode: simulate the clock while playing (imperative paint per frame) */
  useEffect(() => {
    if (playable || !playing) return;
    lastRef.current = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      let next = curRef.current + dt;
      if (next >= durRef.current) next = 0;
      curRef.current = next;
      paint();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, playable]);

  /* real video: smooth per-frame paint while playing (fill + caption lightup) */
  useEffect(() => {
    if (!playable || !playing) return;
    let raf = 0;
    const loop = () => { const v = videoRef.current; if (v && !scrubbing.current) { curRef.current = v.currentTime; paint(); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable, playing]);

  const play = () => { userPaused.current = false; setPlaying(true); if (playable) videoRef.current?.play().catch(() => {}); };
  const pause = () => { userPaused.current = true; setPlaying(false); if (playable) videoRef.current?.pause(); };
  const toggle = () => { if (playing) pause(); else play(); };
  const toggleSound = (e: React.MouseEvent) => { e.stopPropagation(); setMuted((m) => !m); };

  /* ── Hairline scrub (paused-state control) ──────────────────────────────────
     Drag it and the clip seeks live so you see where you are. Seeks are
     coalesced: hold the latest target and only issue the next once the prior one
     lands, so the browser renders as many intermediate frames as it can keep up
     with instead of dropping them. The fill tracks the finger immediately. */
  const seekTarget = useRef<number | null>(null);
  const seekBusy = useRef(false);
  const flushSeek = () => {
    const v = videoRef.current;
    if (!v || seekTarget.current == null || seekBusy.current) return;
    seekBusy.current = true;
    const t = seekTarget.current; seekTarget.current = null;
    try { v.currentTime = t; } catch (_e) { seekBusy.current = false; }
  };
  const seekTo = (frac: number) => {
    const f = Math.max(0, Math.min(1, frac));
    curRef.current = f * durRef.current;
    if (fillRef.current) fillRef.current.style.width = f * 100 + '%';
    if (playable && videoRef.current && durRef.current) { seekTarget.current = curRef.current; flushSeek(); }
    else paint();
  };
  const scrubFromEvent = (clientX: number) => { const el = lineRef.current; if (!el) return; const r = el.getBoundingClientRect(); seekTo((clientX - r.left) / r.width); };
  const onTrackDown = (e: React.PointerEvent) => { e.stopPropagation(); e.preventDefault(); scrubbing.current = true; setScrub(true); try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch (_e) {} scrubFromEvent(e.clientX); };
  const onTrackMove = (e: React.PointerEvent) => { if (scrubbing.current) scrubFromEvent(e.clientX); };
  const onTrackUp = (e: React.PointerEvent) => { scrubbing.current = false; setScrub(false); e.stopPropagation(); };

  const frac0 = durRef.current ? curRef.current / durRef.current : 0;

  /* Popout starts playing straight away — the viewer already pressed play on the
     grid thumbnail, so treat the mount as a real play. */
  useEffect(() => {
    if (!startPlaying) return;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Autoplay — muted, looping, from the top. Real clips use the native autoPlay
     attribute (it survives the proactive blob reload); simulated posters flip the
     rAF clock on. Ambient: the clip runs on its own in the feed and composer
     draft exactly as it will once sent. */
  useEffect(() => {
    if (!autoplay || playable) return;
    setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable, autoplay]);

  const avNode = (
    <div
      ref={rootRef}
      className={'av' + (zoomable ? ' zoomable' : '') + (held ? ' held' : '') + (playing ? ' playing' : '') + (hovering ? ' hovering' : '') + (scrub ? ' scrubbing' : '') + ' cc-on'}
      style={rootStyle}
    >
      <div
        className="av-screen"
        ref={screenRef}
        style={playable ? undefined : { aspectRatio: `${w}/${h}` }}
        onClick={controls ? (e) => { if (zoomGuard.current) { e.stopPropagation(); return; } e.stopPropagation(); toggle(); } : undefined}
        onPointerEnter={controls ? () => setHovering(true) : undefined}
        onPointerLeave={controls ? () => setHovering(false) : undefined}
      >
        {!hasSrc ? (
          <div className="img-ph" data-label={label || ''} />
        ) : playable ? (
          <video
            ref={videoRef} className="av-footage" src={videoSrc} muted={muted} playsInline preload="auto" loop={autoplay}
            disablePictureInPicture
            onCanPlay={(e) => { if (autoplay && !userPaused.current) { const v = e.target as HTMLVideoElement; v.muted = true; v.play().then(() => setPlaying(true)).catch(() => {}); } }}
            onLoadedMetadata={(e) => { const v = e.target as HTMLVideoElement; try { v.setAttribute('webkit-playsinline', 'true'); } catch (_e) {} const d = v.duration; if (d && isFinite(d)) { durRef.current = d; } try { if (v.paused && !v.currentTime) v.currentTime = 0.05; } catch (_e) {} paint(); }}
            onLoadedData={(e) => { const v = e.target as HTMLVideoElement; if (playing) return; try { if (v.paused && v.currentTime < 0.02) v.currentTime = 0.05; } catch (_e) {} }}
            onTimeUpdate={(e) => { if (!scrubbing.current) { curRef.current = (e.target as HTMLVideoElement).currentTime; paint(); } }}
            onSeeked={() => { seekBusy.current = false; paint(); flushSeek(); }}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onEnded={() => { setPlaying(false); curRef.current = 0; paint(); }}
            onError={recoverViaBlob}
          >
            {captionsSrc ? <track kind="captions" src={captionsSrc} srcLang="en" label="captions" /> : null}
          </video>
        ) : IMG_EXT.test(src || '') ? (
          <img className="av-footage" src={src} alt={label || ''} draggable={false} />
        ) : (
          <div className="av-footage av-sim" aria-hidden="true" />
        )}

        {controls ? (
          <>
            <div className="av-controls av-reveal">
              <button className={'av-ctrl av-sound' + (muted ? ' off' : '')} onClick={toggleSound} aria-label={muted ? 'turn sound on' : 'turn sound off'}>
                <svg className="av-sound-ic" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {muted ? (
                    <>
                      <defs>
                        <mask id={maskId}>
                          <rect width="24" height="24" fill="#fff" />
                          <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" stroke="#000" strokeWidth="3.2" />
                        </mask>
                      </defs>
                      <g mask={`url(#${maskId})`}>
                        <path d="M4 8.5 H9 L15 3.5 V20.5 L9 15.5 H4 Z" fill="currentColor" />
                      </g>
                      <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </>
                  ) : (
                    <path d="M4 8.5 H9 L15 3.5 V20.5 L9 15.5 H4 Z" fill="currentColor" />
                  )}
                </svg>
              </button>
            </div>
            <div className="av-track" onPointerDown={onTrackDown} onPointerMove={onTrackMove} onPointerUp={onTrackUp}>
              <div className="av-line" ref={lineRef}><div className="av-fill" ref={fillRef} style={{ width: frac0 * 100 + '%' }} /></div>
            </div>
          </>
        ) : null}
      </div>
      {controls && (captionsSrc || (captions && captions.length)) ? (
        <div className="av-cap" ref={captionRef} />
      ) : null}
    </div>
  );

  /* Lifted: the clip grows in place via a CSS transform (useZoomHold). A keyed
     sibling backdrop catches the outside tap; keyed so React never remounts the
     <video> when the siblings appear/disappear. */
  return (
    <React.Fragment>
      {held && heldRect ? <div key="ph" className="av-placeholder" style={{ width: heldRect.width, height: heldRect.height }} aria-hidden="true" /> : null}
      {held ? <div key="bd" className="av-zoom-backdrop" onClick={closeHold} /> : null}
      {React.cloneElement(avNode, { key: 'av' })}
    </React.Fragment>
  );
}
