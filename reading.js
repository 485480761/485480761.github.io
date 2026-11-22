(() => {
  "use strict";
  const list = document.getElementById("paper-list");
  const field = document.getElementById("paper-search");
  const rows = Array.from(list.children);
  const range = document.getElementById("paper-range");
  const empty = document.getElementById("paper-empty");
  const previous = document.getElementById("page-prev");
  const next = document.getElementById("page-next");
  const pageSize = 10;
  const normalize = value => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const entries = rows.map(row => ({
    row,
    id: Number(row.dataset.id),
    title: normalize(row.querySelector(".paper-title").textContent)
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
    empty.hidden = count !== 0;
    previous.disabled = page === 0;
    next.disabled = start + pageSize >= count;
  }

  function filter() {
    const query = normalize(field.value);
    const number = /^\d{1,3}$/.test(query) ? Number(query) : null;
    const terms = query.split(/\s+/).filter(Boolean);
    matches = number === null
      ? entries.filter(entry => terms.every(term => entry.title.includes(term)))
      : entries.filter(entry => entry.id === number);
    page = 0;
    render();
  }

  function turn(by) {
    page += by;
    render();
    if (list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start", behavior: "instant" });
  }

  field.addEventListener("input", filter);
  previous.addEventListener("click", () => turn(-1));
  next.addEventListener("click", () => turn(1));
  document.getElementById("catalog-tools").hidden = false;
  document.getElementById("catalog-footer").hidden = false;
  filter();
})();
