/* ───────────────────────────────────────────────────────────────────────────
   shared/chat.tsx — chat-transcript primitives shared by the conversational
   pages (Application, Profile, OTP, onboarding flows).

   These are the lighter-weight counterparts to AliaMessages: a one-identity
   message row (avatar · name · body) and a typing bubble, with NO hearts /
   orbit / replies / actions. Message bodies reuse <MessageBlock> so text,
   media, and voice render identically to the Room feed.
   ─────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import type { Block } from '../types';
import { blockKind, gapClass } from '../utils';
import MessageBlock, { MediaOpen } from '../MessageBlocks';

export interface ChatAction {
  id: string;
  label: string;
}

export interface ChatEntry {
  id: string;
  /** 'alia' = the Alia bot, 'me' = the current user (no avatar). */
  who: 'alia' | 'me' | 'them';
  name?: string;
  img?: string;
  /** Standard body: an ordered list of message blocks. */
  blocks?: Block[];
  /** Escape hatch: render arbitrary JSX as the body (page-specific cards). */
  body?: React.ReactNode;
  /** Quick-reply buttons rendered under the body (`.opt-btns`). */
  actions?: ChatAction[];
  /** Disable the quick-reply buttons (after one is chosen). */
  actionsDisabled?: boolean;
  /** Hide avatar + name (consecutive message from same sender). */
  continued?: boolean;
  /** Entrance animation flag. */
  entering?: boolean;
}

function ChatBody({ blocks, onOpenMedia }: { blocks: Block[]; onOpenMedia?: MediaOpen }) {
  return (
    <div className="body">
      {blocks.map((b, i) => {
        const prev = i > 0 ? blockKind(blocks[i - 1].type) : null;
        const cls = gapClass(prev, blockKind(b.type));
        return <MessageBlock key={i} block={b} cls={cls} onOpenMedia={onOpenMedia} />;
      })}
    </div>
  );
}

export function ChatMessage({ entry, onOpenMedia, onAction }: { entry: ChatEntry; onOpenMedia?: MediaOpen; onAction?: (actionId: string, entryId: string) => void }) {
  const isMe = entry.who === 'me';
  const showIdentity = !isMe && !entry.continued;
  return (
    <div className={`msg${entry.entering ? ' enter-up' : ''}`}>
      <div className="msg-inner">
        <div className="avatar-col" style={{ visibility: showIdentity ? undefined : 'hidden' }}>
          <div className="avatar-sticky">
            <div className="avatar">
              {entry.img ? <img className={entry.who === 'alia' ? 'alia' : entry.who === 'them' ? 'friend' : undefined} src={entry.img} alt="" /> : null}
            </div>
          </div>
        </div>
        <div className="col">
          {showIdentity && entry.name ? (
            <div className="name-row"><span className="name">{entry.name}</span></div>
          ) : null}
          {entry.body !== undefined ? (
            <div className="body">{entry.body}</div>
          ) : (
            <ChatBody blocks={entry.blocks || []} onOpenMedia={onOpenMedia} />
          )}
          {entry.actions && entry.actions.length ? (
            <div className="opt-btns">
              {entry.actions.map((a) => (
                <button
                  key={a.id}
                  className="opt-btn"
                  disabled={entry.actionsDisabled}
                  onClick={() => onAction?.(a.id, entry.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
