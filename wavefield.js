(() => {
  "use strict";

  function mount() {
    const canvas = document.getElementById("field-scene");
    if (!canvas) return;
    const button = document.getElementById("field-motion");
    const slider = document.getElementById("field-phase");
    const output = document.getElementById("field-phase-value");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (button) button.disabled = true;
      if (slider) slider.disabled = true;
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let playing = !motion.matches;
    let onScreen = false;
    let frame = 0;
    let last = null;
    let time = 0;
    let phase = Number(slider?.value) || 0;
    let width = 0;
    let height = 0;
    let columns = 0;
    let rows = 0;
    let points = [];
    let surfacePaint, wirePaint, pointPaint, backdrop;

    // Both radial waves use k = 3.5 and omega = 1.35. Cache the two
    // quadratures at each sample so animation needs no per-point trig.
    function project(u, v) {
      return [width * (0.5 + 0.363 * u - 0.124 * v),
              height * (0.48 + 0.113 * u + 0.167 * v)];
    }

    function makeLattice() {
      columns = Math.max(42, Math.min(90, Math.round(width / 5.75)));
      rows = Math.max(26, Math.min(49, Math.round(columns * 0.55)));
      points = [];
      for (let r = 0; r <= rows; r++) {
        const v = 2 * r / rows - 1;
        const row = [];
        for (let c = 0; c <= columns; c++) {
          const u = 2 * c / columns - 1;
          const x = u * 3.75;
          const y = v * 2.55;
          const r1 = Math.hypot(x + 1.32, y + 0.38);
          const r2 = Math.hypot(x - 1.32, y - 0.38);
          const a1 = 0.5 / Math.sqrt(1 + 0.40 * r1);
          const a2 = 0.5 / Math.sqrt(1 + 0.40 * r2);
          const [sx, baseY] = project(u, v);
          row.push({ x: sx, baseY, y: baseY, z: 0,
            a: a1 * Math.cos(3.5 * r1), b: a1 * Math.sin(3.5 * r1),
            c: a2 * Math.cos(3.5 * r2), d: a2 * Math.sin(3.5 * r2) });
        }
        points.push(row);
      }
    }

    function preparePaint() {
      // Transparent outer edge lets the illustration blend into the hero.
      backdrop = ctx.createRadialGradient(width * 0.52, height * 0.5, 0,
        width * 0.52, height * 0.5, width * 0.52);
      backdrop.addColorStop(0, "rgba(19,49,79,0.64)");
      backdrop.addColorStop(0.62, "rgba(13,34,69,0.30)");
      backdrop.addColorStop(1, "rgba(10,24,53,0)");
      surfacePaint = ctx.createLinearGradient(0, 0, width, height);
      surfacePaint.addColorStop(0, "#102137");
      surfacePaint.addColorStop(0.45, "#123245");
      surfacePaint.addColorStop(0.72, "#202640");
      surfacePaint.addColorStop(1, "#102334");
      wirePaint = ctx.createLinearGradient(0, height * 0.75, width, height * 0.2);
      wirePaint.addColorStop(0, "#558abb");
      wirePaint.addColorStop(0.25, "#71cbe8");
      wirePaint.addColorStop(0.48, "#6ef2ec");
      wirePaint.addColorStop(0.64, "#72b5f5");
      wirePaint.addColorStop(0.8, "#ac96ff");
      wirePaint.addColorStop(1, "#79a9dd");
      pointPaint = ctx.createLinearGradient(0, height, width, 0);
      pointPaint.addColorStop(0, "#87c9fb");
      pointPaint.addColorStop(0.43, "#bdffff");
      pointPaint.addColorStop(0.69, "#a8cfff");
      pointPaint.addColorStop(0.82, "#d0c6ff");
      pointPaint.addColorStop(1, "#bbdaff");
    }

    function basePlane() {
      const drop = height * 0.215;
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = "rgba(100,164,201,0.17)";
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const k = i / 4 - 1;
        for (const [a, b] of [[project(k, -1), project(k, 1)], [project(-1, k), project(1, k)]]) {
          ctx.moveTo(a[0], a[1] + drop);
          ctx.lineTo(b[0], b[1] + drop);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(113,189,222,0.27)";
      ctx.beginPath();
      for (const row of [points[0], points[rows]]) {
        for (const p of [row[0], row[columns]]) {
          ctx.moveTo(p.x, p.baseY + drop);
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }

    function render() {
      if (!width || !height) return;
      const t = 1.35 * time;
      const A = Math.cos(t), B = Math.sin(t);
      const C = Math.cos(t - phase), D = Math.sin(t - phase);
      const relief = height * 0.27;
      for (const row of points) {
        for (const p of row) {
          p.z = p.a * A + p.b * B + p.c * C + p.d * D;
          p.y = p.baseY - relief * p.z;
        }
      }
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, width, height);
      basePlane();
      // Draw rows back-to-front. Filled ribbons hide grid lines behind a
      // peak while the crossing strokes expose the local surface slopes.
      for (let r = 0; r <= rows; r++) {
        const row = points[r];
        const depth = r / rows;
        if (r > 0) {
          const previous = points[r - 1];
          ctx.beginPath();
          ctx.moveTo(previous[0].x, previous[0].y);
          for (let c = 1; c <= columns; c++) ctx.lineTo(previous[c].x, previous[c].y);
          for (let c = columns; c >= 0; c--) ctx.lineTo(row[c].x, row[c].y);
          ctx.closePath();
          ctx.globalAlpha = 0.94;
          ctx.fillStyle = surfacePaint;
          ctx.fill();
          ctx.globalAlpha = 0.13 + depth * 0.32;
          ctx.lineWidth = 0.65;
          ctx.strokeStyle = wirePaint;
          ctx.beginPath();
          for (let c = 0; c <= columns; c += 2) {
            ctx.moveTo(previous[c].x, previous[c].y);
            ctx.lineTo(row[c].x, row[c].y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 0.32 + depth * 0.53;
        ctx.strokeStyle = wirePaint;
        ctx.lineWidth = 0.82 + depth * 0.43;
        ctx.beginPath();
        ctx.moveTo(row[0].x, row[0].y);
        for (let c = 1; c <= columns; c++) ctx.lineTo(row[c].x, row[c].y);
        ctx.stroke();
        // A narrow highlight on upward relief makes the crests legible
        // without assigning a second scientific quantity to the colours.
        ctx.globalAlpha = 0.22 + depth * 0.47;
        ctx.strokeStyle = pointPaint;
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        for (let c = 1; c <= columns; c++) {
          if (row[c - 1].z + row[c].z < 0.52) continue;
          ctx.moveTo(row[c - 1].x, row[c - 1].y);
          ctx.lineTo(row[c].x, row[c].y);
        }
        ctx.stroke();
        if (r % 2 === 0) {
          ctx.globalAlpha = 0.43 + depth * 0.46;
          ctx.fillStyle = pointPaint;
          ctx.beginPath();
          for (let c = 0; c <= columns; c += 2) {
            const p = row[c];
            const radius = 0.58 + 0.45 * depth + 0.42 * Math.max(0, p.z);
            ctx.moveTo(p.x + radius, p.y);
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function resize() {
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      width = box.width;
      height = box.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const backingW = Math.round(width * dpr), backingH = Math.round(height * dpr);
      if (canvas.width !== backingW) canvas.width = backingW;
      if (canvas.height !== backingH) canvas.height = backingH;
      ctx.setTransform(backingW / width, 0, 0, backingH / height, 0, 0);
      makeLattice();
      preparePaint();
      render();
    }

    function tick(now) {
      if (last === null) last = now;
      const dt = (now - last) / 1000;
      if (dt >= (width < 380 ? 1 / 24 : 1 / 30)) {
        time += Math.min(dt, 0.15);
        last = now;
        render();
      }
      frame = window.requestAnimationFrame(tick);
    }

    function syncMotion() {
      window.cancelAnimationFrame(frame);
      last = null;
      if (button) {
        const label = button.querySelector("[data-motion-label]") || button;
        label.textContent = playing ? "暂停" : "播放";
        button.setAttribute("aria-label", playing ? "暂停波场演化" : "播放波场演化");
      }
      if (playing && onScreen && !document.hidden) frame = window.requestAnimationFrame(tick);
    }

    function setPhase() {
      phase = Number(slider?.value) || 0;
      if (output) output.value = phase.toFixed(2) + " rad";
      slider?.setAttribute("aria-valuetext", phase.toFixed(2) + " 弧度");
      render();
    }

    button?.addEventListener("click", () => {
      playing = !playing;
      syncMotion();
    });
    slider?.addEventListener("input", setPhase);
    motion.addEventListener("change", () => {
      playing = !motion.matches;
      syncMotion();
    });
    document.addEventListener("visibilitychange", syncMotion);
    if (typeof IntersectionObserver !== "undefined") {
      new IntersectionObserver(entries => {
        onScreen = entries[0].isIntersecting;
        syncMotion();
      }).observe(canvas);
    } else {
      onScreen = true;
    }
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(canvas);
    window.addEventListener("resize", resize);
    resize();
    setPhase();
    syncMotion();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
