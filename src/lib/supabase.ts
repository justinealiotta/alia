/* ───────────────────────────────────────────────────────────────────────────
   Supabase client.
   Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from the
   environment (see .env.local.example). Safe to import on client or server.
   ─────────────────────────────────────────────────────────────────────────── */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Non-fatal: image URLs still resolve from the public bucket fallback in
  // data.ts. Set both vars in .env.local to enable auth / database / storage.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set — backend calls will fail until configured.',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
