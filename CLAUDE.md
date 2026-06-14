# CLAUDE.md

Instructions for **Claude Code** working in the Alia repo. Follow these rules.

Alia is a client-side React app (8 mobile screens + 2 legal docs) sharing one
component system and a single TipTap composer. Stack: **Next.js (Pages Router) +
TypeScript + Tailwind + Supabase**. It was migrated from Vite; **keeping the
existing visual design identical is the prime directive**.

---

## Workflow — do this every time

1. **Read before editing.** Open the file and the things it imports. The
   architecture is shared (one composer, one message system, one shell) — a local
   change can ripple. Trace it first.
2. **Match the existing pattern.** Copy the conventions already in the file you're
   editing — naming, CSS approach, file layout. Don't introduce a second way of
   doing something that already has a way.
3. **Make the smallest change that works.** Don't refactor adjacent code, rename
   things, or "tidy up" unless asked.
4. **Verify with `npm run build`** before saying a change is done — it
   type-checks the whole tree. If you touched a screen, also describe how to
   click through it (`npm run dev`, http://localhost:3000).
5. **Ask before**: changing visual design, adding a dependency, changing routing,
   adding a backend table/endpoint, or anything touching `src/composer/engine.ts`.

## Commands

```bash
npm run dev      # next dev — localhost:3000
npm run build    # next build — TYPE-CHECKS everything; run before declaring done
npm run start    # serve production build
npm run lint     # next lint
```

---

## ALWAYS

- **Preserve the design.** Spacing, colour, type, layout, and copy stay exactly
  as-is unless the task explicitly says to change them.
- **Keep route files thin.** A file in `src/pages/*.tsx` should only
  `dynamic()`-import its screen with `{ ssr: false }` and render it. Logic goes in
  the screen (`src/screens/`), not the route.
- **Put screen components in `src/screens/`**, helpers in `src/`, the Supabase
  client in `src/lib/`.
- **Import global CSS only in `src/pages/_app.tsx`**, and keep the existing import
  order (base components → shared layers → responsive → light-mode → Tailwind
  last). Pages Router forbids global CSS anywhere else.
- **Load browser-only side-effects inside a `useEffect`** (see the vendor imports
  in `_app.tsx`), never at module scope — module scope runs during build.
- **Reuse the shared system.** Edit the one composer / one message renderer / one
  shell, not a per-screen copy. Restyle `src/styles/messages.css` etc. once and
  every feed updates.
- **Import `React` explicitly** in components (tsconfig uses `jsx: preserve`).
- **Drive Supabase + image URLs from env** (`NEXT_PUBLIC_SUPABASE_*`); never
  hardcode a second project URL.

## NEVER

- **Never restyle or relayout screens** as a side-effect of another task.
- **Never put a screen component directly in `src/pages/`** — Next will turn it
  into an unwanted route. Screens live in `src/screens/`.
- **Never remove `{ ssr: false }`** from a route, or add `getServerSideProps` /
  `getStaticProps` to these pages. The screens are client-only (DOM, canvas,
  `localStorage`, TipTap) and will crash during SSR.
- **Never add `'use client'`** — that's App Router; this is Pages Router.
- **Never reintroduce `react-router`** — routing is file-based.
- **Never re-enable Tailwind preflight** (`tailwind.config.ts`) — its reset would
  alter the design. The app's reset is `src/shared/shell.css`.
- **Never reorder or scatter the global CSS imports** in `_app.tsx`.
- **Never fork the composer.** Don't duplicate `src/composer/engine.ts` per
  screen; select behaviour with its `mode` prop.
- **Never commit secrets.** `.env.local` is gitignored; use
  `.env.local.example` for placeholders.

---

## Map

| Area | Where |
| --- | --- |
| Router (thin, `ssr:false`) | `src/pages/*.tsx` |
| App shell: global CSS + viewport + vendor side-effects | `src/pages/_app.tsx` |
| `<html lang>`, fonts, favicon | `src/pages/_document.tsx` |
| Screen components | `src/screens/*.tsx` |
| Room screen + feed orchestration | `src/Room.tsx` |
| Composer (TipTap, all modes) | `src/composer/engine.ts` |
| Message rendering | `src/MessageBlocks.tsx`, `src/AliaVoice.tsx` |
| Shared CSS layers | `src/styles/*`, `src/shared/*`, `src/room.css`, `src/responsive.css` |
| Icons (React source) | `src/icons.tsx` |
| Data + `img()` helper | `src/data.ts` |
| Supabase client | `src/lib/supabase.ts` |
| Client-only vendor JS | `src/vendor/*` |

Routes: `/` Landing · `/room` · `/application` · `/profile` · `/signin` (OTP) ·
`/p2p-onboarding` · `/casting-onboarding` · `/referral` · `/privacy` · `/terms`.
Cross-page nav uses `window.location.href = '/route'` (full reload) — that's
intentional.

## Gotchas

- The composer engine uses `any` in a few spots by design — don't "fix" it into
  failing the build.
- Voice recording / transcripts are **simulated** (no mic / STT). Wire the
  engine's hooks to real capture when building that feature — and ask first.
- Hidden **Ctrl/⌘-L** light theme is initialised client-side in `_app.tsx`.
- Images load from the public Supabase bucket even with no `.env.local`, via the
  fallback in `src/data.ts`. Auth/DB calls need the real keys set.
