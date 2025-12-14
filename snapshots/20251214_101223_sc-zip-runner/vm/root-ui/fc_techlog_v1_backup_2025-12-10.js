// fc_techlog_v1.js
// SAP-style function-module for tile 13.1 – Technical Log – All Artefacts.
// No changes needed in index.html; this file auto-detects when the
// 13.1 node (key: fc.techlog.all) is active and then renders itself.

(function () {
  const API_URL = "/api/readiness/techlog";

  // ---- DOM helpers ---------------------------------------------------------
  function getDom() {
    const detailTitleEl = document.getElementById("detailTitle");
    const detailPathEl = document.getElementById("detailPath");
    const detailMetaEl = document.getElementById("detailMeta");
    const detailBodyEl = document.getElementById("detailBody");
    let detailTableContainer = document.getElementById("detailTableContainer");

    if (!detailTitleEl || !detailPathEl || !detailMetaEl || !detailBodyEl) {
      console.warn("[FC-TECHLOG] Detail panel elements missing.");
      return null;
    }

    if (!detailTableContainer) {
      detailTableContainer = document.createElement("div");
      detailTableContainer.id = "detailTableContainer";
      detailTableContainer.style.marginTop = "12px";
      detailBodyEl.parentNode.insertBefore(
        detailTableContainer,
        detailBodyEl.nextSibling
      );
    }

    return {
      detailTitleEl,
      detailPathEl,
      detailMetaEl,
      detailBodyEl,
      detailTableContainer,
    };
  }

  // ---- State ---------------------------------------------------------------
  let allRows = [];
  let filteredRows = [];
  let currentSort = { field: null, dir: 1 };
  let currentFilters = {};
  let lastRenderToken = null; // to avoid double-render in observer

  const COLUMNS = [
    { field: "TECH_ID", label: "TECH_ID" },
    { field: "OBJECT_TYPE", label: "Object Type" },
    { field: "OBJECT_NAME", label: "Object Name" },
    { field: "OBJECT_PATH", label: "Object Path" },
    { field: "TILE_IDS", label: "Tiles" },
    { field: "AIW_TABLES_USED", label: "AIW Tables" },
    { field: "FC_TABLES_USED", label: "FC Tables" },
    { field: "AGENTS_RELATED", label: "Agents" },
    { field: "READINESS_ITEMS", label: "Readiness Items" },
    { field: "VERSION", label: "Version" },
    { field: "STATUS", label: "Status" },
    { field: "LAST_UPDATED_AT", label: "Last Updated At" },
  ];

  function normalize(str) {
    return (str || "").toString().toLowerCase();
  }

  // ---- Filtering & sorting -------------------------------------------------
  function applyFilters() {
    filteredRows = allRows.filter((row) => {
      for (const [field, value] of Object.entries(currentFilters)) {
        if (!value) continue;
        const cell = row[field];
        if (!normalize(cell).includes(normalize(value))) return false;
      }
      return true;
    });
  }

  function applySort() {
    if (!currentSort.field) return;
    const field = currentSort.field;
    const dir = currentSort.dir;

    filteredRows.sort((a, b) => {
      const av = (a[field] || "").toString();
      const bv = (b[field] || "").toString();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  // ---- Toolbar: Refresh + CSV + JSON --------------------------------------
  function buildToolbar(metaEl, options) {
    const { onRefresh, getRows, filenamePrefix } = options;

    metaEl.innerHTML = "";
    metaEl.style.display = "flex";
    metaEl.style.flexDirection = "row";
    metaEl.style.flexWrap = "wrap";
    metaEl.style.alignItems = "center";
    metaEl.style.justifyContent = "space-between";
    metaEl.style.gap = "8px";

    const left = document.createElement("div");
    left.style.fontSize = "12px";
    left.style.opacity = "0.85";
    left.innerHTML =
      "<strong>Technical Log – All Artefacts</strong><br>" +
      "Every UI, backend, script, DB table, agent mapped here for AI Wealth & FounderConsole.";

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "6px";

    function makeBtn(label) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.style.fontSize = "11px";
      btn.style.padding = "4px 8px";
      btn.style.borderRadius = "999px";
      btn.style.border = "1px solid rgba(255,255,255,0.25)";
      btn.style.background = "rgba(255,255,255,0.05)";
      btn.style.color = "#fff";
      btn.style.cursor = "pointer";
      btn.onmouseenter = () =>
        (btn.style.background = "rgba(255,255,255,0.15)");
      btn.onmouseleave = () =>
        (btn.style.background = "rgba(255,255,255,0.05)");
      return btn;
    }

    const btnRefresh = makeBtn("Refresh");
    btnRefresh.onclick = () => {
      if (onRefresh) onRefresh();
    };

    const btnCsv = makeBtn("Download CSV");
    btnCsv.onclick = () => {
      const rows = getRows ? getRows() : [];
      downloadCsv(filenamePrefix + "_techlog.csv", rows);
    };

    const btnJson = makeBtn("Download JSON");
    btnJson.onclick = () => {
      const rows = getRows ? getRows() : [];
      downloadJson(filenamePrefix + "_techlog.json", rows);
    };

    right.appendChild(btnRefresh);
    right.appendChild(btnCsv);
    right.appendChild(btnJson);

    metaEl.appendChild(left);
    metaEl.appendChild(right);
  }

  function downloadCsv(filename, rows) {
    if (!rows || !rows.length) {
      alert("No rows to export.");
      return;
    }
    const headers = COLUMNS.map((c) => c.field);
    const lines = [];
    lines.push(headers.join(","));
    for (const row of rows) {
      const vals = headers.map((h) => {
        const v = row[h] == null ? "" : String(row[h]);
        // basic CSV escaping
        if (v.includes('"') || v.includes(",") || v.includes("\n")) {
          return '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
      });
      lines.push(vals.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadJson(filename, rows) {
    const blob = new Blob([JSON.stringify(rows || [], null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- Table rendering -----------------------------------------------------
  function renderTable(container) {
    container.innerHTML = "";

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "12px";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const filterRow = document.createElement("tr");

    COLUMNS.forEach((col) => {
      // header
      const th = document.createElement("th");
      th.textContent = col.label;
      th.style.padding = "6px 8px";
      th.style.borderBottom = "1px solid rgba(255,255,255,0.12)";
      th.style.cursor = "pointer";
      th.style.whiteSpace = "nowrap";

      th.addEventListener("click", () => {
        if (currentSort.field === col.field) {
          currentSort.dir = -currentSort.dir;
        } else {
          currentSort.field = col.field;
          currentSort.dir = 1;
        }
        applySort();
        renderBody(table);
      });

      headerRow.appendChild(th);

      // filter
      const thFilter = document.createElement("th");
      thFilter.style.padding = "4px 8px";
      thFilter.style.borderBottom = "1px solid rgba(255,255,255,0.05)";

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Filter " + col.label;
      input.style.width = "100%";
      input.style.boxSizing = "border-box";
      input.style.fontSize = "11px";
      input.style.padding = "3px 6px";
      input.style.background = "rgba(0,0,0,0.3)";
      input.style.border = "1px solid rgba(255,255,255,0.2)";
      input.style.color = "#fff";

      input.addEventListener("input", () => {
        currentFilters[col.field] = input.value || "";
        applyFilters();
        applySort();
        renderBody(table);
      });

      thFilter.appendChild(input);
      filterRow.appendChild(thFilter);
    });

    thead.appendChild(headerRow);
    thead.appendChild(filterRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    container.appendChild(table);

    renderBody(table);
  }

  function renderBody(table) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!filteredRows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = COLUMNS.length;
      td.textContent = "No technical log entries found.";
      td.style.padding = "8px";
      tbody.appendChild(tr);
      tr.appendChild(td);
      return;
    }

    filteredRows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid rgba(255,255,255,0.05)";

      COLUMNS.forEach((col) => {
        const td = document.createElement("td");
        const val = row[col.field];
        td.textContent = val == null ? "" : String(val);
        td.style.padding = "4px 8px";
        td.style.whiteSpace = "nowrap";
        td.style.fontSize = "11px";
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // ---- Main render function (function-module) ------------------------------
  async function doRender(meta) {
    const dom = getDom();
    if (!dom) return;
    const {
      detailTitleEl,
      detailPathEl,
      detailMetaEl,
      detailBodyEl,
      detailTableContainer,
    } = dom;

    // Header line
    const code = meta?.code || "13.1";
    const key = meta?.key || "fc.techlog.all";
    const label = meta?.label || "13.1 Technical Log – All Artefacts";

    detailTitleEl.textContent = label;
    detailPathEl.textContent = `Node: ${code} • Key: ${key}`;
    detailBodyEl.innerHTML =
      `<p style="font-size:12px;">` +
      `AI Wealth – Core Business Brain (SIM Control Run). Below is the ` +
      `<strong>technical log</strong> for all artefacts wired to FounderConsole & AI Wealth.` +
      `</p>` +
      `<p style="font-size:11px;opacity:0.9;">` +
      `Frontend: <code>/opt/founderconsole/root-ui/fc_techlog_v1.js</code><br>` +
      `Backend: <code>/app/backend/readiness_route.py</code><br>` +
      `API: <code>GET /api/readiness/techlog</code><br>` +
      `DB: <code>/opt/ai-wealth/db/aiw.db → FC_TECH_LOG</code><br>` +
      `FC tables: <code>FC_TECH_LOG, FC_READINESS_ITEM</code>.` +
      `</p>`;

    // Toolbar (refresh + downloads)
    buildToolbar(detailMetaEl, {
      onRefresh: () => doRender(meta),
      getRows: () => filteredRows,
      filenamePrefix: "fc_techlog",
    });

    // Loading message in table area
    detailTableContainer.innerHTML =
      "<div style='margin-top:8px;font-size:12px;'>Loading technical log…</div>";

    try {
      const resp = await fetch(API_URL);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const payload = await resp.json();
      allRows = Array.isArray(payload.items) ? payload.items : [];
      currentFilters = {};
      filteredRows = allRows.slice();
      applySort(); // if any
      renderTable(detailTableContainer);
    } catch (err) {
      console.error("[FC-TECHLOG] Error loading techlog", err);
      detailTableContainer.innerHTML =
        "<div style='margin-top:8px;font-size:12px;color:#f88;'>" +
        "Error loading technical log: " +
        (err.message || err) +
        "</div>";
    }
  }

  // Expose as function module for future direct calls
  window.fcRenderTechLogAll = function (meta) {
    doRender(meta);
  };

  // ---- Auto-detect when 13.1 node is active --------------------------------
  function installObserver() {
    const dom = getDom();
    if (!dom) return;
    const { detailPathEl } = dom;

    const observer = new MutationObserver(() => {
      const text = detailPathEl.textContent || "";
      // example: "Node: 13.1 • Key: fc.techlog.all"
      if (!text.includes("fc.techlog.all")) return;

      const token = text; // simple token
      if (token === lastRenderToken) return; // already rendered for this selection
      lastRenderToken = token;

      doRender({
        code: "13.1",
        key: "fc.techlog.all",
        label: "13.1 Technical Log – All Artefacts",
      });
    });

    observer.observe(detailPathEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Wait a tick for DOM to be ready, then install observer
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installObserver);
  } else {
    installObserver();
  }
})();

// ---------------------------------------------------------------------------
// Go-Live card helper: show tech-log summary from /api/readiness/readiness
// ---------------------------------------------------------------------------

window.fcUpdateGoLiveTechlogSummary = async function () {
  const el = document.getElementById("goLiveTechlogSummary");
  if (!el) {
    console.warn("[FC-TECHLOG] goLiveTechlogSummary element not found.");
    return;
  }

  try {
    el.textContent = "Loading…";

    const resp = await fetch("/api/readiness/readiness");
    if (!resp.ok) {
      console.warn("[FC-TECHLOG] readiness API returned", resp.status);
      el.textContent = "Tech log: n/a";
      return;
    }

    const data = await resp.json();
    const meta = (data && data.meta) || {};
    const tech = meta.techlog_counts || meta.techlog || null;

    if (!tech) {
      el.textContent = "Tech log: n/a";
      return;
    }

    const total =
      tech.total ??
      tech.total_artefacts ??
      tech.count ??
      null;

    let label = "Tech log artefacts";
    let valueText = total != null ? String(total) : "n/a";

    // If we ever add per-project counts in meta.techlog_counts.by_project,
    // we can extend this text, but keep today's code simple & robust.
    el.textContent = `${label}: ${valueText}`;
  } catch (err) {
    console.error("[FC-TECHLOG] Failed to update Go-Live techlog summary:", err);
    el.textContent = "Tech log: error";
  }
};

