/* ───────────────────────────────────────────────────────────────────────────
   identity.ts — Alia · the live identity parser (apply mode)

   Raw freeform text in → recognized, normalized fields out, rendered in a fixed
   order (name · age · city · instagram · tiktok · email · phone). Name is
   Title-Cased; common typos are autocorrected. Shared by the apply talent-card
   (ApplyFlow) and the room throw-in composer (AliaComposerBlocks).
   ─────────────────────────────────────────────────────────────────────────── */

export interface Identity {
  name: string; age: number | null; city: string; email: string; phone: string;
  ig: string; tt: string; recognized: boolean;
}

const CITY_MAP: Record<string, string> = {
  'new york': 'New York', nyc: 'New York', ny: 'New York', bk: 'New York', manhattan: 'New York', brooklyn: 'New York', queens: 'New York', bronx: 'New York', 'staten island': 'New York', harlem: 'New York', soho: 'New York', tribeca: 'New York', williamsburg: 'New York', bushwick: 'New York', greenpoint: 'New York', astoria: 'New York', chelsea: 'New York', 'long island city': 'New York', 'jersey city': 'New York', hoboken: 'New York', flushing: 'New York', dumbo: 'New York', 'lower east side': 'New York', 'upper east side': 'New York', 'upper west side': 'New York',
  'los angeles': 'Los Angeles', la: 'Los Angeles', lax: 'Los Angeles', hollywood: 'Los Angeles', 'west hollywood': 'Los Angeles', weho: 'Los Angeles', venice: 'Los Angeles', 'santa monica': 'Los Angeles', silverlake: 'Los Angeles', 'silver lake': 'Los Angeles', 'echo park': 'Los Angeles', burbank: 'Los Angeles', pasadena: 'Los Angeles', 'culver city': 'Los Angeles', 'beverly hills': 'Los Angeles', malibu: 'Los Angeles',
  miami: 'Miami', mia: 'Miami', 'south beach': 'Miami', 'miami beach': 'Miami', brickell: 'Miami', wynwood: 'Miami',
  'san francisco': 'San Francisco', sf: 'San Francisco', sfo: 'San Francisco', 'the bay': 'San Francisco', oakland: 'San Francisco', berkeley: 'San Francisco', 'palo alto': 'San Francisco',
  chicago: 'Chicago', chi: 'Chicago', atlanta: 'Atlanta', atl: 'Atlanta', austin: 'Austin', atx: 'Austin', nashville: 'Nashville', dallas: 'Dallas', dfw: 'Dallas', houston: 'Houston', htx: 'Houston', seattle: 'Seattle', sea: 'Seattle', portland: 'Portland', pdx: 'Portland', denver: 'Denver', boston: 'Boston', philadelphia: 'Philadelphia', philly: 'Philadelphia', washington: 'Washington DC', dc: 'Washington DC', 'las vegas': 'Las Vegas', vegas: 'Las Vegas', phoenix: 'Phoenix', 'san diego': 'San Diego',
  toronto: 'Toronto', yyz: 'Toronto', vancouver: 'Vancouver', montreal: 'Montreal', london: 'London', ldn: 'London', shoreditch: 'London', hackney: 'London', paris: 'Paris', berlin: 'Berlin', amsterdam: 'Amsterdam', milan: 'Milan', sydney: 'Sydney', melbourne: 'Melbourne', dubai: 'Dubai', tokyo: 'Tokyo', mexico: 'Mexico City', 'mexico city': 'Mexico City', cdmx: 'Mexico City',
};
function detectCity(text: string): [string, string] {
  const norm = ' ' + text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const keys = Object.keys(CITY_MAP).sort((a, b) => b.length - a.length);
  for (const k of keys) { if (norm.includes(' ' + k + ' ')) return [CITY_MAP[k], k]; }
  return ['', ''];
}

const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const KEYWORDS = /\b(ig|insta|instagram|tt|tiktok|email|mail|phone|number|tel|cell|mobile|born|dob|bday|birthday|age|im|i'm|name|is|my)\b/gi;

const TYPO: Record<string, string> = {
  teh: 'the', adn: 'and', recieve: 'receive', definately: 'definitely',
  seperate: 'separate', tomorow: 'tomorrow', wendsday: 'wednesday',
  freind: 'friend', beleive: 'believe', occured: 'occurred', untill: 'until',
  becuase: 'because', thier: 'their', alwasy: 'always', acording: 'according',
  basicly: 'basically', enviroment: 'environment', goverment: 'government',
  intrested: 'interested', wierd: 'weird', accross: 'across', adress: 'address',
};
function autocorrect(text: string): string {
  return text.replace(/[A-Za-z']+/g, (w) => {
    const fix = TYPO[w.toLowerCase()];
    if (!fix) return w;
    return /^[A-Z]/.test(w) ? fix.charAt(0).toUpperCase() + fix.slice(1) : fix;
  });
}
function computeAge(y: number, m: number, d: number): number | null {
  const now = new Date();
  let age = now.getFullYear() - y;
  const md = (now.getMonth() + 1) - m;
  if (md < 0 || (md === 0 && now.getDate() < d)) age--;
  return age >= 0 && age <= 120 ? age : null;
}
function parseBirthday(text: string): [number | null, string] {
  // ISO-ish, year first: YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
  let iso = text.match(/\b((?:19|20)\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (iso) {
    const age = computeAge(+iso[1], +iso[2], +iso[3]);
    if (age != null) return [age, iso[0]];
  }
  // separated, month first: M/D/Y, M-D-Y, M.D.Y (2- or 4-digit year)
  let m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) {
    let mm = +m[1], dd = +m[2], yy = +m[3];
    if (m[3].length <= 2) yy += yy > 30 ? 1900 : 2000;
    if (mm > 12 && dd <= 12) { const t = mm; mm = dd; dd = t; }
    const age = computeAge(yy, mm, dd);
    if (age != null) return [age, m[0]];
  }
  // month names: "Mar 3, 2001" / "March 3 2001" / "3 March 2001" (+ optional year)
  const mon = MONTHS.join('|');
  let n = text.match(new RegExp('\\b(' + mon + ')[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b', 'i'))
       || text.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(' + mon + ')[a-z]*\\.?,?\\s+(\\d{4})\\b', 'i'));
  if (n) {
    let mi: number, dd: number, yy: number;
    if (isNaN(+n[1])) { mi = MONTHS.indexOf(n[1].toLowerCase().slice(0, 3)); dd = +n[2]; yy = +n[3]; }
    else { dd = +n[1]; mi = MONTHS.indexOf(n[2].toLowerCase().slice(0, 3)); yy = +n[3]; }
    const age = computeAge(yy, mi + 1, dd);
    if (age != null) return [age, n[0]];
  }
  // compact, no separators: MMDDYY (6) · MMDDYYYY or YYYYMMDD (8)
  const c = text.match(/\b(\d{8}|\d{6})\b/);
  if (c) {
    const s = c[1];
    let mm: number, dd: number, yy: number;
    if (s.length === 6) {
      mm = +s.slice(0, 2); dd = +s.slice(2, 4); yy = +s.slice(4, 6);
      yy += yy > 30 ? 1900 : 2000;
    } else if (+s.slice(0, 4) >= 1900 && +s.slice(0, 4) <= 2099 && +s.slice(4, 6) <= 12) {
      yy = +s.slice(0, 4); mm = +s.slice(4, 6); dd = +s.slice(6, 8);       // YYYYMMDD
    } else {
      mm = +s.slice(0, 2); dd = +s.slice(2, 4); yy = +s.slice(4, 8);       // MMDDYYYY
    }
    if (mm > 12 && dd <= 12) { const t = mm; mm = dd; dd = t; }
    const age = computeAge(yy, mm, dd);
    if (age != null) return [age, c[1]];
  }
  // last resort: a bare 4-digit year
  const y = text.match(/\b(19|20)\d{2}\b/);
  if (y) { const age = computeAge(+y[0], 1, 1); if (age != null) return [age, y[0]]; }
  return [null, ''];
}
function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
export function parseIdentity(raw: string): Identity {
  let text = autocorrect(raw.replace(/\u00a0/g, ' ').trim());
  const blank: Identity = { name: '', age: null, city: '', email: '', phone: '', ig: '', tt: '', recognized: false };
  if (!text) return blank;
  const email = (text.match(EMAIL_RE) || [''])[0].toLowerCase();
  if (email) text = text.replace(new RegExp(email, 'i'), ' ');
  let ig = '', tt = '';
  const igUrl = text.match(/instagram\.com\/@?([\w.]{2,})/i); if (igUrl) ig = igUrl[1];
  const ttUrl = text.match(/tiktok\.com\/@?([\w.]{2,})/i); if (ttUrl) tt = ttUrl[1];
  if (!ig) { const k = text.match(/\b(?:ig|insta|instagram)\b[\s:=-]*@?([\w.]{2,})/i); if (k) ig = k[1]; }
  if (!tt) { const k = text.match(/\b(?:tt|tiktok)\b[\s:=-]*@?([\w.]{2,})/i); if (k) tt = k[1]; }
  const handles = (text.match(/@([\w.]{2,})/g) || []).map((h) => h.slice(1));
  for (const h of handles) { if (!ig) ig = h; else if (!tt && h !== ig) tt = h; }
  ig = ig.replace(/[.\-]+$/, ''); tt = tt.replace(/[.\-]+$/, '');
  text = text.replace(/https?:\/\/\S+/gi, ' ').replace(/@[\w.]+/g, ' ')
             .replace(/[\w.]*(?:instagram|tiktok)\.com\/?[\w.@]*/gi, ' ');
  const [age, bdayStr] = parseBirthday(text);
  if (bdayStr) text = text.replace(bdayStr, ' ');
  const [city, cityKey] = detectCity(text);
  if (cityKey) text = text.replace(new RegExp('\\b' + cityKey.replace(/\s+/g, '\\s+') + '\\b', 'gi'), ' ');
  let phone = '';
  const pm = text.match(/\+?\d[\d\s().\-]{5,}\d/);
  if (pm) {
    const digits = pm[0].replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) { phone = '+' + digits; text = text.replace(pm[0], ' '); }
  }
  const name = titleCase(
    text.replace(KEYWORDS, ' ').replace(/[^A-Za-z\s'\-]/g, ' ').replace(/\s+/g, ' ').trim()
        .split(' ').filter(Boolean).slice(0, 3).join(' '),
  );
  const id: Identity = { name, age, city, email, phone, ig, tt, recognized: false };
  id.recognized = !!(name || age != null || city || email || phone || ig || tt);
  return id;
}
