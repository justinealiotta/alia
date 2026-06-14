/* ───────────────────────────────────────────────────────────────────────────
   AliaVoice — voice message card
   Play / pause · animated waveform fill · word-by-word karaoke transcript.

   The karaoke timing is the React port of voice-karaoke.js: each word gets a
   start-time slice weighted by its letter count, and the highlight advances
   word-by-word against the take's known duration (these mocks carry no audio).

   DOM + classNames match voice.css exactly (.voice / .voice-row / .play-btn /
   .wave / .dur / .transcript / .w.spoken / .w.active), so it themes for free.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { AMP, barCountForDuration, fmt } from './data';

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

export interface AliaVoiceProps {
  duration: number;
  transcript?: string;
  /** Initial fill (0–1) shown before first play — matches the seed feed. */
  progress?: number;
  /** Fired the first time the user starts playback (orbit interaction hook). */
  onPlay?: () => void;
}

export default function AliaVoice({ duration, transcript, progress = 0, onPlay }: AliaVoiceProps) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(progress * duration * 1000);

  const tokens = useMemo(() => tokenize(transcript ?? ''), [transcript]);
  const words = useMemo(() => tokens.filter((t) => t.word).map((t) => t.text), [tokens]);
  const durMs = Math.max(1200, (duration || 6) * 1000);
  const stops = useMemo(() => buildStops(words, durMs), [words, durMs]);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  // rAF playback loop — advances `elapsed`, loops state back to play at the end.
  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const step = (now: number) => {
      setElapsed((prev) => {
        const next = prev + Math.min(now - lastRef.current, 120);
        lastRef.current = now;
        if (next >= durMs) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, durMs]);

  const toggle = () => {
    if (!playing) {
      if (elapsed >= durMs) setElapsed(0);
      onPlay?.();
    }
    setPlaying((p) => !p);
  };

  // Active word index (last stop we've passed).
  let active = -1;
  for (let i = 0; i < stops.length; i++) {
    if (elapsed >= stops[i]) active = i;
    else break;
  }

  // Waveform: animated fill while playing, static seed fill otherwise.
  const count = barCountForDuration(duration);
  const fill = playing ? elapsed / durMs : progress;
  const cutoff = Math.floor(count * Math.min(1, fill));

  let wordIdx = -1;

  return (
    <div className={`voice${playing ? ' playing' : ''}`} data-dur={duration}>
      <div className="voice-row">
        <button className="play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <div className="wave">
          {Array.from({ length: count }, (_, i) => (
            <i
              key={i}
              className={i < cutoff ? 'on' : undefined}
              style={{ '--h': AMP[i % AMP.length], '--d': `${(i * 53) % 1100}ms` } as React.CSSProperties}
            />
          ))}
        </div>
        <span className="dur">{fmt(duration)}</span>
      </div>
      {transcript ? (
        <p className="transcript">
          {tokens.map((t, i) => {
            if (!t.word) return <React.Fragment key={i}>{t.text}</React.Fragment>;
            wordIdx += 1;
            const idx = wordIdx;
            const cls =
              idx < active ? 'w spoken' : idx === active ? 'w active' : 'w';
            return (
              <span key={i} className={cls}>
                {t.text}
              </span>
            );
          })}
        </p>
      ) : null}
    </div>
  );
}
