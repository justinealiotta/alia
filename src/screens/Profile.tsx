/* ───────────────────────────────────────────────────────────────────────────
   Profile — the member's own profile / account screen.

   An Alia-led conversation: she greets, offers options (update profile · log out
   · leave alia), and reflects your details back when you choose "update". You DM
   changes through the `profile`-mode composer; Alia confirms. The hidden bottom
   nav (Profile active) links out to Discover (Referral) and Alia (Room).

   Reuses: AliaComposer (profile mode) · shared ChatMessage / TypingIndicator with
   quick-reply actions · AliaBottomNav. Layout = conversation variant (messages
   from the top, typing pinned to the bottom, inline composer).
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import { img } from './../data';
import type { ComposerItem } from './../types';
import { itemsToBlocks, nextId } from './../utils';
import { ChatMessage, ChatEntry } from './../shared/chat';
import TypingIndicator from './../TypingIndicator';
import AliaComposer from './../AliaComposer';
import AliaBottomNav from './../AliaBottomNav';

const ALIA = img('alia avatar.png');
const ME_SHOT = img('alia front-facing face selfie.png');
const PROFILE = { name: 'Justine Aliotta', bday: 'April 13, 1987', email: 'justine@alia.club', phone: '+1 (310) 000-0000' };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const alia = (rest: Partial<ChatEntry>): ChatEntry => ({ id: nextId('a'), who: 'alia', name: 'Alia', img: ALIA, entering: true, ...rest });

export default function Profile() {
  const [feed, setFeed] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const push = (e: ChatEntry) => setFeed((f) => [...f, e]);
  const scrollDown = () => requestAnimationFrame(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; });
  useEffect(() => { scrollDown(); }, [feed, typing]);

  /* Intro: typing → "what do you need?" + options */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await wait(600); if (cancelled) return;
      setTyping(true); scrollDown();
      await wait(1400); if (cancelled) return;
      setTyping(false);
      push(alia({
        blocks: [{ type: 'text', text: 'what do you need?' }],
        actions: [
          { id: 'update', label: 'update my profile' },
          { id: 'signout', label: 'log out' },
          { id: 'leave', label: 'leave alia' },
        ],
      }));
      scrollDown();
    })();
    return () => { cancelled = true; };
  }, []);

  const disableActions = (entryId: string) =>
    setFeed((f) => f.map((e) => (e.id === entryId ? { ...e, actionsDisabled: true } : e)));

  const onAction = (actionId: string, entryId: string) => {
    disableActions(entryId);
    (async () => {
      setTyping(true); scrollDown();
      if (actionId === 'update') {
        await wait(1600); setTyping(false);
        push(alia({
          body: (
            <>
              <p className="text">here&rsquo;s what i have on you.</p>
              <div className="gap-same"><div className="prof-av-sm"><img src={ME_SHOT} alt="" /></div></div>
              <p className="text gap-same">{PROFILE.name}</p>
              <p className="text">{PROFILE.bday}</p>
              <p className="text">{PROFILE.email}</p>
              <p className="text">{PROFILE.phone}</p>
              <p className="text gap-same">tell me what to change. hit send.</p>
            </>
          ),
        }));
      } else if (actionId === 'signout') {
        await wait(1000); setTyping(false);
        push(alia({ blocks: [{ type: 'text', text: 'see you soon.' }], actions: [{ id: 'logout-final', label: 'log out' }] }));
      } else if (actionId === 'leave') {
        await wait(1200); setTyping(false);
        push(alia({ blocks: [{ type: 'text', text: 'you sure? your spot goes away but we\u2019ll remember you.' }], actions: [{ id: 'leave-final', label: 'leave alia' }] }));
      } else {
        // terminal buttons (logout-final / leave-final) — no further branch
        setTyping(false);
      }
      scrollDown();
    })();
  };

  const handleSend = (items: ComposerItem[]): boolean => {
    const blocks = itemsToBlocks(items);
    if (!blocks.length) return false;
    push({ id: nextId('me'), who: 'me', blocks, entering: true });
    scrollDown();
    (async () => {
      await wait(400); setTyping(true); scrollDown();
      await wait(1100); setTyping(false);
      push(alia({ blocks: [{ type: 'text', text: 'got it. i\u2019ll take care of that.' }] }));
      scrollDown();
    })();
    return true;
  };

  const go = (href: string) => { window.location.href = href; };

  return (
    <div className="app-root" id="profile">
      <div
        className="screen"
        onClick={(e) => {
          // tap anywhere outside the nav closes it (matches the original)
          if (navOpen && !(e.target as HTMLElement).closest('[data-nav],[data-handle]')) setNavOpen(false);
        }}
      >
        <div className="feed" ref={feedRef}>
          {feed.map((e) => <ChatMessage key={e.id} entry={e} onAction={onAction} />)}
          {typing ? <TypingIndicator /> : null}
        </div>
      </div>

      <div className={`composer-dock${navOpen ? ' nav-hidden' : ''}`}>
        <AliaComposer mode="profile" onSend={handleSend} />
      </div>

      <AliaBottomNav
        open={navOpen}
        active="profile"
        avatarSrc={ME_SHOT}
        onToggle={() => setNavOpen((o) => !o)}
        onProfile={() => setNavOpen(false)}
        onDiscover={() => go('/referral')}
        onAlia={() => go('/room')}
      />
    </div>
  );
}
