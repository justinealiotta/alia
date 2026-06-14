/* ───────────────────────────────────────────────────────────────────────────
   AliaMessages — the room feed.
   Renders the ordered stream of messages, inline reply threads, ephemeral
   phrase cards, hearts, orbit clusters, and a simulated typing indicator.
   Reply / edit modes dim the feed and spotlight the target (.replying /
   .editing / .msg-target — styling in messages.css).

   Composes: <MessageBlock>, <OrbitStrip>, <AliaVoice> (via blocks),
   useHearts / <HeartZone> / <HeartFloaterLayer>.
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FeedEntry, MessageEntry, PhraseEntry } from './types';
import { isPhrase } from './types';
import { blockKind, gapClass, gapTier } from './utils';
import type { GapTier } from './utils';
import { Icon } from './icons';
import MessageBlock, { MediaOpen } from './MessageBlocks';
import OrbitStrip from './OrbitStrip';
import { useHearts, HeartZone, HeartFloaterLayer } from './Hearts';
import TypingIndicator from './TypingIndicator';
import { pixelDispersion } from './pixelDispersion';

export type ReplyMode =
  | { kind: 'idle' }
  | { kind: 'reply'; targetId: string; afterReplyId?: string }
  | { kind: 'edit'; targetId: string };

interface Handlers {
  onReply: (msgId: string, afterReplyId?: string) => void;
  onEdit: (id: string) => void;
  onUnsend: (id: string) => void;
  onOpenMedia: MediaOpen;
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
function Avatar({ src, onOpenMedia }: { src?: string; onOpenMedia: MediaOpen }) {
  return (
    <div className="avatar">
      {src ? (
        <img
          src={src}
          alt=""
          style={{ cursor: 'zoom-in' }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenMedia(src, true);
          }}
        />
      ) : null}
    </div>
  );
}

/* ── Block body ──────────────────────────────────────────────────────────── */
function Body({ entry, onOpenMedia }: { entry: MessageEntry; onOpenMedia: MediaOpen }) {
  return (
    <div className="body">
      {entry.blocks.map((b, i) => {
        const prev = i > 0 ? blockKind(entry.blocks[i - 1].type) : null;
        const cls = gapClass(prev, blockKind(b.type));
        return <MessageBlock key={i} block={b} cls={cls} onOpenMedia={onOpenMedia} />;
      })}
    </div>
  );
}

/* ── Message actions (reply · edit · unsend / report) ────────────────────── */
function MsgActions({
  own,
  showReply,
  onReply,
  onEdit,
  onUnsend,
}: {
  own: boolean;
  showReply: boolean;
  onReply: () => void;
  onEdit: () => void;
  onUnsend: () => void;
}) {
  const [reported, setReported] = useState(false);
  return (
    <div className="msg-actions">
      {showReply ? (
        <button className="act-btn" onClick={onReply}>
          reply
        </button>
      ) : null}
      {own ? (
        <>
          <button className="act-btn" onClick={onEdit}>
            edit
          </button>
          <button className="act-btn unsend" onClick={onUnsend}>
            unsend
          </button>
        </>
      ) : (
        <>
          <button className="act-btn report" onClick={() => setReported(true)} disabled={reported}>
            report
          </button>
          {reported ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--fg)', marginLeft: 2 }}>
              <Icon name="check" size={14} />
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ── Reply ───────────────────────────────────────────────────────────────── */
function Reply({
  reply,
  parentId,
  isR2R,
  isReplyTarget,
  handlers,
}: {
  reply: MessageEntry;
  parentId: string;
  isR2R: boolean;
  isReplyTarget: boolean;
  handlers: Handlers;
}) {
  const hearts = useHearts((reply.hearts || []).length, reply.isOwn);
  const rootRef = useRef<HTMLDivElement>(null);
  const showIdentity = !reply.isOwn;
  const unsendReply = () => {
    const el = rootRef.current;
    if (el) pixelDispersion(el).then(() => handlers.onUnsend(reply.id!));
    else handlers.onUnsend(reply.id!);
  };
  return (
    <div className={`reply${isReplyTarget ? ' reply-target' : ''}`} ref={rootRef}>
      <MsgActions
        own={reply.isOwn}
        showReply={!isR2R}
        onReply={() => handlers.onReply(parentId, reply.id)}
        onEdit={() => handlers.onEdit(reply.id!)}
        onUnsend={unsendReply}
      />
      <div
        className="avatar-col"
        style={{ width: 34, flexShrink: 0, visibility: showIdentity ? undefined : 'hidden' }}
      >
        <div className="avatar-sticky">
          <Avatar src={reply.user.img} onOpenMedia={handlers.onOpenMedia} />
        </div>
      </div>
      <div className="col">
        {showIdentity ? (
          <div className="name-row">
            <span className="name">{reply.user.name}</span>
            {reply.edited ? <span className="edited">edited</span> : null}
          </div>
        ) : null}
        <Body entry={reply} onOpenMedia={handlers.onOpenMedia} />
        <HeartZone loved={hearts.loved} loves={hearts.loves} onToggle={hearts.toggle} own={reply.isOwn} />
      </div>
      <HeartFloaterLayer floaters={hearts.floaters} />
    </div>
  );
}

/* ── Replies thread (collapsible) ────────────────────────────────────────── */
/** Find the id of the top-level message whose reply subtree contains `replyId`. */
function topLevelContaining(feed: FeedEntry[], replyId: string): string | null {
  const has = (rs?: MessageEntry[]): boolean =>
    !!rs && rs.some((r) => r.id === replyId || has(r.replies));
  for (const e of feed) {
    if (isPhrase(e)) continue;
    const m = e as MessageEntry;
    if (has(m.replies)) return m.id ?? null;
  }
  return null;
}

function flattenReplies(replies: MessageEntry[], parentMsgId: string, handlers: Handlers, replyTargetId: string | null, depth = 0): React.ReactNode[] {
  return replies.flatMap((r) => [
    <Reply key={r.id} reply={r} parentId={parentMsgId} isR2R={depth > 0} isReplyTarget={r.id === replyTargetId} handlers={handlers} />,
    ...(r.replies && r.replies.length ? flattenReplies(r.replies, parentMsgId, handlers, replyTargetId, depth + 1) : []),
  ]);
}

function Replies({ entry, handlers, replyTargetId }: { entry: MessageEntry; handlers: Handlers; replyTargetId: string | null }) {
  const [open, setOpen] = useState(true);
  if (!entry.replies || entry.replies.length === 0) return null;
  return (
    <div className="replies">
      <button className="replies-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        replies
      </button>
      {open ? (
        <div className="replies-list">
          {flattenReplies(entry.replies, entry.id!, handlers, replyTargetId)}
        </div>
      ) : null}
    </div>
  );
}

/* ── Message ─────────────────────────────────────────────────────────────── */
function Message({
  entry,
  prevAuthor,
  gap,
  isTarget,
  isContext,
  replyTargetId,
  handlers,
}: {
  entry: MessageEntry;
  prevAuthor: string | null;
  gap: GapTier | null;
  isTarget: boolean;
  isContext: boolean;
  replyTargetId: string | null;
  handlers: Handlers;
}) {
  const hearts = useHearts((entry.hearts || []).length, entry.isOwn);
  const rootRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const showIdentity = !entry.isOwn && entry.user.name !== prevAuthor;

  const unsend = () => {
    if (leaving) return;
    setLeaving(true);
    const el = rootRef.current;
    if (el) pixelDispersion(el).then(() => handlers.onUnsend(entry.id!));
    else handlers.onUnsend(entry.id!);
  };

  return (
    <div
      ref={rootRef}
      data-gap={gap || undefined}
      className={`msg${isTarget ? ' msg-target' : ''}${isContext ? ' msg-context' : ''}`}
    >
      <div className="msg-inner">
        <div className="avatar-col" style={{ visibility: showIdentity ? undefined : 'hidden' }}>
          <div className="avatar-sticky">
            <Avatar src={entry.user.img} onOpenMedia={handlers.onOpenMedia} />
          </div>
        </div>
        <div className="col">
          {showIdentity ? (
            <div className="name-row">
              <span className="name">{entry.user.name}</span>
            </div>
          ) : (
            <div className="name-row" style={{ visibility: 'hidden' }}>
              <span className="name">{'\u200b'}</span>
            </div>
          )}
          <Body entry={entry} onOpenMedia={handlers.onOpenMedia} />
          {entry.edited ? <span className="edited">edited</span> : null}
        </div>
      </div>
      <div className="col-footer">
        <HeartZone loved={hearts.loved} loves={hearts.loves} onToggle={hearts.toggle} own={entry.isOwn} />
        <OrbitStrip interactions={entry.interactions || []} />
        <Replies entry={entry} handlers={handlers} replyTargetId={replyTargetId} />
      </div>
      <MsgActions
        own={entry.isOwn}
        showReply
        onReply={() => handlers.onReply(entry.id!)}
        onEdit={() => handlers.onEdit(entry.id!)}
        onUnsend={unsend}
      />
      <HeartFloaterLayer floaters={hearts.floaters} />
    </div>
  );
}

/* ── Phrase card ─────────────────────────────────────────────────────────── */
function PhraseCard({ entry, gap }: { entry: PhraseEntry; gap: GapTier | null }) {
  const lines = (entry.phrase || '').split('\n');
  return (
    <div className="phrase-card" data-gap={gap || undefined}>
      {lines.map((l, i) => (
        <React.Fragment key={i}>
          {l}
          {i < lines.length - 1 ? <br /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── Feed ────────────────────────────────────────────────────────────────── */
/* ── Feed ────────────────────────────────────────────────────────────────── */
export interface AliaMessagesProps {
  feed: FeedEntry[];
  mode: ReplyMode;
  onReply: (msgId: string, afterReplyId?: string) => void;
  onEdit: (id: string) => void;
  onUnsend: (id: string) => void;
  onOpenMedia: MediaOpen;
}

export default function AliaMessages({ feed, mode, onReply, onEdit, onUnsend, onOpenMedia }: AliaMessagesProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const handlers: Handlers = { onReply, onEdit, onUnsend, onOpenMedia };

  // Keep the latest post in view when the feed grows (if already near bottom).
  useLayoutEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [feed]);

  // Scroll to bottom on first mount.
  useEffect(() => {
    const el = feedRef.current;
    if (el) requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, []);

  const dimClass = mode.kind === 'reply' ? ' replying' : mode.kind === 'edit' ? ' editing' : '';

  // Three-tier spotlight resolution:
  //  · brightMsgId   — a top-level message acted on directly (whole thing bright)
  //  · replyTargetId — a specific reply acted on (that reply bright)
  //  · contextMsgId  — the top-level message CONTAINING replyTargetId (mid tier)
  let brightMsgId: string | null = null;
  let replyTargetId: string | null = null;
  let contextMsgId: string | null = null;
  if (mode.kind === 'reply') {
    if (mode.afterReplyId) {
      replyTargetId = mode.afterReplyId;
      contextMsgId = mode.targetId; // the parent top-level message
    } else {
      brightMsgId = mode.targetId;
    }
  } else if (mode.kind === 'edit') {
    const isTopLevel = feed.some((e) => !isPhrase(e) && (e as MessageEntry).id === mode.targetId);
    if (isTopLevel) {
      brightMsgId = mode.targetId;
    } else {
      // editing a reply — spotlight it, mid-dim its parent + siblings
      replyTargetId = mode.targetId;
      contextMsgId = topLevelContaining(feed, mode.targetId);
    }
  }

  let prevAuthor: string | null = null;
  let prevTs: number | undefined;

  return (
    <div className={`feed${dimClass}`} ref={feedRef}>
      <div className="feed-spacer" />
      {feed.map((e, i) => {
        const gap = gapTier(prevTs, (e as any).ts);
        prevTs = (e as any).ts ?? prevTs;
        if (isPhrase(e)) {
          prevAuthor = null;
          return <PhraseCard key={e.id || `phrase-${i}`} entry={e} gap={gap} />;
        }
        const msg = e as MessageEntry;
        const node = (
          <Message
            key={msg.id}
            entry={msg}
            prevAuthor={prevAuthor}
            gap={gap}
            isTarget={msg.id === brightMsgId}
            isContext={msg.id === contextMsgId}
            replyTargetId={replyTargetId}
            handlers={handlers}
          />
        );
        prevAuthor = msg.user.name;
        return node;
      })}
      <TypingIndicator ambient />
    </div>
  );
}
