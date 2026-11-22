(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const focusWindow = byId("focus-window");
  const searchDialog = byId("search-dialog");
  const focusContent = byId("focus-content");
  const searchInput = byId("command-query");
  const resultList = byId("command-results");
  const nav = byId("side-nav");
  const menu = byId("mobile-nav-toggle");
  const navItems = Array.from(nav.querySelectorAll("[data-nav]"));
  const isMobile = matchMedia("(max-width:780px)");
  let openedPane = null;
  let marker = null;
  let opener = null;
  let chosenResult = -1;
  let preferredAnchor = location.hash.slice(1);
  const destinations = [
    ["main","工作台总览"], ["experiment","通信拓扑 · 网络实验台"], ["nodes","节点状态"],
    ["trace","状态极差历程"], ["settling-time","收敛时间对照"], ["atlas","文献主题分布"],
    ["finite-time","有限时间一致性文献库"], ["paper-reader","论文阅读器"],
    ["topics","研究笔记"], ["references","经典参考"]
  ];
  const paperRows = Array.from(byId("paper-list").children).map(row => {
    const code = row.querySelector(".paper-id").textContent.trim();
    const title = row.querySelector(".paper-zh").textContent.trim();
    const original = row.querySelector(".paper-title").textContent;
    return {code, title, words: normalize(title + " " + original)};
  });
  function normalize(value) {
    return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  }
  function setMenu(open) {
    nav.toggleAttribute("data-open", open);
    menu.setAttribute("aria-expanded", String(open));
    menu.textContent = open ? "收起" : "导航";
  }
  function adaptMenu() {
    menu.hidden = !isMobile.matches;
    setMenu(false);
  }
  function restorePane() {
    if (!openedPane || !marker) return;
    marker.replaceWith(openedPane);
    openedPane = marker = null;
    opener?.focus({preventScroll:true});
    opener = null;
  }
  function closeFocus() {
    if (focusWindow.open) focusWindow.close();
    restorePane();
  }
  function expand(button) {
    if (focusWindow.open || searchDialog.open) return;
    openedPane = button.closest(".pane");
    if (!openedPane) return;
    opener = button;
    marker = document.createComment("expanded pane");
    openedPane.before(marker);
    focusContent.append(openedPane);
    byId("focus-title").textContent = openedPane.querySelector(".pane-head h2").textContent + " · 窗口视图";
    focusWindow.showModal();
    byId("close-window").focus({preventScroll:true});
  }
  focusWindow.addEventListener("close", () => { if (!focusWindow.open) restorePane(); });
  byId("close-window").addEventListener("click", closeFocus);
  menu.addEventListener("click", () => setMenu(!nav.hasAttribute("data-open")));
  document.addEventListener("click", e => {
    if (!e.target.closest(".rail") && nav.hasAttribute("data-open")) setMenu(false);
  });
  isMobile.addEventListener("change", adaptMenu);
  adaptMenu();

  function jump(id) {
    const target = byId(id);
    if (!target) return;
    closeFocus();
    preferredAnchor = id;
    setMenu(false);
    if (location.hash !== "#" + id) location.hash = id;
    target.scrollIntoView({block:"start",behavior:"instant"});
    if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
    target.focus({preventScroll:true});
    syncNavigation();
  }
  function syncNavigation() {
    if (focusWindow.open || searchDialog.open) return;
    const edge = isMobile.matches ? 65 : 86;
    let active = navItems[0];
    let lastTop = -Infinity;
    for (const link of navItems) {
      const id = link.hash.slice(1);
      const panel = byId(id);
      const section = getComputedStyle(panel).position === "sticky" ? panel.parentElement : panel;
      const top = section.getBoundingClientRect().top;
      if (top > edge || top < lastTop - 2) continue;
      if (Math.abs(top - lastTop) <= 2 && preferredAnchor !== id) continue;
      active = link;
      lastTop = top;
    }
    for (const link of navItems) {
      if (link === active) link.setAttribute("aria-current","location");
      else link.removeAttribute("aria-current");
    }
    byId("position-label").textContent = active.childNodes[1].textContent.trim();
  }
  let navFrame = 0;
  function queueNavigation() {
    if (!navFrame) navFrame = requestAnimationFrame(() => { navFrame = 0; syncNavigation(); });
  }
  addEventListener("scroll",queueNavigation,{passive:true});
  addEventListener("resize",queueNavigation,{passive:true});
  addEventListener("hashchange",() => {preferredAnchor = location.hash.slice(1); queueNavigation();});
  syncNavigation();

  function addResult(type, title, dataKey, dataValue) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "command-item";
    button.dataset[dataKey] = dataValue;
    const kind = document.createElement("small");
    kind.textContent = type;
    const name = document.createElement("span");
    name.textContent = title;
    button.append(kind, name);
    resultList.append(button);
  }
  function search() {
    const raw = searchInput.value.trim();
    const words = normalize(raw).split(" ").filter(Boolean);
    const isCode = /^\d{1,3}$/.test(raw);
    const hasWords = string => words.every(word => string.includes(word));
    resultList.replaceChildren();
    chosenResult = -1;
    const windows = destinations.filter(([,name]) => hasWords(normalize(name)));
    for (const [id,title] of windows) addResult("窗口",title,"windowId",id);
    const papers = raw ? paperRows.filter(paper => isCode ? Number(raw) === Number(paper.code) : hasWords(paper.words)) : [];
    for (const paper of papers) addResult(paper.code,paper.title,"readPaper",paper.code);
    if (!resultList.children.length) {
      const empty = document.createElement("p");
      empty.className = "command-empty";
      empty.textContent = "没有匹配的窗口或论文，请更换关键词。";
      resultList.append(empty);
    }
    byId("command-status").textContent = "找到 " + windows.length + " 个窗口和 " + papers.length + " 篇论文";
  }
  function openSearch() {
    if (searchDialog.open) return;
    closeFocus();
    setMenu(false);
    searchInput.value = "";
    search();
    searchDialog.showModal();
    searchInput.focus();
  }
  searchInput.addEventListener("input", search);
  byId("open-search").addEventListener("click", openSearch);
  byId("close-search").addEventListener("click", () => searchDialog.close());
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (searchDialog.open) searchDialog.close();
      else openSearch();
    } else if (e.key === "Escape" && nav.hasAttribute("data-open")) {
      setMenu(false);
      menu.focus();
    }
  });
  searchDialog.addEventListener("keydown", e => {
    if (e.isComposing) return;
    const options = Array.from(resultList.querySelectorAll("button"));
    if (!options.length) return;
    if (e.key === "Enter" && (e.target === searchInput || e.target.closest(".command-item"))) {
      e.preventDefault();
      const action = e.target.closest(".command-item") || options[Math.max(chosenResult,0)];
      action.click();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const current = options.indexOf(document.activeElement);
      const next = current < 0 ? (e.key === "ArrowDown" ? 0 : options.length-1) : (current + (e.key === "ArrowDown"?1:-1) + options.length)%options.length;
      chosenResult = next;
      options[next].focus();
    }
  });
  for (const dialog of [focusWindow,searchDialog]) {
    dialog.addEventListener("click", e => {
      if (e.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        if (dialog === focusWindow) closeFocus(); else searchDialog.close();
      }
    });
  }
  document.addEventListener("click", e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const button = e.target.closest("[data-expand]");
    if (button) { expand(button); return; }
    const hit = e.target.closest(".command-item");
    if (hit) {
      searchDialog.close();
      if (hit.dataset.windowId) jump(hit.dataset.windowId);
      if (hit.dataset.readPaper) preferredAnchor = "paper-reader";
      return;
    }
    const link = e.target.closest("a");
    if (!link) return;
    if (link.matches(".paper-link,[data-read-paper]")) { closeFocus(); preferredAnchor = "paper-reader"; return; }
    if (!link.getAttribute("href")?.startsWith("#")) return;
    if (link.dataset.topic) {
      byId("paper-search").value = "";
      byId("time-filter").value = "";
      byId("topic-filter").value = link.dataset.topic;
      byId("topic-filter").dispatchEvent(new Event("change"));
    }
    e.preventDefault();
    jump(link.hash.slice(1));
  },true);
  if (typeof focusWindow.showModal === "function") {
    document.documentElement.classList.add("js-ready");
    byId("open-search").hidden = false;
    if (/Mac|iPhone|iPad/.test(navigator.platform)) byId("key-hint").textContent = "⌘ K";
  }
})();
