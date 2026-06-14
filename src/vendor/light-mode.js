/* ============================================================
   Alia · light-mode toggle
   Ctrl+L (or Cmd+L) toggles light mode — no visible UI.
   State persists in localStorage('alia:theme').
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'alia:theme';

  function apply(light) {
    document.documentElement.classList.toggle('light', light);
    // .phone.light activates Room's built-in per-phone light CSS
    document.querySelectorAll('.phone').forEach(function (p) {
      p.classList.toggle('light', light);
    });
  }

  // Restore before first paint
  if (localStorage.getItem(KEY) === 'light') apply(true);

  // Ctrl+L / Cmd+L
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      var going = !document.documentElement.classList.contains('light');
      apply(going);
      localStorage.setItem(KEY, going ? 'light' : 'dark');
    }
  });

  // Catch phones rendered late by JS (Room builds its phone dynamically)
  document.addEventListener('DOMContentLoaded', function () {
    var obs = new MutationObserver(function () {
      if (!document.documentElement.classList.contains('light')) return;
      document.querySelectorAll('.phone').forEach(function (p) {
        if (!p.classList.contains('light')) p.classList.add('light');
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  });
})();
