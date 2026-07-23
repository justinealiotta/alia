/* ───────────────────────────────────────────────────────────────────────────
   fieldFormat.ts — Alia · the ONE identity-field treatment.

   Every page that renders an identity line (apply talent card, casting seed,
   referral-flow seed, profile) formats through the SAME fmtField here — so the
   name / age / city / handle / email / number lines behave identically
   everywhere. Built on the shared identity parser. There is no per-page copy.
   ─────────────────────────────────────────────────────────────────────────── */

import { parseIdentity } from './identity';

export type FieldKey = 'name' | 'bday' | 'city' | 'ig' | 'tt' | 'email' | 'phone';

/* number → "+" then up to 15 digits, no spacing. */
export function prettyPhone(p: string): string {
  const d = p.replace(/\D/g, '').slice(0, 15);
  return d ? '+' + d : '';
}

/* format one field's raw text into its display value (reuses the shared parser).
   name → as typed · bday → age · city → nearest big city · instagram/tiktok →
   @handle · email → normalized · number → "+"-prefixed digits. */
export function fmtField(key: FieldKey, raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  switch (key) {
    case 'name': return v;
    case 'bday': { const a = parseIdentity(v).age; return a != null ? String(a) : v; }
    case 'city': { const c = parseIdentity(v).city; return (c || v).toLowerCase(); }
    case 'ig': { const h = parseIdentity('instagram ' + v).ig; return '@' + (h || v.replace(/^@/, '')); }
    case 'tt': { const h = parseIdentity('tiktok ' + v).tt; return '@' + (h || v.replace(/^@/, '')); }
    case 'email': { const e = parseIdentity(v).email; return e || v.toLowerCase(); }
    case 'phone': { const p = parseIdentity(v).phone; return p ? prettyPhone(p) : prettyPhone(v); }
    default: return v;
  }
}
