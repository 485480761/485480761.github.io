(() => {
  "use strict";

  const initialValues = [0.86, 0.78, 0.94, 0.62, 0.14, 0.22, 0.06, 0.38];
  const allNodes = initialValues.map((_, i) => i);
  const chainEdges = allNodes.slice(1).map(i => [i - 1, i]);
  const topologies = {
    ring:  { name: "环形", edges: [...chainEdges, [7, 0]], groups: [allNodes] },
    chain: { name: "链式", edges: chainEdges, groups: [allNodes] },
    split: {
      name: "双分组",
      edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4]],
      groups: [[0, 1, 2, 3], [4, 5, 6, 7]]
    }
  };

  // Both endpoints use the previous step. Each undirected edge transfers
  // equal and opposite increments, preserving the total in its component.
  function advance(values, edges) {
    const next = values.slice();
    for (const [i, j] of edges) {
      const flow = 0.15 * (values[j] - values[i]);
      next[i] += flow;
      next[j] -= flow;
    }
    return next;
  }

  const spread = values => Math.max(...values) - Math.min(...values);
  const stable = (values, groups) =>
    groups.every(group => spread(group.map(i => values[i])) < 0.0001);

  function previewSpreads(edges) {
    let predicted = initialValues.slice();
    const series = [spread(predicted)];
    for (let k = 1; k <= 30; k++) {
      predicted = advance(predicted, edges);
      series.push(spread(predicted));
    }
    return Object.freeze(series);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { initialValues, topologies, advance, spread, stable };
  }
  if (typeof document === "undefined") return;

  function initialize() {
    const canvas = document.getElementById("network");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const toggle = document.getElementById("sim-toggle");
    const reset = document.getElementById("sim-reset");
    const stepButton = document.getElementById("sim-step");
    const topologyButtons = document.querySelectorAll("button[data-topology]");
    const stepValue = document.getElementById("step-value");
    const spreadValue = document.getElementById("spread-value");
    const summary = document.getElementById("network-summary");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const period = 280;
    const limit = 1000;
    let topology = "ring";
    let values = initialValues.slice();
    let steps = 0;
    let playing = false;
    let frame = 0;
    let previousTick = 0;
    let width = 0;
    let height = 0;
    let finished = false;
    const previews = Object.fromEntries(Object.entries(topologies).map(
      ([name, graph]) => [name, previewSpreads(graph.edges)]
    ));
    let nodes = [];
    let labels = [];

    // The top and bottom margins include the labels outside the ellipse.
    function positions() {
      const rx = Math.max(0, width / 2 - 28);
      const ry = Math.max(0, height / 2 - 35);
      if (topology !== "split") {
        return allNodes.map(i => {
          const angle = (i - 1.5) * Math.PI / 4;
          return [width / 2 + rx * Math.cos(angle), height / 2 + ry * Math.sin(angle)];
        });
      }
      const horizontal = width >= height;
      return allNodes.map(i => {
        const direction = i < 4 ? -1 : 1;
        const cx = width / 2 + (horizontal ? direction * rx * 0.6 : 0);
        const cy = height / 2 + (horizontal ? 0 : direction * ry * 0.62);
        const angle = ((i % 4) - 1) * Math.PI / 2;
        return [
          cx + (horizontal ? rx * 0.4 : rx * 0.66) * Math.cos(angle),
          cy + (horizontal ? ry * 0.72 : ry * 0.38) * Math.sin(angle)
        ];
      });
    }

    function layout() {
      nodes = positions();
      labels = [];
      for (const [x, y] of nodes) {
        const horizontal = x < width / 2 ? -1 : 1;
        const vertical = y < height / 2 ? -1 : 1;
        const offsets = [[0, 25 * vertical], [0, -25 * vertical],
          [34 * horizontal, 0], [-34 * horizontal, 0],
          [24 * horizontal, 19 * vertical], [-24 * horizontal, 19 * vertical]];
        const free = offsets.find(([dx, dy]) => {
          const lx = x + dx, ly = y + dy;
          if (lx < 19 || lx > width - 19 || ly < 9 || ly > height - 9) return false;
          // Rectangle-to-circle distance for the four-digit readout and
          // node outline. Also reserve space for previously placed labels.
          return nodes.every(([nx, ny]) => Math.hypot(
            Math.max(0, Math.abs(nx - lx) - 17), Math.max(0, Math.abs(ny - ly) - 7)
          ) >= 16) && labels.every(([lx0, ly0]) =>
            Math.abs(lx0 - lx) >= 36 || Math.abs(ly0 - ly) >= 17);
        }) || offsets[0];
        labels.push([x + free[0], y + free[1]]);
      }
    }

    function nodeColor(value) {
      const low = [83, 226, 239];
      const high = [247, 190, 108];
      const t = Math.max(0, Math.min(1, value));
      return `rgb(${low.map((v, i) => Math.round(v + (high[i] - v) * t)).join(",")})`;
    }

    function circle(x, y, radius) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }

    function draw(progress = 0) {
      if (!ctx || !width || !height) return;
      ctx.clearRect(0, 0, width, height);
      const edges = topologies[topology].edges;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(104, 214, 231, 0.7)";
      for (const [i, j] of edges) {
        const [x, y] = nodes[i];
        const [endX, endY] = nodes[j];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        if (playing && !motion.matches) {
          ctx.fillStyle = "rgba(154, 234, 232, 0.70)";
          for (const t of [progress * 0.5, 1 - progress * 0.5]) {
            circle(x + (endX - x) * t, y + (endY - y) * t, 1.7);
            ctx.fill();
          }
        }
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      nodes.forEach(([x, y], i) => {
        const color = nodeColor(values[i]);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.09;
        circle(x, y, 19);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.48;
        circle(x, y, 15.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        circle(x, y, 11.8);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = "#132129";
        ctx.font = '600 13px ui-monospace, Consolas, monospace';
        ctx.fillText(String(i + 1), x, y + 0.5);
        ctx.font = '13px ui-monospace, Consolas, monospace';
        const label = values[i].toFixed(2);
        const [labelX, labelY] = labels[i];
        // Mask any edge passing behind the readout.
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#101c24";
        ctx.strokeText(label, labelX, labelY);
        ctx.fillStyle = "#e4efee";
        ctx.fillText(label, labelX, labelY);
      });
    }

    function resize() {
      const box = canvas.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      width = box.width;
      height = box.height;
      const scale = Math.min(window.devicePixelRatio || 1, 3);
      const pixelWidth = Math.round(width * scale);
      const pixelHeight = Math.round(height * scale);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      if (ctx) ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      layout();
      draw();
    }

    function updateReadout() {
      stepValue.textContent = String(steps);
      spreadValue.textContent = spread(values).toFixed(3);
      toggle.textContent = playing ? "暂停" : "运行";
      toggle.disabled = finished;
      if (stepButton) stepButton.disabled = playing || finished;
      topologyButtons.forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.topology === topology));
      });
      if (summary) {
        const state = finished ? "已停止" : playing ? "运行中" : "已暂停";
        const readouts = values.map((v, i) => `节点${i + 1}为${v.toFixed(2)}`);
        summary.textContent = `${topologies[topology].name}网络，${state}，第${steps}步。${readouts.join("，")}。`;
      }
      // Controls may change without advancing the model. Subscribers receive
      // the same step for those transitions and a fresh snapshot each time.
      document.dispatchEvent(new CustomEvent("consensus:sample", {
        bubbles: true,
        detail: {
          topology, topologyName: topologies[topology].name,
          values: values.slice(), colors: values.map(nodeColor),
          step: steps, playing, finished, preview: previews[topology]
        }
      }));
    }

    function pause() {
      playing = false;
      window.cancelAnimationFrame(frame);
      updateReadout();
      draw();
    }

    function step() {
      values = advance(values, topologies[topology].edges);
      steps += 1;
      finished = stable(values, topologies[topology].groups) || steps >= limit;
      if (finished) playing = false;
      updateReadout();
      draw();
    }

    function animate(timestamp) {
      if (!playing) return;
      if (timestamp - previousTick >= period) {
        previousTick = timestamp;
        step();
      } else if (!motion.matches) {
        draw((timestamp - previousTick) / period);
      }
      if (playing) frame = window.requestAnimationFrame(animate);
    }

    function restart() {
      values = initialValues.slice();
      steps = 0;
      finished = false;
      pause();
    }

    toggle.addEventListener("click", () => {
      if (playing) return pause();
      if (finished) return;
      playing = true;
      previousTick = performance.now();
      updateReadout();
      frame = window.requestAnimationFrame(animate);
    });
    reset.addEventListener("click", restart);
    stepButton?.addEventListener("click", () => {
      if (!playing && !finished) step();
    });
    topologyButtons.forEach(button => button.addEventListener("click", () => {
      const selected = button.dataset.topology;
      if (selected !== topology && Object.hasOwn(topologies, selected)) {
        topology = selected;
        layout();
        restart();
      }
    }));
    if (summary) canvas.setAttribute("aria-describedby", summary.id);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(resize).observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && playing) pause();
    });
    updateReadout();
    resize();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
