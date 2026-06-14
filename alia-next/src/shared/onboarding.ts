/* ───────────────────────────────────────────────────────────────────────────
   shared/onboarding.ts — date / age / field detection shared by the onboarding
   flows (P2P Onboarding, Casting Onboarding). Single source of truth for the
   birthday parser, 21+ gate, and the email/phone/name extraction.
   ─────────────────────────────────────────────────────────────────────────── */

import type { ComposerItem } from '../types';

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parse a birthday out of free text (many formats). Returns null if none. */
export function parseBday(text: string): Date | null {
  if (!text) return null;
  let m: RegExpMatchArray | null;

  m = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
  if (m) { const mm = +m[1], dd = +m[2], yy = +m[3]; if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yy >= 1900) { const d = new Date(yy, mm - 1, dd); if (d.getMonth() === mm - 1) return d; } }

  m = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})\b/);
  if (m) { const mm = +m[1], dd = +m[2], yy = +m[3] < 30 ? 2000 + +m[3] : 1900 + +m[3]; if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) { const d = new Date(yy, mm - 1, dd); if (d.getMonth() === mm - 1) return d; } }

  m = text.match(/\b(\d{8})\b/);
  if (m) { const s = m[1], mm = +s.slice(0, 2), dd = +s.slice(2, 4), yy = +s.slice(4); if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yy >= 1900) { const d = new Date(yy, mm - 1, dd); if (d.getMonth() === mm - 1) return d; } }

  m = text.match(/\b(\d{6})\b/);
  if (m) { const s = m[1], mm = +s.slice(0, 2), dd = +s.slice(2, 4), yr2 = +s.slice(4), yy = yr2 < 30 ? 2000 + yr2 : 1900 + yr2; if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) { const d = new Date(yy, mm - 1, dd); if (d.getMonth() === mm - 1) return d; } }

  m = text.match(/\b(19[4-9]\d|200[0-9])\b/);
  if (m) return new Date(+m[1], 6, 1);

  m = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+(\d{1,2})(?:[,\s]+(\d{2,4}))?\b/i);
  if (m) { const mn = MONTHS[m[1].toLowerCase().slice(0, 3)]; const dd = +m[2]; let yy = m[3] ? +m[3] : null; if (yy && yy < 100) yy = yy < 30 ? 2000 + yy : 1900 + yy; if (mn !== undefined && dd >= 1 && dd <= 31) return new Date(yy || 1990, mn, dd); }

  return null;
}

export function calcAge(date: Date | null): number | null {
  if (!date) return null;
  const t = new Date();
  let a = t.getFullYear() - date.getFullYear();
  const m = t.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < date.getDate())) a--;
  return a;
}

/** "Month D, YYYY" of the date the person turns 21. */
export function format21(bday: Date): string {
  return new Date(bday.getFullYear() + 21, bday.getMonth(), bday.getDate())
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export interface OnboardDetected {
  name: boolean;
  firstName: string;
  nameStr: string;
  contactStr: string;
  bday: boolean;
  bdayDate: Date | null;
  email: boolean;
  phone: boolean;
  under21: boolean;
  age: number | null;
}

/** Detect name / bday / contact from the composer's serialized items. */
export function detectOnboarding(items: ComposerItem[]): OnboardDetected {
  const text = items.filter((b) => b.type === 'text').map((b: any) => b.text.trim()).join(' ');
  const email = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(text);
  const phone = /\d{7,}/.test(text.replace(/[\s\-()+.]/g, ''));
  const bdayDate = parseBday(text);
  const stripped = text
    .replace(/\b\d{1,2}[/\-.]\d{1,2}[/\-.]?\d{0,4}\b/g, '')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '')
    .replace(/[+(]?\d[\d\s\-().]{5,}/g, '')
    .trim();
  const name = /[a-zA-Z]{2,}/.test(stripped);
  const nameMatch = stripped.match(/\b([A-Z][a-z]+|[a-zA-Z]{3,})\b/);
  const firstName = nameMatch ? nameMatch[1] : '';
  const nameStr = stripped.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();
  const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/);
  const phoneMatch = text.match(/[+]?[\d][\d\s\-().]{6,}/);
  const contactStr = emailMatch ? emailMatch[0] : (phoneMatch ? phoneMatch[0].trim() : '');
  const age = calcAge(bdayDate);
  return { name, firstName, nameStr, contactStr, bday: !!bdayDate, bdayDate, email, phone, under21: age !== null && age < 21, age };
}
