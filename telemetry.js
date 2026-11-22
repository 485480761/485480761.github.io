(() => {
  "use strict";

  function initialize() {
    const bars = document.getElementById("node-bars");
    const mean = document.getElementById("node-mean");
    const state = document.getElementById("telemetry-state");
    const chart = document.getElementById("spread-chart");
    const description = document.getElementById("trace-description");
    if (!bars || !chart) return;
    const ctx = chart.getContext("2d");
    let previousTopology = "";
    let samples = [];
    let preview = [];
    let width = 0;
    let height = 0;

    bars.setAttribute("role", "list");
    bars.setAttribute("aria-label", "各节点当前状态");
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "全网状态极差随迭代步数的变化。虚线为模型预演，实线和圆点为本次采样。");
    if (description) chart.setAttribute("aria-describedby", description.id);

    const rows = Array.from({ length: 8 }, (_, index) => {
      const row = document.createElement("div");
      const tag = document.createElement("span");
      const track = document.createElement("span");
      const fill = document.createElement("span");
      const number = document.createElement("span");
      row.className = "node-row";
      row.setAttribute("role", "listitem");
      tag.className = "node-tag";
      tag.textContent = "N" + String(index + 1).padStart(2, "0");
      track.className = "node-track";
      track.setAttribute("aria-hidden", "true");
      fill.className = "node-fill";
      number.className = "node-number";
      track.append(fill);
      row.append(tag, track, number);
      return { row, fill, number };
    });
    bars.replaceChildren(...rows.map(node => node.row));

    function drawChart() {
      if (!ctx || width < 60 || height < 45) return;
      ctx.fillStyle = "#081725";
      ctx.fillRect(0, 0, width, height);
      const left = 30;
      const right = width - 12;
      const top = 32;
      const bottom = height - 24;
      const y = spread => bottom - (bottom - top) * spread;
      const currentStep = samples.length ? samples[samples.length - 1].step : 0;
      const maxStep = Math.max(currentStep, 30);
      const x = step => left + (right - left) * step / maxStep;

      const modelColor = "#bfadff";
      const sampleColor = "#65e6ef";
      ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif';
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const legendWidth = 20 + ctx.measureText("模型预演").width;
      const gap = width >= 260 ? 19 : 9;
      const legendX = Math.max(4, (width - legendWidth * 2 - gap) / 2);
      const keys = [[legendX, "模型预演", modelColor, [4, 3]],
        [legendX + legendWidth + gap, "本次采样", sampleColor, []]];
      for (const [keyX, name, color, dash] of keys) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.8;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(keyX, 12);
        ctx.lineTo(keyX + 15, 12);
        ctx.stroke();
        if (!dash.length) {
          ctx.beginPath();
          ctx.arc(keyX + 7.5, 12, 2.3, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.fillStyle = "#d6e3eb";
        ctx.fillText(name, keyX + 20, 12);
      }
      ctx.setLineDash([]);

      ctx.font = "11px ui-monospace, Consolas, monospace";
      ctx.lineWidth = 1;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      for (const level of [0, 0.25, 0.5, 0.75, 1]) {
        const pos = y(level);
        ctx.strokeStyle = "rgba(126, 176, 205, 0.19)";
        ctx.beginPath();
        ctx.moveTo(left, pos);
        ctx.lineTo(right, pos);
        ctx.stroke();
        if (level === 0 || level === 0.5 || level === 1) {
          ctx.fillStyle = "#adbecf";
          ctx.fillText(level.toFixed(1), left - 6, pos);
        }
      }
      const ticks = [0];
      if (width >= 190) ticks.push(Math.floor(maxStep / 2));
      ticks.push(maxStep);
      for (const tick of ticks) {
        const pos = x(tick);
        ctx.strokeStyle = "rgba(126, 176, 205, 0.15)";
        ctx.beginPath();
        ctx.moveTo(pos, top);
        ctx.lineTo(pos, bottom + 4);
        ctx.stroke();
        ctx.fillStyle = "#adbecf";
        ctx.textAlign = tick === 0 ? "left" : tick === maxStep ? "right" : "center";
        ctx.fillText(String(tick), pos, bottom + 15);
      }
      if (preview.length) {
        ctx.lineWidth = 1.85;
        ctx.lineJoin = "round";
        ctx.strokeStyle = modelColor;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        preview.forEach((spread, step) => {
          if (step === 0) ctx.moveTo(x(step), y(spread));
          else ctx.lineTo(x(step), y(spread));
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (!samples.length) return;
      const first = samples[0];
      const last = samples[samples.length - 1];
      if (samples.length > 1) {
        ctx.beginPath();
        ctx.moveTo(x(first.step), y(first.spread));
        for (let i = 1; i < samples.length; i++) {
          ctx.lineTo(x(samples[i].step), y(samples[i].spread));
        }
        ctx.strokeStyle = sampleColor;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.lineTo(x(last.step), bottom);
        ctx.lineTo(x(first.step), bottom);
        ctx.closePath();
        const area = ctx.createLinearGradient(0, top, 0, bottom);
        area.addColorStop(0, "rgba(76, 212, 227, 0.23)");
        area.addColorStop(1, "rgba(76, 212, 227, 0.02)");
        ctx.fillStyle = area;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x(last.step), y(last.spread), 5.4, 0, 2 * Math.PI);
      ctx.fillStyle = "#123e52";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x(last.step), y(last.spread), 2.9, 0, 2 * Math.PI);
      ctx.fillStyle = "#96f7f7";
      ctx.fill();
    }

    function resize() {
      const box = chart.getBoundingClientRect();
      if (!box.width || !box.height) return;
      width = box.width;
      height = box.height;
      const scale = Math.min(window.devicePixelRatio || 1, 3);
      const pixelWidth = Math.round(width * scale);
      const pixelHeight = Math.round(height * scale);
      if (chart.width !== pixelWidth) chart.width = pixelWidth;
      if (chart.height !== pixelHeight) chart.height = pixelHeight;
      if (ctx) ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      drawChart();
    }

    document.addEventListener("consensus:sample", event => {
      const { topology, topologyName, values, colors, step, playing, finished } = event.detail;
      if (Array.isArray(event.detail.preview)) preview = event.detail.preview;
      let last = samples[samples.length - 1];
      if (topology !== previousTopology || (last && step < last.step)) {
        samples = [];
        last = undefined;
      }
      previousTopology = topology;
      if (!last || last.step !== step) {
        const spread = Math.max(...values) - Math.min(...values);
        samples.push({ step, spread });
        drawChart();
        if (description) {
          const history = samples.length === 1
            ? "第 0 步仅有一个初始样本，全网极差为 " + spread.toFixed(4) + "。"
            : "第 0 至 " + step + " 步，共 " + samples.length + " 个样本。初始全网极差为 "
              + samples[0].spread.toFixed(4) + "，当前为 " + spread.toFixed(4) + "。";
          description.textContent = history + "虚线预演第 0 至 30 步，实线和圆点显示本次采样。";
        }
      }
      rows.forEach(({ row, fill, number }, index) => {
        const value = values[index];
        const readout = value.toFixed(3);
        number.textContent = readout;
        row.setAttribute("aria-label", "节点 " + (index + 1) + "，状态 " + readout);
        if (colors) row.style.setProperty("--node-tone", colors[index]);
        fill.style.width = (100 * Math.max(0, Math.min(1, value))) + "%";
      });
      if (mean) {
        const total = values.reduce((sum, value) => sum + value, 0);
        mean.textContent = (total / values.length).toFixed(3);
      }
      if (state) {
        const status = finished ? "已结束" : playing ? "运行中" : step ? "已暂停" : "初始状态";
        state.textContent = topologyName + "拓扑 · " + status;
      }
    });

    if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(chart);
    window.addEventListener("resize", resize);
    resize();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
