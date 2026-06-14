/* ───────────────────────────────────────────────────────────────────────────
   _app.tsx — Alia app shell (Next.js Pages Router).

   In the Pages Router, global CSS may only be imported here. The stylesheet
   stack is loaded in the same order as the old Vite entry (base components →
   shared layers → responsive + light-mode overrides), then Tailwind last.

   The vendor side-effect modules (voice karaoke + the Ctrl/⌘-L light-mode
   toggle) touch window/document/localStorage at load, so they are imported
   inside a client-only effect rather than at module scope.
   ─────────────────────────────────────────────────────────────────────────── */

import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';

/* ── Component styles ────────────────────────────────────────────────────── */
import '../styles/messages.css';
import '../styles/voice.css';
import '../styles/composer-styles.css';

/* ── Shared app layers ───────────────────────────────────────────────────── */
import '../shared/shell.css';
import '../shared/chat.css';
import '../shared/onboarding.css';
import '../shared/referral.css';
import '../shared/landing.css';
import '../shared/legal.css';
import '../room.css';
import '../responsive.css';

/* ── Hidden light mode (Ctrl/⌘-L) ────────────────────────────────────────── */
import '../styles/light-mode.css';

/* ── Tailwind (preflight disabled — see tailwind.config.ts) ───────────────── */
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Vendor side-effects (attach window globals / key handlers) — client only.
    import('../vendor/voice-karaoke.js');
    import('../vendor/light-mode.js');
  }, []);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <title>Alia</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
