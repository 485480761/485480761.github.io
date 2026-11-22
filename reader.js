(() => {
  "use strict";
  const pane = document.getElementById("paper-reader");
  const host = document.getElementById("reader-host");
  if (!pane || !host) return;

  const entries = new Map();
  for (const row of document.querySelectorAll("#paper-list li[data-id]")) {
    const link = row.querySelector("a.paper-link");
    if (!link) continue;
    entries.set(Number(row.dataset.id), {
      id: row.dataset.id.padStart(3, "0"),
      title: row.querySelector(".paper-zh")?.textContent || row.querySelector(".paper-title")?.textContent,
      url: link.href
    });
  }
  const first = entries.get(11);
  if (!first) return;

  host.innerHTML = `
    <div class="reader-meta">
      <div class="reader-ident"><span class="reader-number"></span><strong class="reader-title"></strong></div>
      <a class="reader-original" target="_blank" rel="noopener">打开原 PDF</a>
    </div>
    <div class="reader-bar" role="group" aria-label="论文阅读工具" hidden>
      <div class="reader-pages">
        <button type="button" class="reader-prev" aria-label="上一页" title="上一页">上一页</button>
        <label class="reader-page-jump"><span>页码</span><input type="number" min="1" value="1" step="1" inputmode="numeric" aria-label="跳转到页码"></label>
        <span class="reader-total"></span>
        <button type="button" class="reader-next" aria-label="下一页" title="下一页">下一页</button>
      </div>
      <label class="reader-zoom"><span>缩放</span><select aria-label="页面缩放">
        <option value="1">适合宽度</option><option value="1.5">适宽的 150%</option>
        <option value="2">适宽的 200%</option><option value="3">适宽的 300%</option>
      </select></label>
    </div>
    <div class="reader-viewport" tabindex="0" role="region" aria-label="论文页面，可滚动阅读">
      <div class="reader-sheet"></div>
    </div>
    <div class="reader-preview">
      <img src="previews/011.webp" width="440" height="570" loading="lazy" alt="第 011 篇论文的首页缩略图">
      <button type="button" class="reader-start">在此阅读</button>
    </div>
    <div class="reader-feedback">
      <span class="reader-status" role="status" aria-live="polite"></span>
      <button type="button" class="reader-retry" hidden>重新载入</button>
    </div>`;
  const find = selector => host.querySelector(selector);
  const preview = find(".reader-preview");
  const viewport = find(".reader-viewport");
  const sheet = find(".reader-sheet");
  const bar = find(".reader-bar");
  const previous = find(".reader-prev");
  const next = find(".reader-next");
  const pageInput = find(".reader-page-jump input");
  const zoomInput = find(".reader-zoom select");
  const status = find(".reader-status");
  const retry = find(".reader-retry");
  const base = new URL("vendor/pdfjs-6.5.438/", document.baseURI);
  let selected = first;
  let pdfLibrary;
  let loading = null;
  let pdf = null;
  let renderTask = null;
  let documentVersion = 0;
  let renderVersion = 0;
  let number = 1;
  let fitWidth = 0;
  let resizeTimer;

  function updateTitle() {
    find(".reader-number").textContent = selected.id;
    find(".reader-title").textContent = selected.title;
    find(".reader-original").href = selected.url;
  }

  function updateControls() {
    if (!pdf) return;
    previous.disabled = number === 1;
    next.disabled = number === pdf.numPages;
    pageInput.value = number;
    pageInput.max = pdf.numPages;
    find(".reader-total").textContent = "/ " + pdf.numPages;
  }

  function fail() {
    status.textContent = location.protocol === "file:" ? "从本地文件浏览时，请使用“打开原 PDF”。" :
      (navigator.onLine ? "这一页暂时无法显示。可重新载入，或打开原 PDF。" : "当前离线。可在联网后重试，或打开已保存的 PDF。");
    retry.hidden = location.protocol === "file:";
    viewport.removeAttribute("aria-busy");
  }

  async function draw() {
    if (!pdf) return;
    const version = ++renderVersion;
    renderTask?.cancel();
    renderTask = null;
    const pageNumber = number;
    viewport.setAttribute("aria-busy", "true");
    retry.hidden = true;
    updateControls();
    try {
      const page = await pdf.getPage(pageNumber);
      if (version !== renderVersion) return;
      // The viewport owns scrolling. Zoom must never enlarge the outer document.
      const style = getComputedStyle(viewport);
      fitWidth = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (fitWidth < 1) return;
      const target = page.getViewport({ scale: fitWidth * Number(zoomInput.value) / page.getViewport({ scale: 1 }).width });
      // Cap the backing bitmap while preserving CSS zoom on memory-limited devices.
      const pixelScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4600000 / (target.width * target.height)));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(target.width * pixelScale));
      canvas.height = Math.max(1, Math.round(target.height * pixelScale));
      canvas.style.width = Math.round(target.width) + "px";
      canvas.style.height = Math.round(target.height) + "px";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", selected.title + "，第 " + pageNumber + " 页");
      const task = page.render({
        canvas, viewport: target, background: "white",
        transform: [canvas.width / target.width, 0, 0, canvas.height / target.height, 0, 0]
      });
      renderTask = task;
      await task.promise;
      if (version !== renderVersion) return;
      renderTask = null;
      sheet.replaceChildren(canvas);
      viewport.scrollTo(0, 0);
      viewport.removeAttribute("aria-busy");
      status.textContent = "第 " + pageNumber + " 页，共 " + pdf.numPages + " 页";
    } catch (error) {
      if (version === renderVersion && error.name !== "RenderingCancelledException") {
        sheet.replaceChildren();
        fail();
      }
    }
  }

  async function open(entry, moveFocus = true) {
    const version = ++documentVersion;
    renderVersion++;
    renderTask?.cancel();
    renderTask = null;
    const old = loading;
    loading = null;
    pdf = null;
    selected = entry;
    number = 1;
    zoomInput.value = "1";
    updateTitle();
    sheet.replaceChildren();
    preview.hidden = true;
    bar.hidden = true;
    retry.hidden = true;
    viewport.hidden = false;
    viewport.setAttribute("aria-busy", "true");
    status.textContent = "正在打开第 " + entry.id + " 篇论文…";
    if (moveFocus) {
      requestAnimationFrame(() => {
        if (version !== documentVersion) return;
        const heading = pane.querySelector("h2");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
        pane.scrollIntoView({ block: "start", behavior: "instant" });
      });
    }
    try {
      if (old) await old.destroy().catch(() => {});
      if (version !== documentVersion) return;
      if (location.protocol === "file:") { fail(); return; }
      pdfLibrary ||= await import(new URL("pdf.min.mjs", base).href);
      if (version !== documentVersion) return;
      pdfLibrary.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", base).href;
      loading = pdfLibrary.getDocument({
        url: entry.url, cMapUrl: new URL("cmaps/", base).href, cMapPacked: true,
        standardFontDataUrl: new URL("standard_fonts/", base).href, iccUrl: new URL("iccs/", base).href,
        wasmUrl: new URL("wasm/", base).href, disableWorkerRendering: true,
        isEvalSupported: false, enableXfa: false
      });
      const document = await loading.promise;
      if (version !== documentVersion) return;
      pdf = document;
      bar.hidden = false;
      await draw();
    } catch {
      if (version === documentVersion) fail();
    }
  }

  function goTo(value) {
    if (!pdf) return;
    const target = Math.max(1, Math.min(pdf.numPages, Math.trunc(Number(value))));
    if (Number.isFinite(target) && target !== number) {
      number = target;
      draw();
    } else {
      updateControls();
    }
  }

  updateTitle();
  viewport.hidden = true;
  find(".reader-start").addEventListener("click", () => open(selected, false));
  retry.addEventListener("click", () => pdf ? draw() : open(selected, false));
  previous.addEventListener("click", () => goTo(number - 1));
  next.addEventListener("click", () => goTo(number + 1));
  pageInput.addEventListener("change", () => goTo(pageInput.value || number));
  pageInput.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); goTo(pageInput.value || number); }
  });
  zoomInput.addEventListener("change", draw);
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const trigger = event.target.closest?.("#paper-list a.paper-link, [data-read-paper]");
    if (!trigger) return;
    const id = trigger.getAttribute("data-read-paper") || trigger.closest("li[data-id]")?.dataset.id;
    const entry = entries.get(Number(id));
    if (entry) { event.preventDefault(); open(entry); }
  });
  document.addEventListener("reader:open", event => {
    const entry = entries.get(Number(event.detail?.id ?? event.detail));
    if (entry) open(entry);
  });
  function onResize() {
    if (!pdf) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const style = getComputedStyle(viewport);
      const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (width > 0 && Math.abs(width - fitWidth) > 1) draw();
    }, 90);
  }
  if (typeof ResizeObserver === "function") new ResizeObserver(onResize).observe(viewport);
  else window.addEventListener("resize", onResize);
})();
