/* ───────────────────────────────────────────────────────────────────────────
   ReferralTool — Alia · the referral tool page.

   The blown-up referral note, LIVE. The avatar + display name are the
   logged-in member's account. The message space below is a single note that is
   EITHER written OR spoken, never both — composed from the canonical blocks:
   <AliaText> (the freeform message) + <AliaVoice recordable> (the voice block,
   which owns record → play → remove). The name screen is an <AliaField>
   (structured data collection); the link screen is a plain value screen.
   Pure black, no chrome — space and type only.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { img } from './../data';
import AliaAvatar from './../blocks/AliaAvatar';
import AliaName from './../blocks/AliaName';
import AliaField from './../blocks/AliaField';
import AliaText from './../blocks/AliaText';
import AliaVoice from './../blocks/AliaVoice';
import type { RecorderResult } from './../blocks/AliaVoice';

const REF_ME = { name: 'justine aliotta', avatar: img('alia avatar.png') };

export default function ReferralTool() {
  const [step, setStep] = useState<'name' | 'compose' | 'link'>('name');
  const [invitee, setInvitee] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const msgRef = useRef<HTMLDivElement | null>(null);
  const nameTimer = useRef<number | null>(null);

  /* the note — a single text-OR-voice field, composed from AliaText + AliaVoice */
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<RecorderResult | null>(null);
  const [recording, setRecording] = useState(false);
  const isEmpty = !text.trim() && !voice;

  /* name — who you're bringing; the AliaField (structured data) commits it and
     brings the note in. No manual submit: like the Profile card, it AUTOSAVES —
     5s after you stop typing it commits the name and advances to the note. */
  const NAME_IDLE_MS = 5 * 1000;
  const commitName = (v: string) => {
    const name = v.trim();
    if (nameTimer.current) { window.clearTimeout(nameTimer.current); nameTimer.current = null; }
    if (!name) return;
    setInvitee(name); setStep('compose');
  };
  /* every keystroke restarts the idle clock; it commits once you've stopped. */
  const onNameType = (v: string) => {
    if (nameTimer.current) window.clearTimeout(nameTimer.current);
    if (v.trim()) nameTimer.current = window.setTimeout(() => commitName(v), NAME_IDLE_MS);
  };
  useEffect(() => () => { if (nameTimer.current) window.clearTimeout(nameTimer.current); }, []);

  /* mint the invite link from the note */
  const done = () => {
    if (isEmpty) return;
    const token = Math.random().toString(36).slice(2, 8);
    const url = 'alia.club/' + token;
    // eslint-disable-next-line no-console
    console.log('[referral] invite created →', voice
      ? { invitee, link: url, kind: 'voice', ...voice }
      : { invitee, link: url, kind: 'text', text });
    setLink(url); setStep('link');
  };

  const onCopy = async () => {
    try { await navigator.clipboard.writeText('https://' + link); } catch (_e) {}
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  };
  const onShare = async () => {
    const nav = navigator as any;
    if (nav.share) { try { await nav.share({ title: 'alia', text: 'bring ' + invitee + ' to alia', url: 'https://' + link }); } catch (_e) {} }
    else onCopy();
  };

  return (
    <div className="flow-root" id="referral-tool">
      <div className="flow-intro">
        {step === 'name' ? (
          <div className="flow-stack ref-name-screen" key="name">
            <div className="flow-call"><p className="ref-bring">you've got +1.<br />who are you bringing?<br />be picky.</p></div>
            <AliaField className="ref-name-field" placeholder="name" autoFocus onType={onNameType} onChange={commitName} />
          </div>
        ) : step === 'compose' ? (
          <div className="flow-stack ref-note-screen" key="note">
            <p className="ref-bring ref-say">say whatever to {invitee.toLowerCase()}.</p>
            <div className="ref-msg">
              <div className="msg">
                <div className="msg-inner">
                  <div className="avatar-col"><div className="avatar-sticky"><AliaAvatar src={REF_ME.avatar} /></div></div>
                  <div className="msg-main"><div className="col">
                    <div className="name-row"><AliaName name={REF_ME.name} /></div>
                  <div className="body">
                    <div className="amm-field">
                      {voice ? (
                        <AliaVoice recordable value={voice} wrapClassName="amm-voice" onRemove={() => setVoice(null)} />
                      ) : recording ? (
                        <AliaVoice
                          recordable
                          startRecording
                          onCommit={(r) => { setVoice(r); setRecording(false); }}
                          onCancelRecording={() => setRecording(false)}
                        />
                      ) : (
                        <>
                          <AliaText editable className="amm-text" ref={msgRef} onInput={() => setText(msgRef.current?.innerText || '')} />
                          {!text.trim() ? <button className="amm-voice-add" onClick={() => setRecording(true)}>voice</button> : null}
                        </>
                      )}
                    </div>
                  </div>
                  </div></div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flow-stack ref-link-screen" key="link">
            <p className="ref-bring ref-send-it">send it.</p>
            <a className="ref-link" href={'https://' + link} onClick={(e) => e.preventDefault()}>{link}</a>
            <div className="ref-link-actions">
              <button className="ref-link-btn" onClick={onCopy}>{copied ? 'copied' : 'copy'}</button>
              <button className="ref-link-btn" onClick={onShare}>share</button>
            </div>
          </div>
        )}
      </div>

      {/* blinking "done" — mints the invite link. Appears once the note has content. */}
      {step === 'compose' && !isEmpty && !recording ? (
        <button className="ref-done" onClick={done}>done</button>
      ) : null}
    </div>
  );
}
