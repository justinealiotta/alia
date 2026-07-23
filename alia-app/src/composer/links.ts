/* ───────────────────────────────────────────────────────────────────────────
   composer/links.ts — URL detection + labelling.
   URL_REGEX, looksLikeUrl, EDITORIAL_DOMAINS, parseLink. Drives inline
   URL → link-ref conversion.
   ─────────────────────────────────────────────────────────────────────────── */

const CM_URL_REGEX =
  /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|org|net|io|co|me|app|dev|shop|store|tv|gg|xyz)[^\s]*)/gi;

export function cmLooksLikeUrl(s: string): boolean {
  const t = (s || '').trim();
  const m = t.match(CM_URL_REGEX);
  return !!m && m[0] === t;
}

/* Editorial-domain → display label (lowercase). */
export const CM_EDITORIAL_DOMAINS: Record<string, string> = {
  'vogue.com': 'vogue', 'thecut.com': 'the cut',
  'businessoffashion.com': 'business of fashion',
  'nytimes.com': 'new york times', 'harpersbazaar.com': "harper's bazaar",
  'elle.com': 'elle', 'refinery29.com': 'refinery29',
  'whowhatwear.com': 'who what wear',
  'voguebusiness.com': 'vogue business', 'wwd.com': 'wwd',
  'fashionista.com': 'fashionista', 'popsugar.com': 'popsugar',
  'glamour.com': 'glamour', 'instyle.com': 'instyle',
  'cosmopolitan.com': 'cosmopolitan', 'seventeen.com': 'seventeen',
  'wsj.com': 'wall street journal', 'guardian.com': 'the guardian',
  'cnn.com': 'cnn', 'bbc.com': 'bbc',
  'ssense.com': 'ssense', 'net-a-porter.com': 'net-a-porter',
  'matchesfashion.com': 'matches',
};

export interface CmLinkInfo { url: string; host: string; platform: string; label: string; }

export function cmParseLink(raw: string): CmLinkInfo {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); }
  catch {
    host = raw.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0];
  }
  const low = host.toLowerCase();
  let platform = 'web';
  let label = low;

  if (/instagram/.test(low)) {
    platform = 'instagram';
    const m = url.match(/instagram\.com\/([^/?]+)/i);
    const user = m && !['p', 'reel', 'stories', 'tv', 'explore', 'accounts'].includes(m[1])
      ? m[1].replace(/^@/, '') : null;
    label = user ? `${user} instagram` : 'instagram';
  } else if (/tiktok/.test(low)) {
    platform = 'tiktok';
    const m = url.match(/tiktok\.com\/@([^/?]+)/i);
    label = m ? `${m[1].replace(/^@/, '')} tiktok` : 'tiktok';
  } else if (CM_EDITORIAL_DOMAINS[low]) {
    platform = 'editorial';
    label = CM_EDITORIAL_DOMAINS[low];
  } else {
    label = low;
  }
  return { url, host: low, platform, label };
}
