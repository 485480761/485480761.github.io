(() => {
  "use strict";
  const list = document.getElementById("paper-list");
  const field = document.getElementById("paper-search");
  const timeFilter = document.getElementById("time-filter");
  const topicFilter = document.getElementById("topic-filter");
  const reset = document.getElementById("reset-search");
  const rows = Array.from(list.children);
  const range = document.getElementById("paper-range");
  const pageLabel = document.getElementById("page-label");
  const empty = document.getElementById("paper-empty");
  const previous = document.getElementById("page-prev");
  const next = document.getElementById("page-next");
  const pageSize = 10;
  const normalize = value => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}∞]+/gu, " ").trim();
  const entries = rows.map(row => ({
    row,
    id: Number(row.dataset.id),
    title: normalize((row.querySelector(".paper-zh")?.textContent || "") + " " + row.querySelector(".paper-title").textContent),
    times: (row.dataset.times || "unspecified").split(" "),
    topics: (row.dataset.topics || "").split(" ")
  }));
  let matches = entries;
  let page = 0;

  function render() {
    const start = page * pageSize;
    const shown = matches.slice(start, start + pageSize);
    const visible = new Set(shown.map(entry => entry.row));
    rows.forEach(row => { row.hidden = !visible.has(row); });
    const count = matches.length;
    range.textContent = count ? `显示第 ${start + 1}–${start + shown.length} 篇，共 ${count} 篇` : "共 0 篇";
    if (pageLabel) pageLabel.textContent = count ? `第 ${page + 1} / ${Math.ceil(count / pageSize)} 页` : "";
    empty.hidden = count !== 0;
    previous.disabled = page === 0;
    next.disabled = start + pageSize >= count;
  }

  function filter() {
    const query = field.value.normalize("NFKC").trim();
    const number = /^\d{1,3}$/.test(query) ? Number(query) : null;
    const terms = query.split(/\s+/).map(normalize).filter(Boolean);
    matches = entries.filter(entry => {
      const titleMatches = number === null ? terms.every(term => entry.title.includes(term)) : entry.id === number;
      return titleMatches && (!timeFilter?.value || entry.times.includes(timeFilter.value))
        && (!topicFilter?.value || entry.topics.includes(topicFilter.value));
    });
    if (reset) reset.disabled = !query && !timeFilter.value && !topicFilter.value;
    page = 0;
    render();
  }

  function turn(by) {
    page += by;
    render();
    if (list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start", behavior: "instant" });
  }

  field.addEventListener("input", filter);
  timeFilter?.addEventListener("change", filter);
  topicFilter?.addEventListener("change", filter);
  reset?.addEventListener("click", () => {
    field.value = timeFilter.value = topicFilter.value = "";
    filter();
    field.focus();
  });
  previous.addEventListener("click", () => turn(-1));
  next.addEventListener("click", () => turn(1));
  document.getElementById("catalog-tools").hidden = false;
  range.hidden = false;
  document.getElementById("catalog-footer").hidden = false;
  filter();
})();
