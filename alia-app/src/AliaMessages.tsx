/* ───────────────────────────────────────────────────────────────────────────
   AliaMessages — the room feed (a block group).
   Renders the ordered stream of messages, inline reply threads, ephemeral
   phrase cards. Each message is a two-column row: <AliaAvatar> (left) then
   <AliaName> + the body built from <AliaMessageBlocks> (right).
   Reply / edit modes dim the feed and spotlight the target (.replying /
   .editing / .msg-target — styling in messages.css).

   Composes: <AliaAvatar>, <AliaName>, <AliaMessageBlocks>, <AliaVoice> (via blocks).
   ─────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MessageEntry, Block } from './types';
import { blockKind, gapClass } from './utils';
import { Icon } from './icons';
import AliaMessageBlocks from './AliaMessageBlocks';
import AliaMediaGrid, { type MediaCell } from './blocks/AliaMediaGrid';
import AliaAvatar from './blocks/AliaAvatar';
import AliaName from './blocks/AliaName';

export type ReplyMode =
  | { kind: 'idle' }
  | { kind: 'edit'; targetId: string };

interface Handlers {
  onEdit: (id: string) => void;
  onUnsend: (id: string) => void;
  /* in-place editor for a message OR block-reply, keyed by id (only invoked for
     the id currently being edited — replaces that body with the composer). */
  renderEditor: (id: string) => React.ReactNode;
  /* the block-level reply composer — the caret slot pinned under a specific
     block (msgId + blockIndex) inside a message. */
  renderBlockReplyComposer: (msgId: string, blockIndex: number) => React.ReactNode;
  editingId: string | null;
}

/* ── Edit gesture: none for now ─────────────────────────────────────────────
   Long-press → edit was REMOVED — long-press now belongs to the OS (save-image
   on mobile, native text selection). There is deliberately no edit affordance
   at the moment: the edit button is gone and no touch gesture replaces it. */

/* ── Avatar ──────────────────────────────────────────────────────────────── */
function Avatar({ src }: { src?: string }) {
  return <AliaAvatar src={src} />;
}

/* ── Media grid — a run of image/video blocks. The room's block group is
   AliaMediaGrid (layout="masonry"): a 2-col CSS-multicol grid where each cell is
   its own block, carrying its own block-reply stack (via renderCellAfter). ──── */

/* ── Block body ──────────────────────────────────────────────────────────── */
function Body({ entry, onDoubleClick, renderAfterBlock }: { entry: MessageEntry; onDoubleClick?: (e: React.MouseEvent) => void; renderAfterBlock?: (i: number) => React.ReactNode }) {
  const blocks = entry.blocks;
  const isMedia = (b?: Block) => !!b && (b.type === 'image' || b.type === 'video');
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    const prev = i > 0 ? blockKind(blocks[i - 1].type) : null;
    if (isMedia(b)) {
      const start = i;
      const run: Block[] = [];
      while (i < blocks.length && isMedia(blocks[i])) { run.push(blocks[i]); i++; }
      const cells: MediaCell[] = run.map((blk) => {
        if (blk.type === 'video') return { kind: 'video', src: blk.src, label: blk.label, w: blk.w, h: blk.h, duration: blk.duration, captions: blk.captions, captionsSrc: blk.captionsSrc, attention: blk.attention };
        const im = blk as Extract<Block, { type: 'image' }>;
        return { kind: 'photo', src: im.src, label: im.label, aspect: im.aspect };
      });
      out.push(
        <div className={gapClass(prev, 'media') + ' masonry-block'} data-block-index={start} key={'grid-' + start}>
          <AliaMediaGrid layout="masonry" items={cells} blockIndexStart={start} renderCellAfter={renderAfterBlock ? (k) => renderAfterBlock(start + k) : undefined} />
        </div>,
      );
      continue;
    }
    out.push(
      <React.Fragment key={i}>
        <AliaMessageBlocks block={b} cls={gapClass(prev, blockKind(b.type))} blockIndex={i} />
        {renderAfterBlock ? renderAfterBlock(i) : null}
      </React.Fragment>,
    );
    i++;
  }
  return <div className="body" onDoubleClick={onDoubleClick}>{out}</div>;
}

/* ── Translate — turn a message's text + voice transcript into the viewer's
   default language (navigator.language) via the in-page Claude helper, IN PLACE
   (the rendered blocks are swapped for the translations; the toggle flips to
   "english"). No loading state — the original stays until the translation lands. */
function useTranslate(blocks: Block[]) {
  const [on, setOn] = useState(false);
  const [map, setMap] = useState<Record<number, string> | null>(null);
  const items = useMemo(
    () => (blocks || [])
      .map((b, i) => ({ i, text: b.type === 'text' ? b.text : b.type === 'voice' ? (b.transcript || '') : '' }))
      .filter((x) => x.text && x.text.trim()),
    [blocks],
  );
  const langCode = (navigator.language || 'en').split('-')[0];
  let langName = 'your language';
  try { langName = new (Intl as any).DisplayNames([navigator.language], { type: 'language' }).of(langCode) || langName; } catch (_e) {}

  const toggle = async () => {
    if (on) { setOn(false); return; }
    if (map) { setOn(true); return; }
    try {
      const prompt =
        'Translate each string in this JSON array into ' + langName +
        '. Reply with ONLY a JSON array of the translated strings, in the same order, no other text.\n\n' +
        JSON.stringify(items.map((t) => t.text));
      const res = await (window as any).claude.complete(prompt);
      let arr: any;
      try { arr = JSON.parse(res); } catch (_e) { const m = String(res).match(/\[[\s\S]*\]/); arr = m ? JSON.parse(m[0]) : null; }
      if (!Array.isArray(arr)) return;
      const m: Record<number, string> = {};
      items.forEach((t, k) => { if (arr[k] != null) m[t.i] = String(arr[k]); });
      setMap(m); setOn(true);
    } catch (_e) {}
  };

  const displayBlocks = (on && map)
    ? (blocks || []).map((b, i) => {
        if (map[i] == null) return b;
        if (b.type === 'text') return { ...b, text: map[i] };
        if (b.type === 'voice') return { ...b, transcript: map[i] };
        return b;
      })
    : blocks;

  const button = items.length ? (
    <div className="msg-translate">
      <button className="act-btn translate" onClick={toggle}>{on ? 'english' : 'translate'}</button>
    </div>
  ) : null;

  return { displayBlocks, button };
}

/* ── Reply ───────────────────────────────────────────────────────────────── */
function Reply({ reply, handlers }: { reply: MessageEntry; handlers: Handlers }) {
  const showIdentity = !reply.isOwn;
  const [reported, setReported] = useState(false);
  const tr = useTranslate(reply.blocks || []);
  return (
    <div className="reply" data-msg-id={reply.id} data-own={reply.isOwn || undefined}>
      <div className="col">
        <div className="name-row" style={showIdentity ? undefined : { display: 'none' }}>
          <Avatar src={reply.user.img} />
          <AliaName
            name={reply.user.name}
            onMouseDown={reply.isOwn ? undefined : (e) => { if (e.detail >= 2) e.preventDefault(); }}
            onDoubleClick={reply.isOwn ? undefined : () => setReported((r) => !r)}
          />
          {reported ? <span className="reported-check" aria-label="reported"><span className="reported-noted">noted.</span><Icon name="check" size={18} /></span> : null}
        </div>
        {handlers.editingId === reply.id ? (
          /* editing IN PLACE — the editor mounts where the reply body was. */
          <div className="rb-edit-slot">{handlers.renderEditor(reply.id!)}</div>
        ) : (
          <>
            <Body entry={{ ...reply, blocks: tr.displayBlocks }} onDoubleClick={(e) => { e.stopPropagation(); if (reply.isOwn) { window.getSelection()?.removeAllRanges(); handlers.onEdit(reply.id!); } }} />
            {reply.edited ? <span className="edited">edited</span> : null}
            {tr.button}
          </>
        )}
      </div>
    </div>
  );
}



/* ── Message ─────────────────────────────────────────────────────────────── */
function Message({
  entry,
  prevAuthor,
  gap,
  isTarget,
  handlers,
}: {
  entry: MessageEntry;
  prevAuthor: string | null;
  gap: boolean | null;
  isTarget: boolean;
  handlers: Handlers;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const showIdentity = !entry.isOwn && entry.user.name !== prevAuthor;

  const tr = useTranslate(entry.blocks || []);
  const [reported, setReported] = useState(false);
  const dispBlocks = tr.displayBlocks;

  /* Per-cell reply context removed — media is now a block group of individual
     blocks; replies attach per BLOCK (see renderAfterBlock inside MediaGrid). */

  return (
    <div
      ref={rootRef}
      data-gap={gap || undefined}
      data-msg-id={entry.id}
      data-own={entry.isOwn || undefined}
      data-live-users={entry.interactions?.length || 0}
      className={`msg${isTarget ? ' msg-target' : ''}`}
    >
      <div className="msg-inner">
        <div className="msg-main">
          <div className="col">
            <div className="name-row" style={showIdentity ? undefined : { display: 'none' }}>
              <AliaAvatar src={entry.user.img} />
              <AliaName
                name={entry.user.name}
                onMouseDown={entry.isOwn ? undefined : (e) => { if (e.detail >= 2) e.preventDefault(); }}
                onDoubleClick={entry.isOwn ? undefined : () => setReported((r) => !r)}
              />
              {reported ? <span className="reported-check" aria-label="reported"><span className="reported-noted">noted.</span><Icon name="check" size={20} /></span> : null}
            </div>
            {handlers.editingId === entry.id ? (
              /* editing IN PLACE — the editor (with its unsend button) mounts
                 where the body was. */
              <div className="rb-edit-slot">{handlers.renderEditor(entry.id!)}</div>
            ) : (
              <>
                <Body
                  entry={{ ...entry, blocks: tr.displayBlocks }}
                  onDoubleClick={entry.isOwn ? () => { window.getSelection()?.removeAllRanges(); handlers.onEdit(entry.id!); } : undefined}
                  renderAfterBlock={(i) => {
                    const bid = entry.blocks[i]?.id;
                    const brs = (bid && entry.blockReplies?.[bid]) || [];
                    return (
                      <div className="block-reply-stack">
                        {handlers.renderBlockReplyComposer(entry.id!, i)}
                        {brs.map((r) => (
                          <div className="reply-zone-nested" key={r.id}>
                            <Reply reply={r} handlers={handlers} />
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                {entry.edited ? <span className="edited">edited</span> : null}
                {tr.button}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Feed ────────────────────────────────────────────────────────────────── */
export interface AliaMessagesProps {
  feed: MessageEntry[];
  mode: ReplyMode;
  onEdit: (id: string) => void;
  onUnsend: (id: string) => void;
  trailing?: React.ReactNode;
  /* in-place editor for a message / block-reply, keyed by id */
  renderEditor: (id: string) => React.ReactNode;
  /* the block-level reply composer — caret slot pinned under a block in a message */
  renderBlockReplyComposer: (msgId: string, blockIndex: number) => React.ReactNode;
}

export default function AliaMessages({ feed, mode, onEdit, onUnsend, trailing, renderEditor, renderBlockReplyComposer }: AliaMessagesProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const handlers: Handlers = { onEdit, onUnsend, renderEditor, renderBlockReplyComposer, editingId: mode.kind === 'edit' ? mode.targetId : null };

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

  // EDIT opens the editor in place; nothing dims. A top-level message being
  // edited is spotlighted; block-reply edits show their editor in place.
  const brightMsgId = mode.kind === 'edit' ? mode.targetId : null;

  let prevAuthor: string | null = null;
  let seenPost = false;

  return (
    <div className="feed flat-replies" ref={feedRef}>
      <div className="feed-spacer" />
      {feed.map((e, i) => {
        // Uniform message rhythm: every post after the first opens the same gap,
        // regardless of send time. (No timestamp-derived tiers.)
        const gap = seenPost ? true : null;
        seenPost = true;
        const msg = e as MessageEntry;
        const node = (
          <Message
            key={msg.id}
            entry={msg}
            prevAuthor={prevAuthor}
            gap={gap}
            isTarget={msg.id === brightMsgId}
            handlers={handlers}
          />
        );
        prevAuthor = msg.user.name;
        // the message's reply composer now renders INSIDE the message (below its
        // body, above its replies) — see <Message>. Here we just emit the message.
        return <div className="reply-zone" key={msg.id}>{node}</div>;
      })}
      {trailing ? <div className="rb-trailing-slot">{trailing}</div> : null}
    </div>
  );
}
