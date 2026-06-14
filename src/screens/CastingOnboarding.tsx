/* ───────────────────────────────────────────────────────────────────────────
   CastingOnboarding — accepted-into-casting onboarding.

   Alia has already pre-pulled a profile (name · bday · email · avatar) and
   shows it back as a card, asking you to confirm. Two acceptance paths:
     • the yes / fix-it confirm row (when nothing's missing), or
     • editing/completing the `casting-onboarding` composer and sending.
   Same 21+ gate + under-21 rejection as P2P Onboarding. On accept: "perfect."
   + the one-click enter-alia login card.

   Reuses: AliaComposer (casting-onboarding mode, avatar-crop) · ChatMessage /
   TypingIndicator · shared onboarding styles + the shared date/age/detect helpers.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import { img } from './../data';
import type { ComposerItem } from './../types';
import { itemsToBlocks, nextId } from './../utils';
import { ChatMessage, ChatEntry } from './../shared/chat';
import TypingIndicator from './../TypingIndicator';
import { Icon } from './../icons';
import AliaComposer from './../AliaComposer';
import { detectOnboarding, format21 } from './../shared/onboarding';

const ALIA = img('alia avatar.png');
const SAMPLE_PHOTO = img('alia front-facing face selfie.png');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const alia = (rest: Partial<ChatEntry>): ChatEntry => ({ id: nextId('a'), who: 'alia', name: 'Alia', img: ALIA, entering: true, ...rest });

/* Pre-pulled profile Alia already has on file. */
const PLACEHOLDER = {
  name: 'Justine Aliotta',
  bdayStr: 'April 13, 1987',
  email: 'justine@alia.club',
  phone: '',
  avatarSrc: SAMPLE_PHOTO,
};
function getMissing(): string[] {
  const m: string[] = [];
  if (!PLACEHOLDER.avatarSrc) m.push('pic');
  if (!PLACEHOLDER.bdayStr) m.push('bday');
  if (!PLACEHOLDER.email && !PLACEHOLDER.phone) m.push('email or number');
  return m;
}
function secondMessage(): string {
  const m = getMissing();
  if (!m.length) return 'looks good? swap anything you want and hit send.';
  const list = m.length === 1 ? m[0] : m.slice(0, -1).join(', ') + ' and ' + m[m.length - 1];
  return `almost there. i still need your ${list} \u2014 add ${m.length > 1 ? 'them' : 'it'} and hit send.`;
}

/** The pre-pulled profile card. */
function ProfileCard() {
  const contact = PLACEHOLDER.email || PLACEHOLDER.phone || '';
  const lines = [PLACEHOLDER.name, PLACEHOLDER.bdayStr, contact].filter(Boolean);
  return (
    <div className="block gap-diff">
      <div className="prof-card">
        <div className="msg-avatar">{PLACEHOLDER.avatarSrc ? <img src={PLACEHOLDER.avatarSrc} alt="" /> : null}</div>
        <div style={{ height: 14 }} />
        {lines.map((l, i) => <p className="text" key={i}>{l}</p>)}
      </div>
    </div>
  );
}

/** One-click "enter alia" login card. */
function LoginCard() {
  const [done, setDone] = useState(false);
  return (
    <div className="block gap-diff">
      <div className="login-card">
        <button className="login-btn" disabled={done} onClick={() => setDone(true)}>enter alia</button>
      </div>
    </div>
  );
}

export default function CastingOnboarding() {
  const [feed, setFeed] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const [dock, setDock] = useState<'composer' | 'under21' | 'done'>('composer');
  const feedRef = useRef<HTMLDivElement>(null);

  const push = (e: ChatEntry) => setFeed((f) => [...f, e]);
  const scrollDown = () => requestAnimationFrame(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; });
  useEffect(() => { scrollDown(); }, [feed, typing]);

  const aliaSay = async (entry: Partial<ChatEntry>, delay = 1000) => {
    setTyping(true); scrollDown();
    await wait(delay);
    setTyping(false);
    push(alia(entry));
    scrollDown();
  };

  /* Intro: profile card + completeness prompt */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await wait(420); if (cancelled) return;
      await aliaSay({ body: (<><div className="block"><p className="text">you&rsquo;re cast. here&rsquo;s what i have on you.</p></div><ProfileCard /></>) }, 900);
      if (cancelled) return;
      await aliaSay({ blocks: [{ type: 'text', text: secondMessage() }] }, 1000);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = () => {
    setDock('done');
    (async () => {
      await wait(300);
      await aliaSay({ body: (<><div className="block"><p className="text">perfect.</p></div><LoginCard /></>) }, 700);
    })();
  };

  const handleSend = (items: ComposerItem[]): boolean => {
    const d = detectOnboarding(items);
    const photoCount = items.filter((i) => i.type === 'photo').length;

    if (d.bday && d.under21) {
      const line = d.bdayDate
        ? `you have to be 21 to get inside. come back on ${format21(d.bdayDate)}.`
        : 'alia\u2019s 21 and over \u2014 every room, no exceptions. come find me when the timing\u2019s right. i\u2019ll remember you.';
      push({ id: nextId('me'), who: 'me', blocks: itemsToBlocks(items), entering: true });
      setDock('under21');
      (async () => { await wait(300); await aliaSay({ blocks: [{ type: 'text', text: line }] }, 1000); })();
      return true;
    }

    if (!(d.name && d.bday && (d.email || d.phone) && photoCount >= 1)) return false;

    push({ id: nextId('me'), who: 'me', blocks: itemsToBlocks(items), entering: true });
    accept();
    return true;
  };

  return (
    <div className="app-root" id="casting-onboarding">
      <div className="screen">
        <div className="feed" ref={feedRef}>
          {feed.map((e) => <ChatMessage key={e.id} entry={e} />)}
          {typing ? <TypingIndicator /> : null}
        </div>
      </div>

      {dock === 'composer' ? (
        <div className="composer-dock">
          <AliaComposer mode="casting-onboarding" onSend={handleSend} />
        </div>
      ) : dock === 'under21' ? (
        <div className="soft-row">
          <button onClick={() => setDock('composer')}>
            <Icon name="restart" size={15} /> that&rsquo;s not my birthday
          </button>
        </div>
      ) : null}
    </div>
  );
}
