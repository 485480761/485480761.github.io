(() => {
  "use strict";

  function initialize() {
    const section = document.getElementById("settling-time");
    if (!section) return;
    const chart = section.querySelector(".settling-chart");
    const slider = section.querySelector(".settling-slider");
    const input = section.querySelector("#initial-error");
    const output = section.querySelector("#initial-output");
    const finiteArrival = section.querySelector("#finite-arrival");
    const fixedArrival = section.querySelector("#fixed-arrival");
    const canvas = section.querySelector("#settling-plot");
    const ctx = canvas.getContext("2d");
    const timeMax = 5;
    const series = [
      { label: "渐近", color: "#52667b", dash: [6, 4],
        error: (t, initial) => initial * Math.exp(-t) },
      { label: "有限时间", color: "#146a52", dash: [],
        error: (t, initial) => Math.max(Math.sqrt(initial) - t / 2, 0) ** 2 },
      { label: "固定时间", color: "#965316", dash: [8, 3, 1.5, 3],
        error: (t, initial) => Math.tan(Math.max(Math.atan(Math.sqrt(initial)) - t / 2, 0)) ** 2 }
    ];

    function line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    function draw(initial, finiteTime, fixedTime) {
      if (!ctx) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const left = 37;
      const right = width - 15;
      const top = 55;
      const bottom = height - 47;
      if (right <= left || bottom <= top) return;
      // Use readable grid intervals even when the slider is at 0.25.
      const errorStep = [0.05, 0.1, 0.25, 0.5, 1].find(step => initial / step <= 5);
      const ticks = Math.ceil(initial / errorStep);
      const maxError = ticks * errorStep;
      const x = t => left + t * (right - left) / timeMax;
      const y = e => bottom - e * (bottom - top) / maxError;
      ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif';
      ctx.textBaseline = "middle";

      // A short key inside the figure is still readable on a narrow phone.
      const keyWidth = 16;
      const keyGap = width < 300 ? 9 : 16;
      const keyWidths = series.map(s => keyWidth + 5 + ctx.measureText(s.label).width);
      const combinedWidth = keyWidths.reduce((a, b) => a + b, 0) + keyGap * 2;
      let keyX = Math.max(4, (width - combinedWidth) / 2);
      ctx.textAlign = "left";
      series.forEach((s, i) => {
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = s.color;
        ctx.setLineDash(s.dash);
        line(keyX, 14, keyX + keyWidth, 14);
        ctx.fillStyle = "#313e44";
        ctx.fillText(s.label, keyX + keyWidth + 5, 14);
        keyX += keyWidths[i] + keyGap;
      });
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.fillStyle = "#435156";
      ctx.fillText("误差 e", left, top - 16);
      ctx.textAlign = "right";
      ctx.fillText("时间 t", right, height - 9);
      for (let i = 0; i <= ticks; i++) {
        const value = i * errorStep;
        ctx.strokeStyle = i === 0 ? "#7a8c8a" : "#d2ddda";
        line(left, y(value), right, y(value));
        ctx.fillText(String(Number(value.toFixed(2))), left - 7, y(value));
      }
      ctx.textAlign = "center";
      for (let t = 0; t <= timeMax; t++) {
        ctx.strokeStyle = t === 0 ? "#7a8c8a" : "#e2e9e5";
        line(x(t), top, x(t), bottom);
        ctx.fillText(String(t), x(t), bottom + 17);
      }

      ctx.strokeStyle = "#81715c";
      ctx.fillStyle = "#725a3a";
      ctx.setLineDash([3, 5]);
      line(x(Math.PI), top, x(Math.PI), bottom);
      ctx.fillText("上界 π", x(Math.PI), top - 16);

      // Include the exact zero crossing as a vertex of each finite curve.
      const samples = Math.max(90, Math.ceil(right - left));
      const times = Array.from({length: samples + 1}, (_, i) => i * timeMax / samples);
      times.push(finiteTime, fixedTime);
      times.sort((a, b) => a - b);
      series.forEach(s => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.35;
        ctx.setLineDash(s.dash);
        ctx.beginPath();
        times.forEach((t, i) => {
          const xp = x(t);
          const yp = y(s.error(t, initial));
          if (i === 0) ctx.moveTo(xp, yp);
          else ctx.lineTo(xp, yp);
        });
        ctx.stroke();
      });
      ctx.setLineDash([]);
      // The two pointers touch the zero axis from opposite sides so close
      // arrival times remain distinguishable at the smallest initial error.
      const xf = x(finiteTime);
      ctx.fillStyle = series[1].color;
      ctx.beginPath();
      ctx.moveTo(xf, bottom);
      ctx.lineTo(xf - 4, bottom - 4);
      ctx.lineTo(xf, bottom - 8);
      ctx.lineTo(xf + 4, bottom - 4);
      ctx.closePath();
      ctx.fill();
      const xx = x(fixedTime);
      ctx.fillStyle = series[2].color;
      ctx.beginPath();
      ctx.moveTo(xx, bottom);
      ctx.lineTo(xx - 4.5, bottom + 7);
      ctx.lineTo(xx + 4.5, bottom + 7);
      ctx.closePath();
      ctx.fill();
    }

    function update() {
      const initial = Number(input.value);
      const root = Math.sqrt(initial);
      const finiteTime = 2 * root;
      const fixedTime = 2 * Math.atan(root);
      output.value = initial.toFixed(2);
      finiteArrival.textContent = finiteTime.toFixed(2);
      fixedArrival.textContent = fixedTime.toFixed(2);
      draw(initial, finiteTime, fixedTime);
    }

    slider.hidden = false;
    chart.hidden = !ctx;
    section.querySelector("#settling-caption").hidden = !ctx;
    input.addEventListener("input", update);
    if (ctx) {
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(update).observe(canvas);
      window.addEventListener("resize", update);
    }
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
