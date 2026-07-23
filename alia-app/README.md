# Alia — Next.js app (App Router)

Alia built on **Next.js 14 (App Router) + TypeScript + Tailwind**. No UI kit,
no animation library, no state library — the whole UI is hand-authored React +
CSS (see the deps in `package.json`: just next/react). One canonical component
layer (`src/*`) is shared by every screen: the `blocks/` library, `AliaMessages`,
`AliaMessageBlocks`, the plain-React `AliaComposerBlocks`, `data`, `icons`,
`identity`, etc.

## Editing rules (read before touching `src/`)

The shared `src/` layer is **dual-consumed**: Next.js builds it AND the root
`Alia App - <screen> -preview-.html` harnesses Babel-transpile the *same* files
in the browser with no build step. To keep both working:

- **Shared layer (`blocks/`, `screens/`, `composer/`, root components) uses
  relative imports ONLY** — no `@/` aliases, no new npm imports. Adding either
  builds fine in Next but silently breaks the browser previews.
- The `@/*` alias (→ `./src/*`) is used **only** in the thin `app/**/page.tsx`
  wrappers, which the previews don't load.
- Need a helper? Add it as a plain relative module and import it relatively.
  There is no `cn()` / `clsx` / shadcn — style with the existing CSS cascade.

```bash
npm install
cp .env.local.example .env.local   # optional — images work without it
npm run dev      # http://localhost:3000
npm run build    # type-checks the whole tree
```

## Routes

| Route | Screen | Source of truth |
| --- | --- | --- |
| `/` | Landing | `src/screens/Landing.tsx` (+ `SignInCorner`) |
| `/room` | **Room — smart composer** | `src/screens/RoomSmart.tsx` |
| `/apply` | Apply flow | `src/screens/ApplyFlow.tsx` (+ `ApplyCard`) |
| `/referral` | +1 Referral tool | `src/screens/ReferralTool.tsx` |
| `/referral-flow` | Referral flow (invite) | `src/screens/ReferralFlowSeed.tsx` |
| `/casting` | Casting flow (verdict) | `src/screens/CastingFlowSeed.tsx` |
| `/profile` | Member account card | `src/screens/Profile.tsx` |
| `/privacy` | Privacy (legal) | `src/screens/Legal.tsx` + `PRIVACY_HTML` |
| `/terms` | Terms (legal) | `src/screens/Legal.tsx` + `TERMS_HTML` |

Each route file (`src/app/**/page.tsx`) is thin: `'use client'` + a
`next/dynamic` import with `{ ssr: false }` (the screens are DOM / canvas /
localStorage heavy and must run client-side only). `/privacy` and `/terms` reuse
the one `Legal` screen, passing the HTML body + an `id`.

## Composer

There is **no TipTap** anywhere in this app. The Room composer
(`AliaComposerBlocks`) is plain React: a live in-feed caret you type into, Enter
commits a line as a block, and any block (text · photo · video · voice · link)
can be added in any order and drag-reordered. It stores, orders, and emits the
same shared `Block` type the feed renders (`types.ts`).

## Block library — one block, both places

Every content atom is a grab-and-use block in `src/blocks/`. The SAME blocks
render in the feed (`AliaMessages`) and in the composing pages, so a block looks
identical whether it's read or composed:

- `AliaText` · `AliaField` (self-formatting form line) · `AliaVoice` (record +
  play + transcript + karaoke; exports `AliaVoiceRecorder`) · `AliaVideo` ·
  `AliaPhoto` + `AliaMediaGrid` (1+ photos / mixed media) · `AliaAvatar` (with
  circular crop mode) · `AliaName` · `AliaLinkPreview` (scraped) ·
  `AliaLinkFallback` (label-only) · `AliaWrite` (ink pad).
- **Media primitives** live in `src/media.tsx` (NOT a block — no default export,
  renders nothing standalone): `Img` (bare image atom), `useZoomHold` (the
  pinch / ctrl-wheel lift-out gesture shared by `AliaPhoto`, `AliaVideo`,
  `AliaAvatar`), and `justifiedRows` + `MAX_PER_ROW` (the gallery packer used by
  `AliaMediaGrid` and the composer).
- **Block groups** assemble blocks for the feed: `AliaMessageBlocks` renders one
  committed block for display; `AliaMessages` is the whole feed (messages,
  replies, block-replies); `AliaComposerBlocks` is the Room composer. The shared
  avatar + display-name shell that frames every message is just `AliaAvatar` +
  `AliaName` placed in the message row.

## Structure

```
src/
  app/                 App Router: layout (global CSS + fonts + vendor scripts) + routes
  screens/             page components (RoomSmart, ApplyFlow, Landing, SignInCorner,
                       ReferralTool, ReferralFlowSeed, CastingFlowSeed, Profile, Legal)
  blocks/              the block library (AliaText, AliaField, AliaVoice, AliaVideo,
                       AliaPhoto, AliaMediaGrid, AliaAvatar, AliaName, AliaLinkPreview,
                       AliaLinkFallback, AliaWrite)
  media.tsx            shared media primitives (Img, useZoomHold, justifiedRows) —
                       imported by the media blocks; not itself a block
  composer/            links.ts only — URL detection + labelling (used by AliaComposerBlocks)
  <canonical components at root>  AliaMessages · AliaMessageBlocks · AliaComposerBlocks ·
                       ApplyCard · StickerLayer · data · icons · identity · fieldFormat ·
                       legalContent · types · utils
  styles/              the full CSS cascade (see below)
public/
  favicon.svg · sample-captions.vtt · icons/ · media/ (ambient-clip.mp4) ·
  vendor/ (voice-karaoke · page-pinch-guard · light-mode · smart-type)
```

## Room drawers

The Room has two edge-swipe drawers, portalled out of `#room` to `document.body`:

- **Right edge → Profile** (`Profile`). Vars/classes: `profile*` / `.room-profile-*`.
- **Left edge → Referral tool** (`ReferralTool`). Vars/classes: `referral*` / `.room-ref-*`.

Plus the swipe-up **StickerLayer** collage that overlays the whole room.

## CSS scoping

Global CSS is imported once, in cascade order, in `src/app/layout.tsx`:
`globals` (Tailwind) → `shell` → `messages` → `voice` → `composer` → `landing` →
`flow` → `room` → `stickers` → `responsive` → per-page sheets (`apply`,
`casting-flow`, `referral-flow`, `referral-tool`, `profile`, `legal`) →
`light-mode` (hidden Ctrl/⌘-L theme, last).

Page-specific sheets are scoped to their page root so nothing bleeds across
routes that share generic classes (`.flow-intro`, `.msg`, `.text`, …): `#room`,
`#landing`, `#profile`, `#casting-flow`, `#referral-flow`, `#referral-tool`, and
the legal roots (`#privacy` / `#terms`). Preflight (Tailwind reset) is disabled
(`tailwind.config.ts`) so it never touches the hand-authored styles; utilities
stay available for new work.

## Editing → preview loop

The design files here **are** the app's source. Preview harnesses live at the
project root (`Alia App - <screen> -preview-.html`) that load the *real* `src/`
files (stripping module syntax and Babel-transpiling in the browser, no build
step). Edit a component in `src/` and both the preview and the running
`npm run dev` app reflect it — one source of truth.

## Data / images

Images resolve from a public Supabase Storage bucket via `img()` in `src/data.ts`
(it reads `NEXT_PUBLIC_SUPABASE_URL` when set, else falls back to the known
public project, so images work with no `.env.local`). All screens should import
`img` from `data.ts` rather than rebuilding the base URL. There is no separate
Supabase client — the app currently runs on read-only mock data (`FEED`,
`MEMBER_IMGS`, `SHOT`). Voice recording / transcription uses the browser Web
Speech API where available (`createTranscriber`).

The sticker cut-out (`cutoutFromFile` in `blocks/AliaPhoto.tsx`) pulls
`@imgly/background-removal` from esm.sh via a runtime dynamic `import()` marked
`/* webpackIgnore: true */`, so the bundler leaves it as a native browser import
(no npm dep required); it falls back to the raw photo if the model can't load.
