/* ───────────────────────────────────────────────────────────────────────────
   P2PReferral — the +2 invite flow.

   Alia gifts the member two invites. For each: she asks who's first → the
   member writes a note in the FULL p2p-referral composer (text · photos · voice
   · links) → Alia shows a preview of exactly what the friend will see → the
   member confirms (or sends a "change X to Y" correction) → Alia hands over a
   generated invite link with copy / share. A quota orbit pill tracks progress;
   a restart row offers the second invite.

   Reuses: AliaComposer (p2p-referral mode) · ChatMessage / TypingIndicator ·
   AliaBottomNav · MessageBlock (preview body) · itemsToBlocks. Conversation
   layout WITH the bottom nav (nav replaces composer when open).
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import { img } from './../data';
import type { ComposerItem } from './../types';
import { itemsToBlocks, nextId } from './../utils';
import { ChatMessage, ChatEntry } from './../shared/chat';
import TypingIndicator from './../TypingIndicator';
import { Icon } from './../icons';
import AliaComposer from './../AliaComposer';
import AliaBottomNav from './../AliaBottomNav';

const ALIA = img('alia avatar.png');
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const alia = (rest: Partial<ChatEntry>): ChatEntry => ({ id: nextId('a'), who: 'alia', name: 'Alia', img: ALIA, entering: true, ...rest });

const FRIENDS = [
  { name: 'Noa Lindqvist', img: img('alia accidental turned-head selfie face.png') },
  { name: 'Priya Kapoor', img: img('alia flash glare nightlife ugc selfie.png') },
];

/* ── Invite-link generator ───────────────────────────────────────────────── */
function makeLink(): string {
  const words = ['velvet', 'after', 'midnight', 'cherry', 'static', 'amber', 'orchid', 'lowlight', 'paloma', 'tinsel'];
  const a = words[(Math.random() * words.length) | 0];
  let b = words[(Math.random() * words.length) | 0];
  while (b === a) b = words[(Math.random() * words.length) | 0];
  return `alia.world/i/${a}-${b}`;
}

/* ── Affirmative / correction parsing ────────────────────────────────────── */
function isAffirmative(items: ComposerItem[]): boolean {
  const text = items.filter((b) => b.type === 'text').map((b: any) => b.text).join(' ').trim().toLowerCase();
  return /^(yes|yeah|yep|yup|good|ok|okay|k\b|send|looks good|perfect|great|do it|go|sure|dope|love it|nice|fine|do|sent|\uD83D\uDC4D)/.test(text);
}
function applyCorrection(draftItems: ComposerItem[], correctionText: string): ComposerItem[] | null {
  const m = correctionText.match(/(?:no[,.]?\s+)?(?:change|fix|replace|swap)\s+["']?(.+?)["']?\s+(?:to|with)\s+["']?(.+?)["']?\s*$/i);
  if (!m) return null;
  const [, find, replace] = m;
  return draftItems.map((item) => {
    if (item.type !== 'text') return item;
    const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return { ...item, text: (item as any).text.replace(regex, replace) };
  });
}

/* ── Silent autocorrect (simulates a backend spell pass) ─────────────────── */
const WORD_LIST = new Set(
  ('a an the and or but if in on at to of for with not so yet as by up out off over then than that this these those it its is am are was were be been being have has had do did does will would could should must may might can let got get go come came see say said know think feel look want need use make take give keep find tell ask seem leave call start show turn try put mean happen live love like miss hope wish wait help care send share invite join open click check read write post dm i me my we us our you your he she her him his they them their who what when where how why which there here some any all both each every no none many much more most very really just only also too still always never already again back now even well maybe probably actually though while because before after since until about around between through same right good great new old big little long first last other own next few such yeah yes okay ok sure day time night week month year way life work place part thing people friend friends family girl girls boy babe queen diva something anything everything nothing someone anyone everyone omg lol btw fyi tbh imo ngl hey hi hello bye ugh wow alia app link phone message text bestie gorgeous amazing').split(' '),
);
function autoCorrectWord(word: string): string {
  const lower = word.toLowerCase();
  if (!lower || lower.length < 2) return word;
  if (WORD_LIST.has(lower)) return word;
  for (let i = 0; i < lower.length; i++) {
    const c = lower.slice(0, i) + lower.slice(i + 1);
    if (c.length >= 2 && WORD_LIST.has(c)) return /^[A-Z]/.test(word) ? c[0].toUpperCase() + c.slice(1) : c;
  }
  for (let i = 0; i < lower.length - 1; i++) {
    const c = lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2);
    if (WORD_LIST.has(c)) return /^[A-Z]/.test(word) ? c[0].toUpperCase() + c.slice(1) : c;
  }
  return word;
}
function autoCorrectItems(items: ComposerItem[]): ComposerItem[] {
  return items.map((item) => {
    if (item.type !== 'text') return item;
    const fixed = (item as any).text.replace(/\b([a-zA-Z']+)\b/g, autoCorrectWord);
    return fixed !== (item as any).text ? { ...item, text: fixed } : item;
  });
}

/* ── Quota orbit pill ────────────────────────────────────────────────────── */
function QuotaPill({ sent }: { sent: number }) {
  const orb = (slot: number) =>
    sent >= slot ? { fill: 'currentColor' } : { fill: '#0a0a0a', stroke: 'currentColor', strokeWidth: 1.4 };
  return (
    <div className="quota">
      <svg data-icon="orbit" width="34" height="34" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" />
        <g className="orbiters">
          <circle cx="18.55" cy="7.41" r="1.7" {...orb(1)} />
          <circle cx="5.45" cy="16.59" r="1.7" {...orb(2)} />
        </g>
      </svg>
    </div>
  );
}

/* ── Invite-link card ────────────────────────────────────────────────────── */
function LinkCard({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="block gap-diff">
      <div className="pw-card">
        <div className="pw-val link"><span>{link}</span></div>
        <div className="pw-share">
          <button onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'copied' : 'copy'}
          </button>
          <button><Icon name="share" size={13} /> share</button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
type Dock = 'composer' | 'confirm' | 'restart' | 'hidden';

export default function P2PReferral() {
  const [feed, setFeed] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const [dock, setDock] = useState<Dock>('composer');
  const [navOpen, setNavOpen] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // mutable flow state (doesn't drive render directly)
  const st = useRef({ invitesLeft: 2, friend: FRIENDS[0], draftItems: null as ComposerItem[] | null });

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
  const addQuota = () => push({ id: nextId('q'), who: 'meta', blocks: [], quotaSent: 2 - st.current.invitesLeft } as any);
  const memberMsg = (items: ComposerItem[]) => push({ id: nextId('me'), who: 'me', blocks: itemsToBlocks(items), entering: true });

  /* Start an invite (first or second). */
  const startInvite = async () => {
    setDock('composer');
    st.current.draftItems = null;
    st.current.friend = FRIENDS[(2 - st.current.invitesLeft) % FRIENDS.length];
    if (st.current.invitesLeft === 2) {
      await aliaSay({ body: (<div className="block"><p className="text">you get a <span className="em">+2</span>. who&rsquo;s first. send her something.</p></div>) });
    } else {
      await aliaSay({ blocks: [{ type: 'text', text: 'one more. who\u2019s getting it. write her something.' }] });
    }
    await wait(160);
    addQuota();
  };

  useEffect(() => { startInvite(); /* eslint-disable-next-line */ }, []);

  /* Preview the current draft — renders a REAL room message (ChatMessage)
     exactly as the friend will receive it. */
  const showPreview = async (items: ComposerItem[]) => {
    const f = st.current.friend;
    await aliaSay({
      body: (
        <>
          <div className="block"><p className="text">here&rsquo;s what she&rsquo;ll see. you good?</p></div>
          <div className="block gap-diff">
            <div className="preview">
              <ChatMessage entry={{ id: nextId('pv'), who: 'them', name: f.name, img: f.img, blocks: itemsToBlocks(items) }} />
            </div>
          </div>
        </>
      ),
    });
    setDock('confirm');
  };

  /* First send → autocorrect → preview. */
  const onComposerSend = (items: ComposerItem[]): boolean => {
    const meaningful = items.filter((b) => (b.type === 'text' ? (b as any).text.trim() : true));
    if (!meaningful.length) return false;
    st.current.draftItems = autoCorrectItems(items);
    memberMsg(items);
    (async () => { await wait(640); await showPreview(st.current.draftItems!); })();
    return true;
  };

  /* Confirm composer → yes sends; a correction re-previews. */
  const onConfirmSend = (items: ComposerItem[]): boolean => {
    const meaningful = items.filter((b) => (b.type === 'text' ? (b as any).text.trim() : true));
    if (!meaningful.length) { confirmSend(); return true; }
    memberMsg(items);
    (async () => {
      await wait(400);
      if (isAffirmative(items)) { confirmSend(); return; }
      const correctionText = items.filter((b) => b.type === 'text').map((b: any) => b.text).join(' ');
      const corrected = applyCorrection(st.current.draftItems!, correctionText);
      await wait(300);
      if (corrected) { st.current.draftItems = corrected; await showPreview(corrected); }
      else setDock('composer');
    })();
    return true;
  };

  /* Generate the link, decrement quota, offer the next. */
  const confirmSend = async () => {
    setDock('hidden');
    await wait(300);
    const link = makeLink();
    st.current.invitesLeft = Math.max(0, st.current.invitesLeft - 1);
    await aliaSay({
      body: (
        <>
          <div className="block"><p className="text">here&rsquo;s her link. send it however you want.</p></div>
          <LinkCard link={link} />
        </>
      ),
    });
    await wait(200);
    addQuota();
    if (st.current.invitesLeft > 0) {
      st.current.friend = FRIENDS[(2 - st.current.invitesLeft) % FRIENDS.length];
      await wait(400);
      await aliaSay({ blocks: [{ type: 'text', text: 'who\u2019s next? send her something.' }] });
      await wait(160);
      setDock('composer');
    } else {
      setDock('restart');
    }
  };

  return (
    <div className="app-root" id="p2p-referral">
      <div className="screen" onClick={() => { if (navOpen) setNavOpen(false); }}>
        <div className="feed" ref={feedRef}>
          {feed.map((e) =>
            (e as any).who === 'meta'
              ? <QuotaPill key={e.id} sent={(e as any).quotaSent} />
              : <ChatMessage key={e.id} entry={e} />,
          )}
          {typing ? <TypingIndicator /> : null}
        </div>
      </div>

      {/* Nav is a direct child of .app-root (same as Room) so it floats over the
          bottom; tapping the handle reveals it, tapping the feed closes it. The
          orbit (Referrals) is the active tab — bright; profile + Alia dim. */}
      <AliaBottomNav
        open={navOpen}
        active="discover"
        onToggle={() => setNavOpen((o) => !o)}
        avatarSrc={img('alia necklace detail selfie.png')}
        onProfile={() => setNavOpen(false)}
        onDiscover={() => setNavOpen(false)}
        onAlia={() => setNavOpen(false)}
      />

      {dock === 'composer' ? (
        <div className={`composer-dock${navOpen ? ' nav-hidden' : ''}`}>
          <AliaComposer mode="p2p-referral" onSend={onComposerSend} />
        </div>
      ) : dock === 'confirm' ? (
        <div className={`composer-dock${navOpen ? ' nav-hidden' : ''}`}>
          <AliaComposer mode="p2p-referral" onSend={onConfirmSend} />
        </div>
      ) : dock === 'restart' ? (
        <div className={`restart-row${navOpen ? ' nav-hidden' : ''}`}>
          <button disabled>
            <Icon name="restart" size={15} /> all set for now
          </button>
        </div>
      ) : null}
    </div>
  );
}
