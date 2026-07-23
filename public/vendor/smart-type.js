/* smart-type.js — Alia smart typography · runtime helpers (all screens).

   1) PHRASE-CARD / DISPLAY WIDOW GLUE. Bind the last two words of a display line
      with a non-breaking space so one word can't drop alone to the final line.
   2) ONE-LINE AUTO-FIT (option 4). Keep short display lines — names, big
      identity values, and the giant nowrap hero / payoff lines — on ONE line by
      shrinking font-size to fit their box (down to a per-group floor, then
      ellipsis). Editable value lines are only fitted when NOT focused, so typing
      stays natural; they re-fit on blur. Running prose is left to CSS measure.

   Idempotent. Re-runs on render (MutationObserver), on resize (debounced), on
   focus changes, and after web-fonts load. Prose measure + fluid sizing are pure
   CSS (per-screen stylesheets). */
(function () {
  var NBSP = '\u00A0';

  /* Groups of one-line-fit targets. floor = smallest px we'll shrink to.
     editable = skip while the element (or a child) has focus. */
  var GROUPS = [
    { sel: '.name', floor: 13, editable: false },
    { sel: '.mmi-done-line', floor: 24, editable: false },
    { sel: '.cc-id-name', floor: 20, editable: true },
    { sel: '.cc-id-line, .cc-id-link', floor: 14, editable: true },
    { sel: '.mmi-field-name', floor: 18, editable: true },
    { sel: '.mmi-field, .mmi-field-val', floor: 14, editable: true },
    { sel: '.cast-seed-name, .prof-seed-name', floor: 18, editable: true },
    { sel: '.cast-seed-line, .prof-seed-line, .cast-seed-link', floor: 13, editable: true }
  ];
  var FIT_PROPS = ['whiteSpace', 'overflow', 'textOverflow', 'minWidth', 'flex', 'fontSize'];
  // Big display targets are hidden (html.st-fit gate) until fitted, so their
  // pre-fit size is never painted. Revealed the instant they're fitted below.
  var GATED = '.prof-seed-name, .cast-seed-name, .cc-id-name, .mmi-field-name, .mmi-done-line, .v2-hero-line';
  var raf = 0;

  function glue(el) {
    var t = el.textContent;
    if (!t || t.indexOf(' ') === -1 || t.indexOf(NBSP) !== -1) return;
    var i = t.lastIndexOf(' ');
    if (t.length - i - 1 > 12) return;
    el.textContent = t.slice(0, i) + NBSP + t.slice(i + 1);
  }

  function restore(el) {
    for (var k = 0; k < FIT_PROPS.length; k++) el.style[FIT_PROPS[k]] = '';
  }

  function fit(el, floor) {
    if (el.clientWidth === 0 && el.scrollWidth === 0) return NaN; // not laid out
    el.style.flex = '0 1 auto';
    el.style.minWidth = '0';
    el.style.whiteSpace = 'nowrap';
    // Do NOT clip while measuring — overflow:hidden clips BOTH axes and would
    // shear descenders on tight line-heights even when no shrink is needed.
    el.style.overflow = '';
    el.style.textOverflow = '';
    el.style.fontSize = '';                       // reset to the CSS base
    var size = parseFloat(getComputedStyle(el).fontSize) || 16;
    var guard = 0;
    while (el.scrollWidth > el.clientWidth + 1 && size > floor && guard++ < 80) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
    // Only when the line STILL overflows at the floor do we clip + ellipsize
    // (rare edge case). The common case — it fits — keeps overflow visible so
    // glyph ink is never clipped vertically.
    if (el.scrollWidth > el.clientWidth + 1) {
      el.style.overflow = 'hidden';
      el.style.textOverflow = 'ellipsis';
    }
    return size;
  }

  /* Hero lines fit as a GROUP: every .v2-hero-line in a hero shares the smallest
     size any one line needs, so the stack stays uniform (not ragged) while still
     never overflowing the viewport. */
  function fitHero() {
    var heroes = document.querySelectorAll('.v2-hero');
    for (var h = 0; h < heroes.length; h++) {
      var lines = heroes[h].querySelectorAll('.v2-hero-line'), min = Infinity;
      for (var i = 0; i < lines.length; i++) min = Math.min(min, fit(lines[i], 24));
      if (min !== Infinity && !isNaN(min)) for (var j = 0; j < lines.length; j++) lines[j].style.fontSize = min + 'px';
    }
  }

  function sweep() {
    var cards = document.querySelectorAll('.phrase-card');
    for (var c = 0; c < cards.length; c++) glue(cards[c]);
    fitHero();
    var active = document.activeElement;
    for (var g = 0; g < GROUPS.length; g++) {
      var grp = GROUPS[g], els = document.querySelectorAll(grp.sel);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (grp.editable && active && (el === active || el.contains(active))) restore(el);
        else fit(el, grp.floor);
      }
    }
    var de = document.documentElement;
    if (de.classList.contains('st-fit') && document.querySelector(GATED)) de.classList.remove('st-fit');
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; sweep(); }); }

  function start() {
    var root = document.getElementById('root') || document.body;
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true });
    var t = 0;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(schedule, 120); });
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', function () { setTimeout(schedule, 0); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    sweep(); // first pass synchronously — fit before the next paint, no visible shrink
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
