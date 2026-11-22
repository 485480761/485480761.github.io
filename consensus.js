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

    // Keep node centers away from the boundary, including the state label
    // below each node. Split components form separate diamonds.
    function positions() {
      const inset = 44;
      const rx = Math.max(0, width / 2 - inset);
      const ry = Math.max(0, height / 2 - inset);
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

    function nodeColor(value) {
      const low = [93, 216, 216];
      const high = [247, 188, 99];
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
      const nodes = positions();
      const edges = topologies[topology].edges;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(108, 207, 207, 0.64)";
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
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.27;
        circle(x, y, 16);
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
        // Mask any edge passing behind the readout.
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#101c24";
        ctx.strokeText(label, x, y + 27);
        ctx.fillStyle = "#e4efee";
        ctx.fillText(label, x, y + 27);
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
