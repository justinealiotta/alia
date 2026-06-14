/* ───────────────────────────────────────────────────────────────────────────
   Otp — the Alia sign-in screen.

   Two paths (the original's dev switcher is now the `?flow=` query param):
     • returning (default): the persistent session is alive — Alia greets with
       a single "enter alia" button that reconnects the token. No code.
     • flagged (?flow=flagged): the session was killed — Alia re-verifies via a
       one-time email + code conversation through the otp-mode composer.

   Reuses: AliaComposer (otp mode) · shared ChatMessage / TypingIndicator.
   Conversation layout, no bottom nav.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import { img } from './../data';
import type { ComposerItem } from './../types';
import { nextId } from './../utils';
import { ChatMessage, ChatEntry } from './../shared/chat';
import TypingIndicator from './../TypingIndicator';
import AliaComposer from './../AliaComposer';

const ALIA = img('alia avatar.png');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const alia = (rest: Partial<ChatEntry>): ChatEntry => ({ id: nextId('a'), who: 'alia', name: 'Alia', img: ALIA, entering: true, ...rest });

/** White "enter alia" button with a click → spinner → sign-in. */
function EnterButton({ onEnter }: { onEnter: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="gap-same">
      <button
        className="enter-btn"
        disabled={busy}
        onClick={() => { if (busy) return; setBusy(true); setTimeout(onEnter, 650); }}
      >
        {busy ? <span className="spin" /> : null}
        enter alia
      </button>
    </div>
  );
}

export default function Otp() {
  const flow = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('flow') === 'flagged') ? 'flagged' : 'returning';
  const [feed, setFeed] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const stepRef = useRef<'enter' | 'email' | 'code' | 'wait' | 'done'>(flow === 'returning' ? 'enter' : 'email');
  const feedRef = useRef<HTMLDivElement>(null);

  const push = (e: ChatEntry) => setFeed((f) => [...f, e]);
  const scrollDown = () => requestAnimationFrame(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; });
  useEffect(() => { scrollDown(); }, [feed, typing]);

  /* Intro per flow */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTyping(true); scrollDown();
      await wait(1500); if (cancelled) return;
      setTyping(false);
      if (flow === 'returning') {
        push(alia({
          body: (
            <>
              <p className="text">you&rsquo;re back.</p>
              <EnterButton onEnter={() => setSignedIn(true)} />
            </>
          ),
        }));
      } else {
        push(alia({ blocks: [{ type: 'text', text: "hey. let's get you back in." }] }));
        await wait(200); if (cancelled) return;
        setTyping(true); scrollDown();
        await wait(1700); if (cancelled) return;
        setTyping(false);
        push(alia({ blocks: [{ type: 'text', text: 'tell me your email.' }] }));
      }
      scrollDown();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = (items: ComposerItem[]): boolean => {
    const value = items.filter((i) => i.type === 'text').map((i: any) => i.text).join(' ').trim();
    if (!value) return false;
    push({ id: nextId('me'), who: 'me', blocks: [{ type: 'text', text: value }], entering: true });
    scrollDown();

    if (stepRef.current === 'email') {
      stepRef.current = 'wait';
      (async () => {
        await wait(700); setTyping(true); scrollDown();
        await wait(1700); setTyping(false);
        push(alia({ blocks: [{ type: 'text', text: "sent. what's the code?" }] }));
        stepRef.current = 'code';
        scrollDown();
      })();
    } else if (stepRef.current === 'code') {
      stepRef.current = 'wait';
      (async () => {
        await wait(1200);
        stepRef.current = 'done';
        setSignedIn(true);
      })();
    }
    return true;
  };

  return (
    <div className="app-root" id="otp">
      <div className="screen">
        <div className="feed" ref={feedRef}>
          {feed.map((e) => <ChatMessage key={e.id} entry={e} />)}
          {typing ? <TypingIndicator /> : null}
        </div>
      </div>

      {!signedIn ? (
        <div className="composer-dock">
          <AliaComposer mode="otp" onSend={handleSend} />
        </div>
      ) : null}
    </div>
  );
}
