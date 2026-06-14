/* ───────────────────────────────────────────────────────────────────────────
   Room — the live room screen.
   Owns feed state and orchestrates the four components:
     <AliaMessages>  the feed
     <AliaComposer>  post · reply · edit
     <AliaVoice>     (inside messages / composer)
     <AliaBottomNav> the hidden nav

   Reply / edit / unsend / send all flow through here so the composer and feed
   stay in sync through the composer's mount handoff.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState } from 'react';
import type { ComposerItem, FeedEntry, MessageEntry } from './types';
import { isPhrase } from './types';
import { FEED, MEMBER_IMGS } from './data';
import { itemsToBlocks, blocksToItems, seedIds, nextId } from './utils';
import AliaMessages, { ReplyMode } from './AliaMessages';
import AliaComposer from './AliaComposer';
import AliaBottomNav from './AliaBottomNav';

const ME = { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS };

/* ── Recursive feed helpers (messages + their replies share a shape) ─────── */

function mapEntry(feed: FeedEntry[], id: string, fn: (m: MessageEntry) => MessageEntry): FeedEntry[] {
  const mapReplies = (rs: MessageEntry[]): MessageEntry[] =>
    rs.map((r) => {
      let next = r.id === id ? fn(r) : r;
      if (next.replies) {
        const nested = mapReplies(next.replies);
        if (nested !== next.replies) next = { ...next, replies: nested };
      }
      return next;
    });
  return feed.map((e) => {
    if (isPhrase(e)) return e;
    let m = e as MessageEntry;
    if (m.id === id) m = fn(m);
    if (m.replies) {
      const replies = mapReplies(m.replies);
      if (replies !== m.replies) m = { ...m, replies };
    }
    return m;
  });
}

function removeEntry(feed: FeedEntry[], id: string): FeedEntry[] {
  const pruneReplies = (rs: MessageEntry[]): MessageEntry[] =>
    rs
      .filter((r) => r.id !== id)
      .map((r) => (r.replies ? { ...r, replies: pruneReplies(r.replies) } : r));
  return feed
    .filter((e) => isPhrase(e) || (e as MessageEntry).id !== id)
    .map((e) => {
      if (isPhrase(e)) return e;
      const m = e as MessageEntry;
      return m.replies ? { ...m, replies: pruneReplies(m.replies) } : m;
    });
}

function findEntry(feed: FeedEntry[], id: string): MessageEntry | null {
  const search = (rs: MessageEntry[]): MessageEntry | null => {
    for (const r of rs) {
      if (r.id === id) return r;
      if (r.replies) { const hit = search(r.replies); if (hit) return hit; }
    }
    return null;
  };
  for (const e of feed) {
    if (isPhrase(e)) continue;
    const m = e as MessageEntry;
    if (m.id === id) return m;
    if (m.replies) { const hit = search(m.replies); if (hit) return hit; }
  }
  return null;
}

/* ── Lightbox ────────────────────────────────────────────────────────────── */
function Lightbox({ src, avatar, onClose }: { src: string | null; avatar: boolean; onClose: () => void }) {
  return (
    <div className={`lightbox${src ? ' open' : ''}${avatar ? ' avatar-mode' : ''}`} onClick={onClose}>
      {src ? <img className="lightbox-img" src={src} alt="" /> : null}
    </div>
  );
}

export default function Room() {
  const [feed, setFeed] = useState<FeedEntry[]>(() => seedIds(FEED as any));
  const [mode, setMode] = useState<ReplyMode>({ kind: 'idle' });
  const [editPreload, setEditPreload] = useState<ComposerItem[] | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; avatar: boolean } | null>(null);

  /* ── Composer-driven actions ─────────────────────────────────────────────*/
  const handleSend = (items: ComposerItem[]) => {
    const blocks = itemsToBlocks(items);
    if (!blocks.length) return;

    if (mode.kind === 'edit') {
      setFeed((f) => mapEntry(f, mode.targetId, (m) => ({ ...m, blocks, edited: true })));
    } else if (mode.kind === 'reply') {
      const reply: MessageEntry = { id: nextId('r'), user: ME, isOwn: true, blocks, hearts: [] };
      const afterReplyId = mode.afterReplyId;
      if (afterReplyId) {
        // reply-to-reply: nest under the specific reply
        setFeed((f) => mapEntry(f, afterReplyId, (r) => ({ ...r, replies: [...(r.replies || []), reply] })));
      } else {
        setFeed((f) => mapEntry(f, mode.targetId, (m) => ({ ...m, replies: [...(m.replies || []), reply] })));
      }
    } else {
      const msg: MessageEntry = { id: nextId(), ts: Date.now(), user: ME, isOwn: true, blocks, hearts: [], interactions: [] };
      setFeed((f) => [...f, msg]);
    }
    exitMode();
  };

  /* ── Feed-driven actions ─────────────────────────────────────────────────*/
  const handleReply = (msgId: string, afterReplyId?: string) =>
    setMode({ kind: 'reply', targetId: msgId, afterReplyId });

  const handleEdit = (id: string) => {
    const entry = findEntry(feed, id);
    if (!entry) return;
    setEditPreload(blocksToItems(entry.blocks));
    setMode({ kind: 'edit', targetId: id });
  };

  const handleUnsend = (id: string) => {
    setFeed((f) => removeEntry(f, id));
    if (mode.kind !== 'idle' && mode.targetId === id) exitMode();
  };

  const exitMode = () => {
    setMode({ kind: 'idle' });
    setEditPreload(null);
  };

  const composerMode = mode.kind === 'reply' ? 'reply' : mode.kind === 'edit' ? 'edit' : 'room';
  const composerCtl = useRef<import('./AliaComposer').ComposerControl | null>(null);

  // Tap-away dismiss for reply / edit — a capture-phase listener on the screen,
  // NOT a blocking overlay (so the feed still scrolls). Reply: exit if empty,
  // else shake. Edit: exit if untouched, else shake (keep the draft).
  useEffect(() => {
    if (mode.kind === 'idle') return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-livedock]')) return;
      if (t.closest('.gif-sheet, .gif-backdrop')) return;
      if (t.closest('[data-reply], [data-act="edit"], .act-btn')) return;
      const ctl = composerCtl.current;
      if (mode.kind === 'edit') {
        if (!ctl || !ctl.isDirty()) exitMode();
        else ctl.shake();
      } else {
        if (!ctl || ctl.isEmpty()) exitMode();
        else ctl.shake();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="app-root" id="room">
      <div className="screen">
        <AliaMessages
          feed={feed}
          mode={mode}
          onReply={handleReply}
          onEdit={handleEdit}
          onUnsend={handleUnsend}
          onOpenMedia={(src, avatar) => setLightbox({ src, avatar })}
        />
      </div>

      {/* Nav is rendered before the composer so the
          `.nav-bar.open ~ .composer-wrap` lift selector matches. */}
      <AliaBottomNav
        open={navOpen}
        onToggle={() => setNavOpen((o) => !o)}
        avatarSrc={MEMBER_IMGS.JS}
        onProfile={() => setNavOpen(false)}
        onDiscover={() => setNavOpen(false)}
        onAlia={() => setNavOpen(false)}
      />

      <AliaComposer mode={composerMode} preload={editPreload} controlRef={composerCtl} onSend={handleSend} onDismissEmpty={exitMode} />

      <Lightbox src={lightbox?.src ?? null} avatar={lightbox?.avatar ?? false} onClose={() => setLightbox(null)} />
    </div>
  );
}
