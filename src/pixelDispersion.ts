/* ───────────────────────────────────────────────────────────────────────────
   pixelDispersion.ts — the "unsend" pixel-dispersion animation.

   Reconstructs the message on an offscreen canvas (same-origin images via
   drawImage, text via fillText, voice bars as rects), samples the actual pixel
   colours, then scatters them as tiny squares in a wave. Photo messages burst in
   real photo colours; a tainted canvas falls back to monochrome content-region
   seeding.

   The burst is sized RELATIVE to the thing being removed: a two-word reply
   disperses in a tight, quick puff; a full media message throws a bigger, wider
   cloud. The spread (speed · gravity · lift · overlay padding) all scale off the
   sampled ink's diagonal, so the effect always feels proportional to its content.

   Returns a Promise that resolves when the animation completes (~1.7s), so the
   caller can remove the entry from React state at the right moment.
   ─────────────────────────────────────────────────────────────────────────── */

interface Particle {
  x: number; y: number; vx: number; vy: number; gravity: number;
  size: number; life: number; a0: number; color: string; delay: number; t: number;
}

export function pixelDispersion(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const host = el.closest('.app-root') as HTMLElement | null;
    if (!host) { resolve(); return; }

    const hostRect = host.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const ox = elRect.left - hostRect.left;
    const oy = elRect.top - hostRect.top;
    const W = elRect.width;
    const H = elRect.height;
    if (W < 2 || H < 2) { resolve(); return; }

    const isLight = document.documentElement.classList.contains('light');

    /* ── Reconstruct on an offscreen canvas ──────────────────────────────── */
    const src = document.createElement('canvas');
    src.width = Math.round(W);
    src.height = Math.round(H);
    const sCtx = src.getContext('2d')!;
    sCtx.fillStyle = isLight ? '#ffffff' : '#000000';
    sCtx.fillRect(0, 0, Math.round(W), Math.round(H));

    const rel = (child: Element) => {
      const cr = child.getBoundingClientRect();
      return { x: cr.left - elRect.left, y: cr.top - elRect.top, w: cr.width, h: cr.height };
    };

    // Track a tight bounding box of the ACTUAL sampled content, so the burst
    // originates where the message bubble is — not across the full-width
    // (mostly empty) reply row.
    let cx0 = Infinity, cy0 = Infinity, cx1 = -Infinity, cy1 = -Infinity;
    const addContent = (r: { x: number; y: number; w: number; h: number }) => {
      if (r.w < 1 || r.h < 1) return;
      cx0 = Math.min(cx0, r.x); cy0 = Math.min(cy0, r.y);
      cx1 = Math.max(cx1, r.x + r.w); cy1 = Math.max(cy1, r.y + r.h);
    };

    // Skip nodes that aren't actually visible (e.g. own replies hide the avatar
    // via visibility:hidden — without this the canvas samples the hidden photo's
    // colours and the burst comes out coloured instead of plain text white).
    const visible = (node: Element): boolean => {
      let el: Element | null = node;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false;
        el = el.parentElement;
      }
      return true;
    };

    el.querySelectorAll('.img-wrap img').forEach((img) => {
      const im = img as HTMLImageElement;
      if (!im.complete || !im.naturalWidth || !visible(im)) return;
      const r = rel(im); if (r.w < 1 || r.h < 1) return;
      addContent(r);
      try { sCtx.drawImage(im, r.x, r.y, r.w, r.h); } catch { /* */ }
    });

    el.querySelectorAll('.avatar img').forEach((img) => {
      const im = img as HTMLImageElement;
      if (!im.complete || !im.naturalWidth || !visible(im)) return;
      const r = rel(im); if (r.w < 1 || r.h < 1) return;
      addContent(r);
      sCtx.save();
      sCtx.beginPath();
      sCtx.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, Math.PI * 2);
      sCtx.clip();
      try { sCtx.drawImage(im, r.x, r.y, r.w, r.h); } catch { /* */ }
      sCtx.restore();
    });

    el.querySelectorAll('p.text, .name-row .name, .link-ref, .edited, .dur').forEach((node) => {
      if (!visible(node)) return;
      const r = rel(node); if (r.w < 2 || r.h < 2) return;
      addContent(r);
      const cs = getComputedStyle(node as Element);
      sCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      sCtx.fillStyle = cs.color;
      sCtx.textBaseline = 'top';
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      const words = (node.textContent || '').split(' ');
      let line = '', ly = r.y;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (sCtx.measureText(test).width > r.w + 2 && line) {
          sCtx.fillText(line, r.x, ly); line = w; ly += lh;
        } else { line = test; }
      }
      if (line) sCtx.fillText(line, r.x, ly);
    });

    el.querySelectorAll('.wave i').forEach((bar) => {
      const r = rel(bar); if (r.w < 1 || r.h < 1) return;
      addContent(r);
      const on = bar.classList.contains('on');
      sCtx.fillStyle = on
        ? (isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)')
        : (isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)');
      sCtx.fillRect(r.x, r.y, r.w, r.h);
    });

    /* ── Sample non-background pixels ────────────────────────────────────── */
    // Denser sampling for small content so even a two-word reply yields enough
    // pixels to burst convincingly (not a handful of stray dots).
    const _cw = cx1 > cx0 ? cx1 - cx0 : W, _ch = cy1 > cy0 ? cy1 - cy0 : H;
    const STEP = Math.sqrt(_cw * _cw + _ch * _ch) < 170 ? 2 : 4;
    let eligible: Array<{ px: number; py: number; r: number; g: number; b: number }> = [];
    try {
      const { data } = sCtx.getImageData(0, 0, Math.round(W), Math.round(H));
      const rw = Math.round(W), rh = Math.round(H);
      for (let py = 0; py < rh; py += STEP) {
        for (let px = 0; px < rw; px += STEP) {
          const i = (py * rw + px) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 15) continue;
          const lum = (r + g + b) / 3;
          const isBg = isLight ? lum > 240 : lum < 18;
          if (!isBg) eligible.push({ px, py, r, g, b });
        }
      }
    } catch { /* tainted; fallback below */ }

    // Burst origin centred on the actual INK (sampled non-bg pixels) so it fires
    // from the glyphs/photo, not the full-width row. Falls back to sampled element
    // rects, then the full box.
    let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
    for (const p of eligible) {
      if (p.px < ix0) ix0 = p.px; if (p.py < iy0) iy0 = p.py;
      if (p.px > ix1) ix1 = p.px; if (p.py > iy1) iy1 = p.py;
    }
    const hasInk = eligible.length > 0 && ix1 > ix0 && iy1 > iy0;
    const hasContent = cx1 > cx0 && cy1 > cy0;
    const bx0 = hasInk ? ix0 : hasContent ? cx0 : 0;
    const by0 = hasInk ? iy0 : hasContent ? cy0 : 0;
    const bw = hasInk ? ix1 - ix0 : hasContent ? cx1 - cx0 : W;
    const bh = hasInk ? iy1 - iy0 : hasContent ? cy1 - cy0 : H;
    const wox = bx0 + bw * (0.25 + Math.random() * 0.5);
    const woy = by0 + bh * (0.25 + Math.random() * 0.5);
    const diag = Math.max(40, Math.sqrt(bw * bw + bh * bh));

    // SIZE-RELATIVE burst. `scale` maps the content's ink-diagonal to how far the
    // dust travels: ~0.38 for a two-word reply, ~1.0 for a normal message line,
    // up to ~1.3 for full media. Speed, lift, gravity and the overlay padding all
    // ride off this so a small item gets a tight puff, not a row-spanning spray.
    // Mild size relationship: a reply puffs a touch tighter than full media, but
    // both stay lively and dense. The big difference in cloud size comes for free
    // from how much ink each has.
    const scale = Math.max(0.7, Math.min(1.3, diag / 300));
    const WAVE = 0.34;
    const particles: Particle[] = [];

    const spawnAt = (px: number, py: number, color: string) => {
      const wAngle = Math.atan2(py - woy, px - wox);
      const angle = wAngle + (Math.random() - 0.5) * Math.PI * 1.7;
      const speed = (20 + Math.random() * 70) * scale;
      const dist = Math.sqrt((px - wox) ** 2 + (py - woy) ** 2);
      particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (5 + Math.random() * 48) * scale,
        gravity: (5 + Math.random() * 15) * scale,
        size: (1.3 + Math.random() * 3.0) * (0.75 + 0.25 * scale),
        life: 0.42 + Math.random() * 0.88,
        a0: 0.55 + Math.random() * 0.45,
        color,
        delay: (dist / diag) * WAVE + Math.random() * 0.04,
        t: -1,
      });
    };

    if (eligible.length > 0) {
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
      // Densify sparse content (e.g. a two-word reply) so it reads as a real
      // burst — spawn several jittered particles per sampled pixel when ink is thin.
      const perPx = eligible.length < 140 ? 4 : eligible.length < 300 ? 2 : 1;
      eligible.slice(0, 900).forEach((p) => {
        for (let k = 0; k < perPx; k++) {
          spawnAt(p.px + (Math.random() - 0.5) * STEP, p.py + (Math.random() - 0.5) * STEP, `rgb(${p.r},${p.g},${p.b})`);
        }
      });
    }

    if (particles.length < 40) {
      const regions: Array<{ x: number; y: number; w: number; h: number }> = [];
      el.querySelectorAll('p.text, .img-wrap, .wave, .link-ref').forEach((sub) => {
        const sr = sub.getBoundingClientRect();
        if (sr.width > 2 && sr.height > 2)
          regions.push({ x: sr.left - elRect.left, y: sr.top - elRect.top, w: sr.width, h: sr.height });
      });
      if (regions.length === 0) regions.push(hasContent ? { x: bx0, y: by0, w: bw, h: bh } : { x: 0, y: 0, w: W, h: H });
      const fg = isLight ? 'rgb(30,30,30)' : 'rgb(215,215,215)';
      const N = Math.round(120 + 200 * scale);
      for (let i = 0; i < N; i++) {
        const rr = regions[Math.floor(Math.random() * regions.length)];
        spawnAt(rr.x + Math.random() * rr.w, rr.y + Math.random() * rr.h, fg);
      }
    }

    /* ── Display canvas overlay ──────────────────────────────────────────── */
    // Overlay spans the WHOLE app shell, so the dispersion can drift freely past
    // the message's own row without ever hitting a canvas edge — a clipped edge is
    // what read as a hard "shadow line". Particles just fade out via alpha instead.
    const HW = Math.round(hostRect.width);
    const HH = Math.round(hostRect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = HW * dpr;
    canvas.height = HH * dpr;
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${HW}px;height:${HH}px;pointer-events:none;z-index:200`;
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.translate(ox, oy); // particle coords stay element-local; map into host space

    /* ── Dissolve the source element ─────────────────────────────────────── */
    el.style.transition = 'opacity 420ms cubic-bezier(0.4,0,0.7,1) 30ms';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';

    const t0 = performance.now();
    let prevT = t0;
    const animate = (now: number) => {
      const elapsed = (now - t0) / 1000;
      const DT = Math.min((now - prevT) / 1000, 0.05);
      prevT = now;
      ctx.clearRect(-ox, -oy, HW, HH);
      particles.forEach((p) => {
        if (elapsed < p.delay) return;
        if (p.t < 0) p.t = 0;
        p.t += DT;
        if (p.t >= p.life) return;
        const prog = p.t / p.life;
        const alpha = p.a0 * (1 - prog * prog);
        p.x += p.vx * DT;
        p.y += p.vy * DT;
        p.vy += p.gravity * DT;
        const s = p.size * (1 - prog * 0.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
      });
      if (elapsed < 1.7) requestAnimationFrame(animate);
      else { canvas.remove(); resolve(); }
    };
    requestAnimationFrame(animate);
  });
}
