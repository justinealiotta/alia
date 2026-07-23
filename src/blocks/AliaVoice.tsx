/* ───────────────────────────────────────────────────────────────────────────
   AliaVoice — the ONE voice block: record · play · transcript · karaoke.

   Two ways to use the same block:
     • Playback  — pass { duration, transcript, src?, progress? }: play / pause,
                   animated waveform fill, word-by-word karaoke transcript.
                   (src → real <audio>; otherwise the mock take drives timing.)
     • Recordable — pass `recordable`: with no take yet it shows a quiet trigger,
                   captures on tap (mic + live speech-to-text, sim fallback),
                   then plays the take back; tapping the card (off play) removes
                   it. `onCommit`/`onRemove` report state to the host. The trigger
                   and card wrappers take per-surface classes so each page keeps
                   its exact look (referral note vs apply card).

   DOM + classNames match voice.css exactly (.voice / .voice-row / .play-btn /
   .wave / .dur / .transcript). Recording delegates to the shared recorder
   surface (.cc-recbar / .rec-live). A page only ever imports AliaVoice.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../icons';
import { AMP, barCountForDuration, fmt, createTranscriber } from '../data';

/* ── AliaVoiceRecorder — the capture half, folded in ────────────────────────
   The recording surface used to live in its own file (AliaRecorder). It is now
   part of AliaVoice: playback and capture are one block. Surfaces that need a
   bare recorder import this named export; most just pass `recordable` and let
   AliaVoice mount it. Self-contained — recording starts on mount and it owns
   the building waveform, elapsed timer, pause / resume, live speech-to-text,
   and real microphone capture (simulated fallback when the mic is
   unavailable), reporting out with exactly two callbacks:
     onComplete({ duration, transcript, src })   ← "stop" pressed
     onCancel()                                  ← tapped off the controls
   Pass `className` to size it for a given surface. */

const REC_NBARS = 22;

export interface RecorderResult { duration: number; transcript: string; src?: string; }

interface RecorderProps {
  onComplete: (r: RecorderResult) => void;
  onCancel: () => void;
  /** extra class on the bar, for per-surface sizing (e.g. "ref-rec") */
  className?: string;
}

export function AliaVoiceRecorder({ onComplete, onCancel, className }: RecorderProps) {
  /* Ambient recorder — no waveform: recording looks like the message writing
     itself. Live speech-to-text streams the words in white with a trailing caret;
     `pause`/`record` lets you stop for a breath and continue the next thought;
     `done` (blinking) settles it into the greyed transcript player. No timer. */
  const [mode, setMode] = useState<'recording' | 'paused'>('recording');
  const [text, setText] = useState('');

  const elapsed = useRef(0);           // internal only (drives playback duration), never shown
  const timer = useRef<number | null>(null);
  const stt = useRef(createTranscriber('en-US', (t) => setText(t))).current;
  const mediaRec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const releaseMic = () => { try { stream.current?.getTracks().forEach((t) => t.stop()); } catch (_e) {} stream.current = null; };
  const startTick = () => { timer.current = window.setInterval(() => { elapsed.current += 1; }, 1000); };
  const stopTick = () => { if (timer.current) window.clearInterval(timer.current); timer.current = null; };

  /* start capture on mount; clean up on unmount */
  useEffect(() => {
    let cancelled = false;
    startTick(); stt.reset(); stt.start();
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s; chunks.current = [];
        const mr = new MediaRecorder(s);
        mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
        mediaRec.current = mr; mr.start();
      } catch (_e) { mediaRec.current = null; releaseMic(); }
    })();
    return () => { cancelled = true; stopTick(); stt.pause(); releaseMic(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = () => {
    if (mode === 'recording') {
      setMode('paused'); stopTick(); stt.pause();
      try { if (mediaRec.current?.state === 'recording') mediaRec.current.pause(); } catch (_e) {}
    } else {
      setMode('recording'); startTick(); stt.start();
      try { if (mediaRec.current?.state === 'paused') mediaRec.current.resume(); } catch (_e) {}
    }
  };

  const done = () => {
    stopTick();
    const dur = Math.max(2, elapsed.current);
    const transcript = stt.finish();
    const mr = mediaRec.current;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
        releaseMic(); mediaRec.current = null;
        if (!transcript && !blob.size) { onCancel(); return; }   // nothing captured → bail
        onComplete({ duration: dur, transcript, src: URL.createObjectURL(blob) });
      };
      try { mr.stop(); }
      catch (_e) { releaseMic(); mediaRec.current = null; if (!transcript) onCancel(); else onComplete({ duration: dur, transcript }); }
      return;
    }
    if (!transcript) { onCancel(); return; }
    onComplete({ duration: dur, transcript });   // simulated fallback (no mic)
  };

  return (
    <div className={'av-rec' + (mode === 'paused' ? ' paused' : '') + (className ? ' ' + className : '')}>
      <p className="av-rec-tr">
        <span className="w said">{text}</span>
        <span className="av-rec-caret" />
      </p>
      <div className="av-rec-row">
        <span className="av-rec-space" />
        <button className="av-rec-btn" onClick={togglePause}>{mode === 'recording' ? 'pause' : 'record'}</button>
        <button className="av-rec-btn av-rec-done" onClick={done}>done</button>
      </div>
    </div>
  );
}

/** Split a transcript into word / whitespace tokens (whitespace preserved). */
function tokenize(text: string): Array<{ word: boolean; text: string }> {
  return String(text ?? '')
    .split(/(\s+)/)
    .filter((t) => t !== '')
    .map((t) => ({ word: !/^\s+$/.test(t), text: t }));
}

/** Per-word start times (ms), weighted by letter/number count. */
function buildStops(words: string[], durMs: number): number[] {
  const weights = words.map((w) => {
    const letters = (w.match(/[\p{L}\p{N}]/gu) || []).length;
    return Math.max(1, letters) + 1.6;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const stops: number[] = [];
  for (const w of weights) {
    stops.push((acc / total) * durMs);
    acc += w;
  }
  return stops;
}

interface PlayerProps {
  duration: number;
  transcript?: string;
  src?: string;
  progress?: number;
  onPlay?: () => void;
}

/* ── The player core — ambient voice: transcript only ──────────────────────────
   No waveform, no play button, no duration, no speed — per Alia's language. The
   greyed transcript IS the control: tap it to play / pause, and each word lights
   grey→white in sync. Tap any word to jump the playhead there. The transcript
   caps at ~3 lines and scrolls (no visible scrollbar), auto-following the spoken
   word while it plays. */
function VoicePlayer({ duration, transcript, src, progress = 0, onPlay }: PlayerProps) {
  const isReal = !!src;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioDur, setAudioDur] = useState(duration);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(progress * duration * 1000);
  const trRef = useRef<HTMLParagraphElement | null>(null);

  const effDur = isReal ? audioDur : duration;
  const tokens = useMemo(() => tokenize(transcript ?? ''), [transcript]);
  const words = useMemo(() => tokens.filter((t) => t.word).map((t) => t.text), [tokens]);
  const durMs = Math.max(isReal ? 200 : 1200, (effDur || 6) * 1000);
  const stops = useMemo(() => buildStops(words, durMs), [words, durMs]);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!isReal) return;
    const a = audioRef.current; if (!a) return;
    const onTime = () => setElapsed(a.currentTime * 1000);
    const onMeta = () => { if (isFinite(a.duration) && a.duration > 0) setAudioDur(a.duration); };
    const onEnd = () => { setPlaying(false); setElapsed(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('loadedmetadata', onMeta); a.removeEventListener('ended', onEnd); };
  }, [isReal, src]);

  useEffect(() => {
    if (!playing || isReal) return;
    lastRef.current = performance.now();
    const step = (now: number) => {
      setElapsed((prev) => {
        const next = prev + Math.min(now - lastRef.current, 120);
        lastRef.current = now;
        if (next >= durMs) { setPlaying(false); return 0; }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, durMs]);

  const toggle = () => {
    if (isReal) {
      const a = audioRef.current; if (!a) return;
      if (a.paused) { if (a.ended) a.currentTime = 0; a.play().then(() => { onPlay?.(); setPlaying(true); }).catch(() => {}); }
      else { a.pause(); setPlaying(false); }
      return;
    }
    if (!playing) {
      if (elapsed >= durMs) setElapsed(0);
      onPlay?.();
    }
    setPlaying((p) => !p);
  };

  const seekWord = (idx: number) => {
    const ms = stops[idx] ?? 0;
    setElapsed(ms);
    if (isReal && audioRef.current) { try { audioRef.current.currentTime = ms / 1000; } catch (_e) {} }
  };

  let active = -1;
  for (let i = 0; i < stops.length; i++) { if (elapsed >= stops[i]) active = i; else break; }

  /* keep the spoken word in view as it plays (one-line-at-a-time follow) */
  useEffect(() => {
    const tr = trRef.current; if (!tr) return;
    const el = tr.querySelector(`[data-i="${active}"]`) as HTMLElement | null;
    if (!el) return;
    const top = el.offsetTop, bot = top + el.offsetHeight;
    if (bot > tr.scrollTop + tr.clientHeight) tr.scrollTop = bot - tr.clientHeight;
    else if (top < tr.scrollTop) tr.scrollTop = top;
  }, [active]);

  const hasText = !!(transcript && transcript.trim());

  return (
    <div className={`voice${playing ? ' playing' : ''}`} data-dur={effDur}>
      {isReal ? <audio ref={audioRef} src={src} preload="metadata" /> : null}
      <p className="transcript am-tr" ref={trRef} onClick={toggle}>
        {hasText ? words.map((word, idx) => (
          <span
            key={idx} data-i={idx}
            className={'w' + (idx <= active ? ' said' : '')}
            onClick={(e) => { e.stopPropagation(); seekWord(idx); }}
          >
            {idx < words.length - 1 ? word + ' ' : word}
          </span>
        )) : <span className={'w' + (playing ? ' said' : '')}>voice message</span>}
      </p>
    </div>
  );
}

export interface AliaVoiceProps extends Omit<PlayerProps, 'duration'> {
  /** Playback length. Required for the pure player; unused in `recordable`
   *  mode, where the length comes from the captured take. */
  duration?: number;
  /** Enable the record → play → remove lifecycle (composing surfaces). */
  recordable?: boolean;
  /** A take already captured (controlled): shows the player, removable. */
  value?: RecorderResult | null;
  /** Fired when a take is captured. */
  onCommit?: (r: RecorderResult) => void;
  /** Fired when the committed take is removed (tap the card off play). */
  onRemove?: () => void;
  /** Start armed in the recorder (host swapped straight to voice). */
  startRecording?: boolean;
  /** Fired when an armed recording is cancelled with nothing captured. */
  onCancelRecording?: () => void;
  /** Per-surface classes so each page keeps its exact look. */
  triggerClassName?: string;
  triggerLabel?: string;
  wrapClassName?: string;
  recorderClassName?: string;
}

/* ── Public voice block ────────────────────────────────────────────────────── */
export default function AliaVoice(props: AliaVoiceProps) {
  const {
    recordable, value, onCommit, onRemove, startRecording, onCancelRecording,
    triggerClassName = 'cc-tool', triggerLabel = 'voice', wrapClassName, recorderClassName,
    duration = 0, ...player
  } = props;

  // Uncontrolled record lifecycle (only when `recordable` and not value-controlled).
  const [take, setTake] = useState<RecorderResult | null>(value ?? null);
  const [recording, setRecording] = useState(!!startRecording);
  useEffect(() => { if (value !== undefined) setTake(value); }, [value]);

  if (!recordable) return <VoicePlayer duration={duration} {...player} />;

  const committed = value !== undefined ? value : take;

  if (committed) {
    const remove = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.play-btn')) return;
      if (value === undefined) setTake(null);
      onRemove?.();
    };
    return (
      <div className={wrapClassName} onClick={wrapClassName ? remove : undefined}>
        <VoicePlayer duration={committed.duration} transcript={committed.transcript} src={committed.src} />
      </div>
    );
  }

  if (recording) {
    const rec = (
      <AliaVoiceRecorder
        className={recorderClassName}
        onComplete={(r) => { if (value === undefined) setTake(r); setRecording(false); onCommit?.(r); }}
        onCancel={() => { setRecording(false); onCancelRecording?.(); }}
      />
    );
    return wrapClassName ? <div className={wrapClassName}>{rec}</div> : rec;
  }

  return (
    <button className={triggerClassName} onClick={() => setRecording(true)}>{triggerLabel}</button>
  );
}
