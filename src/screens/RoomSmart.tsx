/* ───────────────────────────────────────────────────────────────────────────
   Room (v2) — the full live room, with the floating fob in place of the
   persistent composer.

   The feed and all of its affordances (reply / edit / unsend / lightbox) are
   intact. The bottom composer bar and hidden bottom nav are gone;
   in their place a single floating fob (<RoomFob>, the throw-in actions from the
   AliaComposerBlocks) composes text / photos / voice and posts straight into the
   feed through handleSend.
   ─────────────────────────────────────────────────────────────────────────── */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import type { Block, MessageEntry, SeedEntry } from '../types';
import { FEED, MEMBER_IMGS } from '../data';
import { nextId } from '../utils';
import AliaMessages, { ReplyMode } from '../AliaMessages';
import AliaComposerBlocks from '../AliaComposerBlocks';
import StickerLayer from '../StickerLayer';
import ReferralTool from './ReferralTool';
import Profile from './Profile';

const ME = { name: 'you', initials: 'JS', img: MEMBER_IMGS.JS };

/* ── Recursive feed helpers (messages + their replies share a shape) ─────── */

function mapEntry(feed: MessageEntry[], id: string, fn: (m: MessageEntry) => MessageEntry): MessageEntry[] {
  const mapMsg = (m: MessageEntry): MessageEntry => {
    let next = m.id === id ? fn(m) : m;
    if (next.blockReplies) {
      let changed = false;
      const entries = Object.entries(next.blockReplies).map(([bid, list]) => {
        const nl = list.map(mapMsg);
        if (nl.some((x, i) => x !== list[i])) { changed = true; return [bid, nl] as const; }
        return [bid, list] as const;
      });
      if (changed) next = { ...next, blockReplies: Object.fromEntries(entries) };
    }
    return next;
  };
  return feed.map((e) => mapMsg(e));
}

function removeEntry(feed: MessageEntry[], id: string): MessageEntry[] {
  const pruneMsg = (m: MessageEntry): MessageEntry => {
    let next = m;
    if (next.blockReplies) next = { ...next, blockReplies: Object.fromEntries(Object.entries(next.blockReplies).map(([bid, list]) => [bid, list.filter((r) => r.id !== id).map(pruneMsg)])) };
    return next;
  };
  return feed
    .filter((e) => e.id !== id)
    .map((e) => pruneMsg(e));
}

/** Find a message (or block reply) by id. */
function findEntry(feed: MessageEntry[], id: string): MessageEntry | null {
  const inMsg = (m: MessageEntry): MessageEntry | null => {
    if (m.id === id) return m;
    if (m.blockReplies) for (const list of Object.values(m.blockReplies)) { for (const r of list) { const f = inMsg(r); if (f) return f; } }
    return null;
  };
  for (const e of feed) {
    const f = inMsg(e);
    if (f) return f;
  }
  return null;
}

/** Append a block reply pinned to the block at `blockIndex` of a top-level
    message — stored under that block's STABLE id, so it follows the block. */
function addBlockReply(feed: MessageEntry[], msgId: string, blockIndex: number, reply: MessageEntry): MessageEntry[] {
  return feed.map((e) => {
    const m = e as MessageEntry;
    if (m.id !== msgId) return m;
    const bid = m.blocks[blockIndex]?.id;
    if (!bid) return m;
    const br = { ...(m.blockReplies || {}) };
    br[bid] = [...(br[bid] || []), reply];
    return { ...m, blockReplies: br };
  });
}

/* Where the one smart composer currently lives. `top` = the feed tail (a new
   message); `block` = a block-reply caret pinned under a specific block. */
type CaretTarget = { kind: 'top' } | { kind: 'block'; msgId: string; blockIndex: number };

/* Deterministic, position-based ids for the SEED feed so a persisted caret /
   reply draft still lines up after a full reload (the default nextId() is
   time-based and changes every load). Runtime-created messages keep nextId(). */
function stableSeed(entries: SeedEntry[], prefix = 's'): MessageEntry[] {
  return entries.map((e, i) => {
    const id = e.id ?? prefix + i;
    // stamp a deterministic, stable id onto every block so block-replies can
    // pin to it (and survive a reload with the position-based caret).
    const blocks = (e.blocks || []).map((b, bi) => ({ ...b, id: b.id ?? id + ':b' + bi }));
    const withId = { ...e, id, blocks } as MessageEntry;
    // authored positionally (array indexed by block position) → id-keyed record
    if (Array.isArray(e.blockReplies)) {
      const rec: Record<string, MessageEntry[]> = {};
      e.blockReplies.forEach((list, bi) => {
        if (!list || !list.length) return;
        const bid = blocks[bi]?.id;
        if (bid) rec[bid] = stableSeed(list, id + '.b' + bi + '.');
      });
      withId.blockReplies = rec;
    }
    return withId;
  });
}

export default function RoomSmart() {
  const [feed, setFeed] = useState<MessageEntry[]>(() => {
    const seeded = stableSeed(FEED);
    // Demo: one block reply pinned under the photo (block 1) of the opening
    // message — keyed by that block's stable id, so it stays put after an edit.
    return seeded.map((e, i) => {
      if (i !== 0) return e;
      const m = e as MessageEntry;
      const bid = m.blocks[1]?.id;
      if (!bid) return m;
      return {
        ...m,
        blockReplies: {
          [bid]: [{
            id: 'bs0.b1.0',
            ts: (m.ts || Date.now()) + 60000,
            user: { name: 'Adaeze Vance', initials: 'AV', img: MEMBER_IMGS.AV },
            isOwn: false,
            blocks: [{ type: 'text', text: 'this is the one. bench-core but you can actually wear it' }],
            interactions: [],
          }],
        },
      };
    });
  });
  const [mode, setMode] = useState<ReplyMode>({ kind: 'idle' });

  /* ── Multi-touch guard ────────────────────────────────────────────────────
     A pinch-zoom / pan (2+ fingers on a photo or clip) must NEVER be read as a
     drawer swipe. We track live touch points at the window; while more than one
     finger is down we are 'pinching', and the edge-swipe handlers stand down
     (any swipe already in progress is cancelled). */
  const activeTouches = useRef(0);
  const pinchingRef = useRef(false);

  /* ── Profile drawer — a SWIPE-triggered sheet on the X axis (RIGHT edge) ───
     An in-place drawer (not a page nav). It is not dragged: a horizontal swipe
     (flick) sends it, and it then GLIDES the whole way on a long ease — so it
     never snaps to the end. Swipe left from the right edge to send it in; swipe
     right on its left grip to send it back out. The drawer element is always
     present (so the transform can animate); only the Profile inside mounts
     while it's live, staying mounted through the glide-out. */
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMounted, setProfileMounted] = useState(false);
  const profileCloseTimer = useRef<number | null>(null);
  const profileSwipe = useRef<{ x: number; y: number; mode: 'open' | 'close'; done: boolean } | null>(null);
  const openProfile = () => {
    if (profileCloseTimer.current) { window.clearTimeout(profileCloseTimer.current); profileCloseTimer.current = null; }
    setProfileMounted(true); setProfileOpen(true);
  };
  const closeProfile = () => {
    setProfileOpen(false);
    if (profileCloseTimer.current) window.clearTimeout(profileCloseTimer.current);
    profileCloseTimer.current = window.setTimeout(() => { setProfileMounted(false); profileCloseTimer.current = null; }, 360);
  };
  useEffect(() => () => { if (profileCloseTimer.current) window.clearTimeout(profileCloseTimer.current); }, []);

  const profileDown = (mode: 'open' | 'close') => (e: React.PointerEvent) => {
    if (pinchingRef.current || activeTouches.current > 1 || (window as any).__aliaZoomActive) return;   // a pinch / lifted media is not a swipe
    profileSwipe.current = { x: e.clientX, y: e.clientY, mode, done: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (_e) {}
  };
  const profileMove = (e: React.PointerEvent) => {
    const s = profileSwipe.current; if (!s || s.done) return;
    if (pinchingRef.current || activeTouches.current > 1 || (window as any).__aliaZoomActive) { profileSwipe.current = null; return; }  // pinch / lifted media → abort
    // exactly the sticker drawer's rule: a small directional travel sends it.
    // open = swipe left (28px), close = swipe right (40px). No axis guard.
    const dx = s.mode === 'open' ? s.x - e.clientX : e.clientX - s.x;
    const need = s.mode === 'open' ? 28 : 40;
    if (dx > need) { s.done = true; (s.mode === 'open' ? openProfile() : closeProfile()); }
  };
  const profileUp = () => { profileSwipe.current = null; };
  const onProfileEdgeDown = profileDown('open');
  const onProfileCloseDown = profileDown('close');

  /* Trackpad path — the sticker drawer's other input. A two-finger swipe fires
     WHEEL events (deltaX), not a pointer drag, so we accumulate horizontal intent
     exactly like the sticker's swipe zone does with deltaY. Swipe left (deltaX > 0
     in the natural-scroll convention the sticker uses) opens; swipe right closes. */
  const profileEdgeRef = useRef<HTMLButtonElement>(null);
  const profileDrawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zone = profileEdgeRef.current, drawer = profileDrawerRef.current;
    let acc = 0, lastT = 0;
    const tick = () => { const n = performance.now(); if (n - lastT > 240) acc = 0; lastT = n; };
    const openW = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // vertical intent — leave it
      tick();
      if (e.deltaX > 0) { acc += e.deltaX; e.preventDefault(); if (acc > 46) { openProfile(); acc = 0; } }
      else acc = 0;
    };
    const closeW = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;   // let the note scroll vertically
      tick();
      if (e.deltaX < 0) { acc += -e.deltaX; e.preventDefault(); if (acc > 46) { closeProfile(); acc = 0; } }
      else acc = 0;
    };
    zone && zone.addEventListener('wheel', openW, { passive: false });
    drawer && drawer.addEventListener('wheel', closeW, { passive: false });
    return () => {
      zone && zone.removeEventListener('wheel', openW);
      drawer && drawer.removeEventListener('wheel', closeW);
    };
  }, []);

  /* ── Referral Tool drawer — the MIRROR of the Profile, on the LEFT edge. ───
     Same threshold-swipe + glide, flipped: swipe RIGHT from the left edge to
     send it in; swipe LEFT on its right grip to send it back out. Opposite
     behaviour of the Profile in every axis. */
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralMounted, setReferralMounted] = useState(false);
  const referralCloseTimer = useRef<number | null>(null);
  const referralSwipe = useRef<{ x: number; y: number; mode: 'open' | 'close'; done: boolean } | null>(null);
  const openReferral = () => {
    if (referralCloseTimer.current) { window.clearTimeout(referralCloseTimer.current); referralCloseTimer.current = null; }
    setReferralMounted(true); setReferralOpen(true);
  };
  const closeReferral = () => {
    setReferralOpen(false);
    if (referralCloseTimer.current) window.clearTimeout(referralCloseTimer.current);
    referralCloseTimer.current = window.setTimeout(() => { setReferralMounted(false); referralCloseTimer.current = null; }, 360);
  };
  useEffect(() => () => { if (referralCloseTimer.current) window.clearTimeout(referralCloseTimer.current); }, []);

  const referralDown = (mode: 'open' | 'close') => (e: React.PointerEvent) => {
    if (pinchingRef.current || activeTouches.current > 1 || (window as any).__aliaZoomActive) return;   // a pinch / lifted media is not a swipe
    referralSwipe.current = { x: e.clientX, y: e.clientY, mode, done: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (_e) {}
  };
  const referralMove = (e: React.PointerEvent) => {
    const s = referralSwipe.current; if (!s || s.done) return;
    if (pinchingRef.current || activeTouches.current > 1 || (window as any).__aliaZoomActive) { referralSwipe.current = null; return; }  // pinch / lifted media → abort
    // mirror of the profile rule: open = swipe RIGHT (28px), close = swipe LEFT (40px).
    const dx = s.mode === 'open' ? e.clientX - s.x : s.x - e.clientX;
    const need = s.mode === 'open' ? 28 : 40;
    if (dx > need) { s.done = true; (s.mode === 'open' ? openReferral() : closeReferral()); }
  };
  const referralUp = () => { referralSwipe.current = null; };
  const onReferralEdgeDown = referralDown('open');
  const onReferralCloseDown = referralDown('close');

  /* Live touch-point counter for the multi-touch guard above. Capture-phase so
     it runs before the edge zones' own pointer handlers on the same gesture. */
  useEffect(() => {
    const inc = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activeTouches.current += 1;
      if (activeTouches.current > 1) { pinchingRef.current = true; profileSwipe.current = null; referralSwipe.current = null; }
    };
    const dec = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activeTouches.current = Math.max(0, activeTouches.current - 1);
      if (activeTouches.current === 0) pinchingRef.current = false;
    };
    window.addEventListener('pointerdown', inc, true);
    window.addEventListener('pointerup', dec, true);
    window.addEventListener('pointercancel', dec, true);
    return () => {
      window.removeEventListener('pointerdown', inc, true);
      window.removeEventListener('pointerup', dec, true);
      window.removeEventListener('pointercancel', dec, true);
    };
  }, []);

  /* Trackpad path — mirror of the profile wheel accumulator. Swipe RIGHT
     (deltaX < 0) on the left edge opens; swipe LEFT (deltaX > 0) closes. */
  const referralEdgeRef = useRef<HTMLButtonElement>(null);
  const referralDrawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zone = referralEdgeRef.current, drawer = referralDrawerRef.current;
    let acc = 0, lastT = 0;
    const tick = () => { const n = performance.now(); if (n - lastT > 240) acc = 0; lastT = n; };
    const openW = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      tick();
      if (e.deltaX < 0) { acc += -e.deltaX; e.preventDefault(); if (acc > 46) { openReferral(); acc = 0; } }
      else acc = 0;
    };
    const closeW = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      tick();
      if (e.deltaX > 0) { acc += e.deltaX; e.preventDefault(); if (acc > 46) { closeReferral(); acc = 0; } }
      else acc = 0;
    };
    zone && zone.addEventListener('wheel', openW, { passive: false });
    drawer && drawer.addEventListener('wheel', closeW, { passive: false });
    return () => {
      zone && zone.removeEventListener('wheel', openW);
      drawer && drawer.removeEventListener('wheel', closeW);
    };
  }, []);

  /* ── The single "smart" composer ─────────────────────────────────────────
     There is ONE composer. `caret` says where it is right now; tapping any
     black tap-zone moves it there. `dirty` (reported by the composer) means it
     holds unsent content — while dirty the caret is LOCKED in place: taps on
     other zones are refused (and the parked composer gives a small nudge) until
     you send or clear. An empty composer moves freely. */
  const CARET_KEY = 'alia.room.caret';
  const [caret, setCaret] = useState<CaretTarget>(() => {
    try {
      const raw = window.localStorage.getItem(CARET_KEY);
      if (raw) { const c = JSON.parse(raw); if (c && (c.kind === 'top' || (c.kind === 'block' && c.msgId))) return c; }
    } catch (_e) {}
    return { kind: 'top' };
  });
  const [dirty, setDirty] = useState(false);
  const [nudge, setNudge] = useState(false);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const slotLiveRef = useRef<HTMLDivElement>(null);
  /* A single always-mounted, invisible input. Mobile browsers only raise the
     keyboard when focus() runs synchronously inside the tap gesture — but the
     real .rb-live doesn't exist yet at tap time (it mounts after setCaret). So
     we focus this proxy inside the tap to summon the keyboard, then the caret
     effect below hands focus to .rb-live once it mounts. The keyboard stays up
     across that handoff, so a single tap lands a live cursor. */
  const proxyRef = useRef<HTMLInputElement>(null);

  /* Persist where the caret lives so a full reload reopens it in the same slot
     (the composer itself restores its own draft content there). */
  useEffect(() => {
    try { window.localStorage.setItem(CARET_KEY, JSON.stringify(caret)); } catch (_e) {}
  }, [caret]);

  /* If a restored caret points at a block that no longer exists, come home. */
  useEffect(() => {
    if (caret.kind === 'block') {
      const m = findEntry(feed, caret.msgId);
      if (!m || caret.blockIndex >= (m.blocks?.length || 0)) setCaret({ kind: 'top' });
    }
  }, [caret, feed]);

  /* The caret landing in a slot now only OPENS the composer there — it no longer
     steals focus or raises the mobile keyboard. Typing starts when the user taps
     into the live line (native contentEditable focus), so a first tap is a quiet
     open and a second tap (into the composer) commits to typing. */

  const atTop = caret.kind === 'top';
  const isCaretAt = (t: CaretTarget) =>
    t.kind === 'top' ? atTop
    : (caret.kind === 'block' && caret.msgId === t.msgId && caret.blockIndex === t.blockIndex);

  /* Tap a zone → move the caret there. Refused while a draft is unresolved. */
  const moveCaret = (t: CaretTarget) => {
    if (isCaretAt(t)) return;                 // already here
    if (dirtyRef.current) {                    // locked: resolve the draft first
      setNudge(true);
      window.setTimeout(() => setNudge(false), 460);
      return;
    }
    if (mode.kind === 'edit') setMode({ kind: 'idle' });
    /* No proxy focus: opening the composer must NOT raise the keyboard. */
    setCaret(t);
  };

  /* ── Draft send — split by surface ───────────────────────────────────────
     At the tail the composer posts a NEW top-level message (or replaces content
     when editing). Parked under a message it posts a reply, then the caret
     returns home to the tail. */
  const handleSendTop = (blocks: Block[]) => {
    if (!blocks.length) { setMode({ kind: 'idle' }); return; }
    const msg: MessageEntry = { id: nextId(), ts: Date.now(), user: ME, isOwn: true, blocks, interactions: [] };
    setFeed((f) => [...f, msg]);
    setMode({ kind: 'idle' });
    setDirty(false);
  };

  /* Edit posts in place, replacing the target's blocks, then closes. Block
     replies are keyed by block id, so reordered blocks keep their replies; any
     block dropped in the edit has its id vanish from `blocks`, so we prune its
     replies here (delete-a-block deletes its block replies). */
  const handleSendEdit = (targetId: string, blocks: Block[]) => {
    if (blocks.length) setFeed((f) => mapEntry(f, targetId, (m) => {
      const liveIds = new Set(blocks.map((b) => b.id).filter(Boolean) as string[]);
      const br = m.blockReplies
        ? Object.fromEntries(Object.entries(m.blockReplies).filter(([bid]) => liveIds.has(bid)))
        : m.blockReplies;
      return { ...m, blocks, blockReplies: br, edited: true };
    }));
    setMode({ kind: 'idle' });
    setDirty(false);
  };

  /* A block reply pins under a specific block; caret comes home after sending. */
  const handleSendBlock = (msgId: string, blockIndex: number, blocks: Block[]) => {
    if (!blocks.length) return;
    const reply: MessageEntry = { id: nextId(), ts: Date.now(), user: ME, isOwn: true, blocks, interactions: [] };
    setFeed((f) => addBlockReply(f, msgId, blockIndex, reply));
    setDirty(false);
    setCaret({ kind: 'top' });
  };

  /* ── Feed-driven actions ─────────────────────────────────────────────────*/
  /* Long-press a message you own → the editor opens IN PLACE, below it (the
     composer is rendered into that message's own slot, preloaded with its
     content). The caret stays where it is; a dirty draft elsewhere blocks the
     switch (its draft is persisted, so nothing is lost). */
  const handleEdit = (id: string) => {
    if (mode.kind === 'edit' && mode.targetId === id) return;   // already editing this
    if (dirtyRef.current) {                                      // resolve the open draft first
      setNudge(true);
      window.setTimeout(() => setNudge(false), 460);
      return;
    }
    setMode({ kind: 'edit', targetId: id });
  };

  const handleUnsend = (id: string) => {
    setFeed((f) => removeEntry(f, id));
    if (mode.kind === 'edit' && mode.targetId === id) { setMode({ kind: 'idle' }); setDirty(false); }
    // a sticker stuck on this message goes away with it
    try { window.dispatchEvent(new CustomEvent('alia:message-unsent', { detail: { id } })); } catch (_e) {}
  };

  /* Edit preloads the target's content into the builder. */
  const editTarget = mode.kind === 'edit' ? findEntry(feed, mode.targetId) : null;
  const editItems = editTarget ? editTarget.blocks : undefined;

  /* The one composer instance, re-parented into whichever slot the caret is in.
     It only ever unmounts/remounts while empty (dirty locks moves), so no draft
     is lost across a move. */
  const liveComposer = (onSend: (blocks: Block[]) => void, replyMode: ReplyMode | { kind: 'reply'; targetId: string }, onUnsend?: () => void) => (
    <div className={'rb-slot-live' + (nudge ? ' rb-nudge' : '')} ref={slotLiveRef}>
      <AliaComposerBlocks
        inline
        onSend={onSend}
        onUnsend={onUnsend}
        onDirty={setDirty}
        replyMode={replyMode as any}
        editItems={replyMode.kind === 'edit' ? editItems : undefined}
      />
    </div>
  );

  return (
    <div className="app-root" id="room">
      {/* Off-screen keyboard proxy — focused synchronously on tap (see moveCaret). */}
      <input
        ref={proxyRef}
        className="rb-kbd-proxy"
        aria-hidden="true"
        tabIndex={-1}
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="screen">
        <AliaMessages
          feed={feed}
          mode={mode}
          onEdit={handleEdit}
          onUnsend={handleUnsend}
          renderEditor={(targetId) =>
            liveComposer((items) => handleSendEdit(targetId, items), { kind: 'edit', targetId }, () => handleUnsend(targetId))
          }
          renderBlockReplyComposer={(msgId, blockIndex) =>
            mode.kind !== 'edit' && isCaretAt({ kind: 'block', msgId, blockIndex })
              ? liveComposer((items) => handleSendBlock(msgId, blockIndex, items), { kind: 'reply', targetId: msgId + '#b' + blockIndex })
              : (
                <button
                  className="rb-tapzone"
                  aria-label="reply to this"
                  onClick={() => moveCaret({ kind: 'block', msgId, blockIndex })}
                />
              )
          }
          trailing={
            atTop && mode.kind !== 'edit'
              ? liveComposer(handleSendTop, { kind: 'idle' })
              : (
                <button
                  className="rb-tapzone rb-tapzone-bottom"
                  aria-label="new message"
                  onClick={() => moveCaret({ kind: 'top' })}
                />
              )
          }
        />
      </div>

      {/* Invisible right-edge zone — drag left to pull the Profile in. */}
      <button
        ref={profileEdgeRef}
        className="room-profile-edge-swipe"
        aria-label="open profile"
        type="button"
        onPointerDown={onProfileEdgeDown}
        onPointerMove={profileMove}
        onPointerUp={profileUp}
        onPointerCancel={profileUp}
      />

      {/* Profile drawer — portalled OUT of #room (so the room's scoped
         !important rules can't reach it). A swipe toggles it;
         it then glides the whole way via CSS (see .room-profile-drawer). */}
      {ReactDOM.createPortal(
        <div
          ref={profileDrawerRef}
          className={'room-profile-drawer' + (profileOpen ? ' open' : '')}
          aria-hidden={!profileOpen}
        >
          {profileMounted ? <Profile /> : null}
          <button
            className="room-profile-close-edge"
            aria-label="close profile"
            type="button"
            onPointerDown={onProfileCloseDown}
            onPointerMove={profileMove}
            onPointerUp={profileUp}
            onPointerCancel={profileUp}
          />
        </div>,
        document.body,
      )}

      {/* Invisible left-edge zone — drag right to pull the Referral Tool in
         (mirror of the profile right-edge zone). */}
      <button
        ref={referralEdgeRef}
        className="room-ref-edge-swipe"
        aria-label="open referral tool"
        type="button"
        onPointerDown={onReferralEdgeDown}
        onPointerMove={referralMove}
        onPointerUp={referralUp}
        onPointerCancel={referralUp}
      />

      {/* Referral Tool drawer — portalled OUT of #room, slides in from the LEFT. A
         swipe toggles it; it then glides via CSS (see .room-ref-drawer). */}
      {ReactDOM.createPortal(
        <div
          ref={referralDrawerRef}
          className={'room-ref-drawer' + (referralOpen ? ' open' : '')}
          aria-hidden={!referralOpen}
        >
          {referralMounted ? <ReferralTool /> : null}
          <button
            className="room-ref-close-edge"
            aria-label="close referral tool"
            type="button"
            onPointerDown={onReferralCloseDown}
            onPointerMove={referralMove}
            onPointerUp={referralUp}
            onPointerCancel={referralUp}
          />
        </div>,
        document.body,
      )}

      {/* Sticker presence layer + swipe-up drawer (overlays the whole room) */}
      <StickerLayer />
    </div>
  );
}
