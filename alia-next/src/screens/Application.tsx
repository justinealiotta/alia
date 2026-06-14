/* ───────────────────────────────────────────────────────────────────────────
   Application — Alia casting application flow.

   A conversational submission screen: Alia opens with the casting call and the
   checklist, the applicant composes a single message (name · bday · ig · tiktok
   · email · number · 5 pics · voice note) in the `application`-mode composer,
   and on a complete submission Alia replies "👀". Incomplete sends shake the
   composer and keep the draft.

   Reuses: AliaComposer (application mode) · shared ChatMessage / TypingRow
   (which render bodies through MessageBlock → AliaVoice) · utils.itemsToBlocks.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import { img } from './../data';
import type { ComposerItem } from './../types';
import { itemsToBlocks, nextId } from './../utils';
import { ChatMessage, ChatEntry } from './../shared/chat';
import TypingIndicator from './../TypingIndicator';
import AliaComposer from './../AliaComposer';

const ALIA_IMG = img('alia avatar.png');
const MIN_PHOTOS = 5;
const VOICE_TRANSCRIPT =
  'hey alia \u2014 saw you\u2019re casting and i had to throw my name in. i promise i\u2019m the energy you want in the room.';

/* ── Detection ───────────────────────────────────────────────────────────── */
interface Detected { name: boolean; ig: boolean; tt: boolean; email: boolean; phone: boolean; bday: boolean; under21: boolean; age: number | null; }

function parseBdayDate(text: string): Date | null {
  let m: RegExpMatchArray | null;
  m = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})\b/);
  if (m) { const yr = +m[3] + (+m[3] < 30 ? 2000 : 1900); return new Date(yr, +m[1] - 1, +m[2]); }
  m = text.match(/\b(19[0-9]{2}|200[0-9])\b/);
  if (m) return new Date(+m[1], 5, 1);
  m = text.match(/\b(\d{2})(\d{2})(\d{4})\b/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = text.match(/\b(\d{2})(\d{2})(\d{2})\b/);
  if (m) { const yr = +m[3] + (+m[3] < 30 ? 2000 : 1900); return new Date(yr, +m[1] - 1, +m[2]); }
  const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+(\d{1,2})(?:[,\s]+(\d{4}|\d{2}))?\b/i);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    let yr = m[3] ? +m[3] : new Date().getFullYear() - 22;
    if (yr < 100) yr += yr < 30 ? 2000 : 1900;
    return new Date(yr, mo, +m[2]);
  }
  return null;
}
function calcAge(birthDate: Date | null): number | null {
  if (!birthDate || isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const moOff = now.getMonth() - birthDate.getMonth();
  if (moOff < 0 || (moOff === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}
function detect(items: ComposerItem[]): Detected {
  const text = items.filter((i) => i.type === 'text').map((i: any) => i.text).join('  ');
  const links = items.filter((i) => i.type === 'linkref') as any[];
  const handles = text.match(/@[\w.]+/g) || [];
  const stripped = text.replace(/@[\w.]+/g, '').replace(/https?:\/\/\S+/g, '').trim();
  const name = /[a-z]{2,}/i.test(stripped);
  const ig = links.some((l) => l.platform === 'instagram') || /\big\b|instagram|insta\b/i.test(text) || handles.length >= 1;
  const tt = links.some((l) => l.platform === 'tiktok') || /tiktok|\btt\b/i.test(text) || handles.length >= 2;
  const email = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(text);
  const phone = /\d{10,}/.test(text.replace(/[\s\-()+.]/g, ''));
  const bday =
    /\b(19[0-9]{2}|200[0-5])\b/.test(text) ||
    /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2}\b/.test(text) ||
    /\b\d{6}\b/.test(text) || /\b\d{8}\b/.test(text) ||
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+\d{1,2}/i.test(text);
  const age = calcAge(parseBdayDate(text));
  return { name, ig, tt, email, phone, bday, under21: age !== null && age < 21, age };
}
function gateOk(items: ComposerItem[], d: Detected): boolean {
  const pc = items.filter((i) => i.type === 'photo').length;
  const hv = items.some((i) => i.type === 'voice');
  return !!(d.name && d.bday && (d.email || d.phone) && pc >= MIN_PHOTOS && hv);
}

/* ── Intro script ────────────────────────────────────────────────────────── */
const aliaEntry = (text: string, continued = false): ChatEntry => ({
  id: nextId('a'), who: 'alia', name: 'Alia', img: ALIA_IMG, continued, entering: true,
  blocks: [{ type: 'text', text }],
});

export default function Application() {
  const [feed, setFeed] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);

  const push = (entry: ChatEntry) => setFeed((f) => [...f, entry]);
  const scrollDown = () => requestAnimationFrame(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; });

  /* Intro: typing → msg1 → typing → msg2 */
  useEffect(() => {
    const timers: number[] = [];
    const t = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    setTyping(true); scrollDown();
    t(() => {
      setTyping(false);
      push(aliaEntry("okay, i'm casting rn. fashion divas to the front. immaculate taste only.")); scrollDown();
      t(() => {
        setTyping(true); scrollDown();
        t(() => {
          setTyping(false);
          push(aliaEntry('i need: your name, bday, ig, tiktok, email, number, 5 pics, and a voice message. then hit send.')); scrollDown();
        }, 1400);
      }, 700);
    }, 1500);
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => { scrollDown(); }, [feed, typing]);

  const shake = () => {
    const w = composerWrapRef.current?.querySelector('.composer-wrap');
    if (!w) return;
    w.classList.remove('shake');
    void (w as HTMLElement).offsetHeight;
    w.classList.add('shake');
    w.addEventListener('animationend', () => w.classList.remove('shake'), { once: true });
  };

  const handleSend = (items: ComposerItem[]): boolean => {
    const d = detect(items);
    if (!gateOk(items, d)) { shake(); return false; } // keep draft
    const blocks = itemsToBlocks(items);
    push({ id: nextId('me'), who: 'me', blocks, entering: true });
    scrollDown();
    // Alia acknowledges
    window.setTimeout(() => {
      setTyping(true); scrollDown();
      window.setTimeout(() => {
        setTyping(false);
        push({ id: nextId('a'), who: 'alia', name: 'Alia', img: ALIA_IMG, entering: true, blocks: [{ type: 'text', text: '\uD83D\uDC40' }] });
        scrollDown();
      }, 2600);
    }, 1400);
    return true; // reset composer
  };

  return (
    <div className="app-root" id="application">
      <div className="screen">
        <div className="feed" ref={feedRef}>
          {feed.map((e) => <ChatMessage key={e.id} entry={e} />)}
          {typing ? <TypingIndicator /> : null}
        </div>
      </div>

      <div ref={composerWrapRef}>
        <AliaComposer mode="application" onSend={handleSend} voiceTranscript={VOICE_TRANSCRIPT} />
      </div>
    </div>
  );
}
