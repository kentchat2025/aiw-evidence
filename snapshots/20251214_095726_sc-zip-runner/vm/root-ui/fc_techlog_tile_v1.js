// fc_techlog_tile_v1.js
// Techno Log (13.1) – data-driven grid for FC_TECH_LOG

async function fetchTechLog(apiBaseUrl) {
  const url = apiBaseUrl.replace(/\/$/, "") + "/api/readiness/techlog";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to load Tech Log: " + res.status);
  }
  return await res.json();
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

export async function renderTechLogTile(container, apiBaseUrl) {
  container.innerHTML = "";

  const wrapper = createElement("div", "fc-techlog-wrapper");
  container.appendChild(wrapper);

  const header = createElement("div", "fc-techlog-header");
  header.innerHTML = `
    <div class="fc-techlog-title">13.1 – Techno Log (All Artefacts)</div>
    <div class="fc-techlog-subtitle">
      Data-driven view of FC_TECH_LOG – statuses update automatically from DB.
    </div>
  `;
  wrapper.appendChild(header);

  const controls = createElement("div", "fc-techlog-controls");
  controls.innerHTML = `
    <label>Status:
      <select id="fc-techlog-status-filter">
        <option value="">All</option>
        <option value="ACTIVE">ACTIVE</option>
        <option value="PLANNED">PLANNED</option>
        <option value="DISABLED">DISABLED</option>
      </select>
    </label>
    <label>Search:
      <input id="fc-techlog-search" type="text" placeholder="Search TECH_ID / Name / Table" />
    </label>
    <button id="fc-techlog-refresh-btn">Refresh</button>
  `;
  wrapper.appendChild(controls);

  const tableContainer = createElement("div", "fc-techlog-table-container");
  wrapper.appendChild(tableContainer);

  const statusFilterEl = controls.querySelector("#fc-techlog-status-filter");
  const searchEl = controls.querySelector("#fc-techlog-search");
  const refreshBtn = controls.querySelector("#fc-techlog-refresh-btn");

  let rawData = [];

  async function loadAndRender() {
    tableContainer.innerHTML = "Loading Tech Log...";
    try {
      rawData = await fetchTechLog(apiBaseUrl);
      renderTable();
    } catch (err) {
      console.error(err);
      tableContainer.innerHTML = "Error loading Tech Log: " + err.message;
    }
  }

  function renderTable() {
    const statusFilter = (statusFilterEl.value || "").trim().toUpperCase();
    const searchTerm = (searchEl.value || "").trim().toLowerCase();

    const filtered = rawData.filter((row) => {
      const status = (row.STATUS || "").toUpperCase();
      if (statusFilter && status !== statusFilter) return false;

      if (searchTerm) {
        const haystack = [
          row.TECH_ID,
          row.OBJECT_NAME,
          row.DESCRIPTION,
          row.AIW_TABLES_USED,
          row.FC_TABLES_USED,
          row.TILE_IDS,
          row.AGENTS_RELATED,
          row.READINESS_ITEMS
        ]
          .map((x) => (x || "").toString().toLowerCase())
          .join(" | ");
        if (!haystack.includes(searchTerm)) return false;
      }

      return true;
    });

    // Build table
    const table = createElement("table", "fc-techlog-table");
    const thead = createElement("thead");
    const headerRow = createElement("tr");

    const columns = [
      "TECH_ID",
      "OBJECT_TYPE",
      "OBJECT_NAME",
      "DESCRIPTION",
      "OBJECT_PATH",
      "STATUS",
      "VERSION",
      "AIW_TABLES_USED",
      "FC_TABLES_USED",
      "TILE_IDS",
      "AGENTS_RELATED",
      "READINESS_ITEMS",
      "LAST_UPDATED_AT"
    ];

    columns.forEach((col) => {
      const th = createElement("th", "", col);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createElement("tbody");
    filtered.forEach((row) => {
      const tr = createElement("tr");

      columns.forEach((col) => {
        const td = createElement("td");
        const val = row[col] ?? "";
        td.textContent = val;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Replace container content
    tableContainer.innerHTML = "";
    tableContainer.appendChild(table);

    if (!filtered.length) {
      const note = createElement(
        "div",
        "fc-techlog-empty",
        "No records match current filters."
      );
      tableContainer.appendChild(note);
    }
  }

  // Wire events
  statusFilterEl.addEventListener("change", renderTable);
  searchEl.addEventListener("input", () => {
    // small debounce could be added but not necessary
    renderTable();
  });
  refreshBtn.addEventListener("click", loadAndRender);

  // Initial load
  await loadAndRender();
}

