/* ───────────────────────────────────────────────────────────────────────────
   P2POnboarding — friend-invite onboarding (Orbit).

   A friend (the inviter) drops you a note, Alia vouches for them and asks for
   your name · bday · email · number + a photo. You fill the `p2p-onboarding`
   composer — the photo button inserts an inline circular avatar-crop atom
   (handled natively by the engine via avatarPicker). Send gates on a photo +
   name + 21+ birthday + email/phone. Under-21 is rejected with the date you'd
   qualify and a "that's not my birthday" recovery row.

   Reuses: AliaComposer (p2p-onboarding mode) · ChatMessage / TypingIndicator
   (friend variant) · shared onboarding styles. Conversation layout, no nav.
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
const SENDER = { name: 'Noa Lindqvist', img: img('alia accidental turned-head selfie face.png') };
const NOTE = 'okay you HAVE to see this. it\u2019s the thing i kept being weird about \u2014 i used one of my invites on you. don\u2019t make me regret it.';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const alia = (rest: Partial<ChatEntry>): ChatEntry => ({ id: nextId('a'), who: 'alia', name: 'Alia', img: ALIA, entering: true, ...rest });


/** "enter alia" one-click login card. */
function LoginCard() {
  const [done, setDone] = useState(false);
  return (
    <div className="block gap-diff">
      <div className="login-card">
        <button className="login-btn" disabled={done} onClick={() => setDone(true)}>
          enter alia
        </button>
      </div>
    </div>
  );
}

export default function P2POnboarding() {
  const [feed, setFeed] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const [dock, setDock] = useState<'composer' | 'under21' | 'done'>('composer');
  const feedRef = useRef<HTMLDivElement>(null);

  const push = (e: ChatEntry) => setFeed((f) => [...f, e]);
  const scrollDown = () => requestAnimationFrame(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; });
  useEffect(() => { scrollDown(); }, [feed, typing]);

  const aliaSay = async (entry: Partial<ChatEntry>, delay = 1100) => {
    setTyping(true); scrollDown();
    await wait(delay);
    setTyping(false);
    push(alia(entry));
    scrollDown();
  };

  /* Intro */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await wait(420); if (cancelled) return;
      push({ id: nextId('f'), who: 'them', name: SENDER.name, img: SENDER.img, entering: true, blocks: [{ type: 'text', text: NOTE }] });
      scrollDown();
      await wait(900); if (cancelled) return;
      await aliaSay({ blocks: [{ type: 'text', text: `${SENDER.name.split(' ')[0]} pulled you in. she doesn\u2019t do that for everyone.` }] }, 1200);
      if (cancelled) return;
      await aliaSay({ blocks: [{ type: 'text', text: 'i need your name, bday, email, and number. add a pic of you and hit send.' }] }, 1100);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSend = (items: ComposerItem[]): boolean => {
    const d = detectOnboarding(items);
    const photoCount = items.filter((i) => i.type === 'photo').length;

    // under-21 rejection fires first
    if (d.bday && d.under21) {
      const line = d.bdayDate
        ? `you have to be 21 to get inside. come back on ${format21(d.bdayDate)}.`
        : 'alia\u2019s 21 and over \u2014 every room, no exceptions. come find me when the timing\u2019s right. i\u2019ll remember you.';
      push({ id: nextId('me'), who: 'me', blocks: itemsToBlocks(items), entering: true });
      setDock('under21');
      (async () => { await wait(300); await aliaSay({ blocks: [{ type: 'text', text: line }] }, 1000); })();
      return true;
    }

    // gate — all fields required
    if (!(d.name && d.bday && (d.email || d.phone) && photoCount >= 1)) return false;

    push({ id: nextId('me'), who: 'me', blocks: itemsToBlocks(items), entering: true });
    setDock('done');
    (async () => {
      await wait(700);
      const first = d.firstName || 'you';
      await aliaSay({
        body: (
          <>
            <div className="block"><p className="text">you&rsquo;re in, {first}. one tap.</p></div>
            <LoginCard />
          </>
        ),
      }, 1100);
    })();
    return true;
  };

  return (
    <div className="app-root" id="p2p-onboarding">
      <div className="screen">
        <div className="feed" ref={feedRef}>
          {feed.map((e) => <ChatMessage key={e.id} entry={e} />)}
          {typing ? <TypingIndicator /> : null}
        </div>
      </div>

      {dock === 'composer' ? (
        <div className="composer-dock">
          <AliaComposer mode="p2p-onboarding" onSend={handleSend} />
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
