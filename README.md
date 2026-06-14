# Alia — Next.js

Migrated from **Vite + React** to **Next.js (Pages Router) + TypeScript + Tailwind**, with **Supabase** wired in. **The design is unchanged** — same components, same CSS, same screens.

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase keys
npm run dev      # http://localhost:3000
```

`npm run build` type-checks and builds for production; `npm run start` serves it. Deploy to Vercel by importing the repo — zero config needed.

## Routes

Hash routing (`HashRouter`) was replaced with the file-based **Pages Router**. Each route renders its screen client-side (`next/dynamic` with `ssr: false`) because the screens use the DOM, canvas, `localStorage` and the TipTap composer — this preserves the original SPA behaviour exactly.

| Route | Screen | Source |
| --- | --- | --- |
| `/` | Landing | `src/screens/Landing.tsx` |
| `/room` | Room | `src/Room.tsx` |
| `/application` | Casting application | `src/screens/Application.tsx` |
| `/profile` | Profile | `src/screens/Profile.tsx` |
| `/signin` | Sign in (OTP) | `src/screens/Otp.tsx` |
| `/p2p-onboarding` | Friend (P2P) onboarding | `src/screens/P2POnboarding.tsx` |
| `/casting-onboarding` | Casting onboarding | `src/screens/CastingOnboarding.tsx` |
| `/referral` | P2P referral | `src/screens/P2PReferral.tsx` |
| `/privacy` | Privacy Policy | `src/screens/Legal.tsx` |
| `/terms` | Terms of Service | `src/screens/Legal.tsx` |

Cross-page links that used to point at the exported `*.html` files now point at these routes (`/signin`, `/application`, `/terms`, …).

## What changed in the migration

| Vite | Next.js |
| --- | --- |
| `index.html` | `src/pages/_document.tsx` (fonts, favicon) + `_app.tsx` (viewport, title) |
| `src/main.tsx` (CSS stack + vendor side-effects + mount) | `src/pages/_app.tsx` |
| `src/App.tsx` (`HashRouter` route table) | `src/pages/*.tsx` (file-based routes) |
| `src/pages/*` (screen components) | `src/screens/*` (renamed so they don't collide with the router) |
| `vite.config.ts` | `next.config.mjs` |
| `react-router-dom` | removed (file-based routing) |
| — | `tailwindcss`, `postcss`, `autoprefixer` added |
| — | `@supabase/supabase-js` added (`src/lib/supabase.ts`) |

Everything else — every component under `src/`, the composer engine, all CSS — was copied across untouched.

## Structure

```
src/
  pages/              Next.js router (thin: each route dynamic-imports its screen)
    _app.tsx          global CSS stack (order matters) + vendor side-effects + viewport
    _document.tsx     <html lang> · Google Fonts · favicon
    index · room · application · profile · signin · p2p-onboarding ·
    casting-onboarding · referral · privacy · terms
  screens/            the screen components (was src/pages/ under Vite)
  styles/             messages · voice · composer-styles · light-mode · globals (Tailwind)
  shared/             shell · chat · onboarding · referral · landing · legal layers
  vendor/             voice-karaoke.js · light-mode.js (client-only side-effects)
  lib/supabase.ts     Supabase client (reads NEXT_PUBLIC_SUPABASE_* )
  Room.tsx · AliaComposer.tsx · AliaMessages.tsx · … (unchanged components)
public/               favicon.svg + icons/
```

## Tailwind

Tailwind is installed and ready (`src/styles/globals.css`, `tailwind.config.ts`). **Preflight (Tailwind's base reset) is disabled** so it does not touch the existing hand-authored styles — the app ships its own reset in `shared/shell.css`. All utilities/components are available for new work; re-enable preflight only if you retire the legacy CSS.

## Supabase

`src/lib/supabase.ts` exports a configured client from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The image helper (`img()` in `src/data.ts`) now derives its bucket base from `NEXT_PUBLIC_SUPABASE_URL`, falling back to the existing public project so images keep loading with no config. Set both vars in `.env.local` to enable auth / database / storage.

## Notes

- The voice "recording" and transcripts are still simulated (no mic / STT) — wire `src/composer/engine.ts`'s recording hooks to real capture when ready.
- Hidden **Ctrl/⌘-L** light theme still works (now initialised client-side in `_app.tsx`).
