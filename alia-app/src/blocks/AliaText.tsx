/* ───────────────────────────────────────────────────────────────────────────
   AliaText — the canonical freeform message-text block. Two modes:

   • display (default): <p class="text"> — exact feed markup. What AliaMessageBlocks
     renders for a committed text block.
   • editable (compose): a contentEditable line rendering as `.text`, so a
     composing surface builds the SAME block the feed reads (no hand-rolled
     contentEditable). Forwards a ref to the editable node; the host wires
     seeding / commit through the handlers (onInput / onKeyDown / onBlur …).

   AliaText is freeform message text. For structured single-value entry
   (name · age · handle …) use AliaField instead.
   ─────────────────────────────────────────────────────────────────────────── */
'use client';
import React from 'react';

/* ── Light autocorrect ────────────────────────────────────────────────────────
   A silent, GENERAL typo pass shared by EVERY composer that uses AliaText (room
   throw-in, referral note, apply text, stickers). Runs on commit — no red
   spell-check underline, no live rewriting.

   How it decides (Norvig-style, dictionary-bounded, deliberately timid):
   • FORCED map first — a few things edit-distance can't get right on its own
     (multi-word "alot"→"a lot", apostrophe contractions).
   • Otherwise a word is only touched when it is NOT already a real word AND
     exactly ONE dictionary word is a single edit away (insert / delete / swap /
     substitute). Ambiguous (2+ candidates) → left as typed.
   Guards so it never "corrects" intent: only words ≥4 letters; expressive
   spellings (triple letters, or repeats that collapse to a real word — "heyy",
   "sooo", "yesss") are left alone; names / brands / slang aren't in the
   dictionary so they can't be reached. Case of the original word is preserved. */
const TEXT_TYPO: Record<string, string> = {
  alot: 'a lot', wasnt: "wasn't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't",
  couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't", dont: "don't",
  cant: "can't", wont: "won't", youre: "you're", theyre: "they're", thats: "that's",
  ive: "i've", im: "i'm", cuz: 'because', definately: 'definitely',
  teh: 'the', hte: 'the', adn: 'and', nad: 'and', yuo: 'you', waht: 'what', taht: 'that',
};
/* Common-word dictionary — correction targets + everyday / chat / fashion vocab
   so real words are recognised (never "corrected") and typos resolve to them. */
const DICT = new Set((
  'the be to of and in that have it for not on with you do at this but his by from they we her she or an will my one all would there ' +
  'their what so up out about who get which go me when make can like time just him know take into year your good some could them see ' +
  'other then now look only come over think back after use how work first well way even want because any give day most these tell ' +
  'really something nothing thing feel need mean same right find keep leave call start show turn put ask seem happen live love miss ' +
  'hope wish wait help care send share people friend friends family girl girls boy woman women man home house room night morning today ' +
  'tomorrow yesterday week weekend month place world city town street water food coffee drink dinner lunch breakfast phone message ' +
  'text photo picture video music song movie book story name word stuff money price free open close buy sell wear dress outfit style ' +
  'fashion brand color colour black white gold silver pretty beautiful gorgeous cute cool warm nice sweet kind happy tired excited ' +
  'ready sorry thanks thank please welcome maybe probably actually literally honestly seriously totally completely finally already ' +
  'almost enough little more less better best worse worst great amazing perfect wonderful terrible boring funny crazy weird normal ' +
  'simple hard easy quick slow early late soon later long short small large young real true different special favorite favourite ' +
  'going coming doing making taking getting giving looking feeling trying using working playing talking walking running moving living ' +
  'loving liking wanting needing saying telling asking calling starting showing putting keeping leaving sending sharing waiting hoping ' +
  'helping reading writing posting texting remember forget understand believe achieve become begin change follow matter decide ' +
  'explain include continue create appear consider expect surprised restaurant weird friend because definitely separate occurred ' +
  'until calendar embarrass government which beginning becoming receive here right write would could should about beautiful something ' +
  'everything anything everyone anyone someone though although while since before between through around during above below under over ' +
  'inside outside behind beside another each every both always never sometimes usually often once twice also again another ' +
  'alia app link invite join member profile session referral bring pick voice note recording camera gallery drop done copy bestie ' +
  'queen diva babe girlie vibe vibes energy mood aesthetic runway model casting talent luxury designer vintage thrift closet wardrobe ' +
  'people please yourself myself really pretty gonna wanna kinda'
).split(/\s+/).filter(Boolean));
const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
function edits1(w: string): string[] {
  const out: string[] = [];
  for (let i = 0; i <= w.length; i++) {
    if (i < w.length) out.push(w.slice(0, i) + w.slice(i + 1));                       // delete
    if (i < w.length - 1) out.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); // transpose
    for (const c of ALPHA) {
      if (i < w.length) out.push(w.slice(0, i) + c + w.slice(i + 1));                 // substitute
      out.push(w.slice(0, i) + c + w.slice(i));                                       // insert
    }
  }
  return out;
}
function suggest(lower: string): string | null {
  const hits = new Set<string>();
  for (const e of edits1(lower)) if (DICT.has(e)) hits.add(e);
  return hits.size === 1 ? [...hits][0] : null;   // unique candidate only
}
function applyCase(word: string, fix: string): string {
  if (word.length > 1 && word === word.toUpperCase()) return fix.toUpperCase();
  if (word[0] === word[0].toUpperCase()) return fix.charAt(0).toUpperCase() + fix.slice(1);
  return fix;
}
export function lightAutocorrect(text: string): string {
  if (!text) return text;
  return text.replace(/[A-Za-z']+/g, (w) => {
    const lower = w.toLowerCase();
    const forced = TEXT_TYPO[lower];
    if (forced) return applyCase(w, forced);
    if (lower.length < 4 || lower.indexOf("'") !== -1) return w;   // short / contraction
    if (DICT.has(lower)) return w;                                 // already a real word
    if (/(.)\1\1/.test(lower)) return w;                           // expressive: sooo, yesss
    const collapsed = lower.replace(/(.)\1+/g, '$1');
    if (collapsed !== lower && collapsed.length < 4) return w; // heyy, noo, sooo, yay
    const fix = suggest(lower);
    return fix ? applyCase(w, fix) : w;
  });
}

export interface AliaTextProps {
  /* display */
  text?: string;
  /* editable (compose) */
  editable?: boolean;
  /* static committed display: render the composed line in the caller's OWN
     className — a <div>, no feed `.text` wrapper (e.g. a finished text sticker). */
  committed?: boolean;
  className?: string;
  placeholder?: string;
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  onInput?: (e: React.FormEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
}

const AliaText = React.forwardRef<HTMLDivElement, AliaTextProps>(function AliaText(
  { text, editable, committed, className = '', placeholder, onFocus, onInput, onKeyDown, onPaste, onBlur }, ref,
) {
  if (committed) return <div className={className}>{text}</div>;
  if (!editable) return <p className={className ? 'text ' + className : 'text'}>{text}</p>;
  /* On commit (blur), silently fix obvious typos, then let the host re-read the
     corrected value (onInput) before its own onBlur runs. */
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el) {
      const before = el.innerText;
      const after = lightAutocorrect(before);
      if (after !== before) { el.innerText = after; onInput?.(e); }
    }
    onBlur?.(e);
  };
  return (
    <div
      ref={ref}
      className={className}
      data-ph={placeholder}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      onFocus={onFocus}
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={handleBlur}
    ></div>
  );
});

export default AliaText;
