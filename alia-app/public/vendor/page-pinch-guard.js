/* ───────────────────────────────────────────────────────────────────────────
   page-pinch-guard.js — app-wide guard that stops the webview from pinch-zooming
   the PAGE.

   The media lift-out gesture (System A: useZoomHold, in src/media.tsx) owns
   pinch/trackpad zoom PER ELEMENT. But a two-finger gesture that lands even
   slightly OFF a zoomable element would otherwise let iOS Safari / the in-app
   webview zoom the whole page (they ignore user-scalable=no) — that was the
   "ghost / duplicate page showing through" behind a lift. This tiny always-on
   shim swallows every multi-touch move and Safari's gesture* events app-wide.

   It only preventDefault()s (never stopPropagation), so the per-element lift
   handlers in the same capture pass still receive the touch. Self-contained, no
   React, no per-element logic. This is all that remains of the old media-zoom.js
   once every real lift moved into System A.
   ───────────────────────────────────────────────────────────────────────────*/
(function () {
  if (window.__aliaPinchGuard) return;
  window.__aliaPinchGuard = true;
  // shared flag the room drawers read to stand down while media is lifted;
  // set/cleared by useZoomHold. Initialise it here so readers never see undefined.
  if (typeof window.__aliaZoomActive === 'undefined') window.__aliaZoomActive = false;

  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false, capture: true });

  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
})();
