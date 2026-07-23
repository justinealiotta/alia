/* ───────────────────────────────────────────────────────────────────────────
   Root layout — the single place global CSS is imported (App Router requires
   it), in cascade order: Tailwind → shell (tokens/reset) → component layers →
   flow/landing bases → responsive fluid scale → per-page sheets → room
   overrides → light-mode. Fonts + client-only vendor scripts load here too.
   ─────────────────────────────────────────────────────────────────────────── */

import './globals.css';

// Component + shell layers
import '../styles/shell.css';
import '../styles/messages.css';
import '../styles/voice.css';
import '../styles/composer.css';

// Page bases (generic .flow-* / .room-chrome / .cta-bar / .session-corner)
import '../styles/landing.css';
import '../styles/flow.css';

// Room screen shell + sticker layer
import '../styles/room.css';
import '../styles/stickers.css';

// Fluid responsive scale (clamps for the shared component classes)
import '../styles/responsive.css';

// Per-page sheets (scoped to their page root — order between them is safe)
import '../styles/apply.css';
import '../styles/casting-flow.css';
import '../styles/referral-flow.css';
import '../styles/referral-tool.css';
import '../styles/profile.css';
import '../styles/legal.css';

// Hidden light theme (Ctrl/⌘-L) token overrides — last
import '../styles/light-mode.css';

import Script from 'next/script';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Alia',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Arm the smart-type reveal gate before paint; self-clears after 1.5s
            as a safety net if the fitter never runs. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('st-fit');setTimeout(function(){document.documentElement.classList.remove('st-fit');},1500);" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Outfit:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* Client-only vendor side-effects (self-booting, DOM-observing).
            afterInteractive → run after hydration, matching the prototypes. */}
        <Script src="/vendor/voice-karaoke.js" strategy="afterInteractive" />
        <Script src="/vendor/page-pinch-guard.js" strategy="afterInteractive" />
        <Script src="/vendor/light-mode.js" strategy="afterInteractive" />
        <Script src="/vendor/smart-type.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
