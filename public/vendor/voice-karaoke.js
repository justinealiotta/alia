/* ─── Voice transcript karaoke ───────────────────────────────────────────
   Real transcripts of what was recorded. When a message plays, the
   transcript highlights word-by-word in sync with playback.

   These mocks carry no real audio, so playback is timed to the take's known
   duration: every word gets a slice weighted by its length and the highlight
   advances word-by-word. Shared across every voice scope so they all
   behave identically.

   Markup contract (per voice scope):
     · a play control + the `playing` class toggled on the scope
     · a transcript element (.transcript or .av-tr) whose words are wrapped
       with VoiceKaraoke.wrapWords(text) → <span class="w">word</span>
   CSS dims .w while .playing and lifts .w.spoken / .w.active to full.        */
(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Wrap each word in a <span class="w">, preserving the original whitespace
  // (so wrapping / line breaks are untouched).
  function wrapWords(text) {
    return String(text == null ? '' : text)
      .split(/(\s+)/)
      .map((tok) => (tok === '' || /^\s+$/.test(tok)) ? tok : `<span class="w">${esc(tok)}</span>`)
      .join('');
  }

  // Start time (ms) for each word, weighted by its letter/number count so
  // longer words linger a touch longer — feels closer to natural speech.
  function buildStops(words, durMs) {
    const weights = words.map((w) => {
      const letters = (w.textContent.match(/[\p{L}\p{N}]/gu) || []).length;
      return Math.max(1, letters) + 1.6;
    });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let acc = 0; const stops = [];
    for (const w of weights) { stops.push((acc / total) * durMs); acc += w; }
    return stops;
  }

  function paint(words, active) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const spoken = i < active, isActive = i === active;
      if (w._sp !== spoken) { w.classList.toggle('spoken', spoken); w._sp = spoken; }
      if (w._ac !== isActive) { w.classList.toggle('active', isActive); w._ac = isActive; }
    }
  }

  function clear(scope) {
    scope.querySelectorAll('.w').forEach((w) => {
      w.classList.remove('spoken', 'active'); w._sp = false; w._ac = false;
    });
  }

  function pause(scope) {
    const st = scope._kara;
    if (st && st.raf) { cancelAnimationFrame(st.raf); st.raf = null; }
  }

  function stop(scope) {
    pause(scope);
    if (scope._kara) scope._kara.elapsed = 0;
    clear(scope);
  }

  // Begin / resume highlighting. durSec = the message length. onEnd fires when
  // playback reaches the end (so the caller can flip the icon back to play).
  function start(scope, durSec, onEnd) {
    const tr = scope.querySelector('.transcript, .av-tr');
    if (!tr) return;
    const words = [...tr.querySelectorAll('.w')];
    if (!words.length) return;
    const durMs = Math.max(1200, (durSec || 6) * 1000);
    const st = scope._kara || (scope._kara = { elapsed: 0 });
    if (st.elapsed >= durMs) st.elapsed = 0;            // finished → replay from top
    st.stops = buildStops(words, durMs);
    st.last = performance.now();
    const step = (now) => {
      st.elapsed += Math.min(now - st.last, 120); st.last = now;
      let active = -1;
      for (let i = 0; i < st.stops.length; i++) {
        if (st.elapsed >= st.stops[i]) active = i; else break;
      }
      paint(words, active);
      if (st.elapsed >= durMs) {
        st.raf = null; st.elapsed = 0; clear(scope);
        if (typeof onEnd === 'function') onEnd();
        return;
      }
      st.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  }

  window.VoiceKaraoke = { wrapWords, start, pause, stop, clear };
})();
