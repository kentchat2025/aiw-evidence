// fc_techlog_v1.js
// Technical Log – All Artefacts (Tree 13.1) + hook for Go-Live card.
// Phase 1: show ALL FC_TECH_LOG rows (any STATUS) in a SAP-style table.

(function () {
  // --- Global tile registry -------------------------------------------------
  if (!window.FC_TILES) {
    window.FC_TILES = {};
  }

  // --- Small HTML escaper ---------------------------------------------------
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // --- Fetch helper: read ALL techlog rows (no status filter) ---------------
  function fetchAllTechlog() {
    // /api/readiness/techlog-all returns a plain array of rows.
    return fetch("/api/readiness/techlog-all")
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("HTTP " + resp.status);
        }
        return resp.json();
      })
      .then(function (rows) {
        if (Array.isArray(rows)) {
          return rows;
        }
        if (rows && Array.isArray(rows.items)) {
          // Safety if backend ever wraps it
          return rows.items;
        }
        return [];
      })
      .catch(function (err) {
        console.error("[FC-TECHLOG] fetchAllTechlog failed", err);
        throw err;
      });
  }

  // --- Table renderer for 13.1 ---------------------------------------------
  function renderTechlogTable(container, rows) {
    if (!rows || rows.length === 0) {
      container.innerHTML =
        '<div style="padding:12px;font-size:13px;">' +
        "No Technical Log entries found in FC_TECH_LOG yet. " +
        "Once TECH_IDs are registered, they will appear here with their STATUS." +
        "</div>";
      return;
    }

    var html = [];
    html.push('<table class="fc-table">');
    html.push(
      "<thead><tr>" +
        "<th>TECH_ID</th>" +
        "<th>Object type</th>" +
        "<th>Name</th>" +
        "<th>Object path</th>" +
        "<th>Tiles</th>" +
        "<th>AIW tables</th>" +
        "<th>FC tables</th>" +
        "<th>Agents</th>" +
        "<th>Readiness items</th>" +
        "<th>Version</th>" +
        "<th>Status</th>" +
        "<th>Last updated</th>" +
        "</tr></thead>"
    );
    html.push("<tbody>");

    rows.forEach(function (r) {
      html.push(
        "<tr>" +
          "<td>" + escapeHtml(r.TECH_ID || r.tech_id || "") + "</td>" +
          "<td>" + escapeHtml(r.OBJECT_TYPE || r.object_type || "") + "</td>" +
          "<td>" + escapeHtml(r.OBJECT_NAME || r.object_name || "") + "</td>" +
          "<td>" + escapeHtml(r.OBJECT_PATH || r.object_path || "") + "</td>" +
          "<td>" + escapeHtml(r.TILE_IDS || r.tile_ids || "") + "</td>" +
          "<td>" + escapeHtml(r.AIW_TABLES_USED || r.aiw_tables_used || "") + "</td>" +
          "<td>" + escapeHtml(r.FC_TABLES_USED || r.fc_tables_used || "") + "</td>" +
          "<td>" + escapeHtml(r.AGENTS_RELATED || r.agents_related || "") + "</td>" +
          "<td>" + escapeHtml(r.READINESS_ITEMS || r.readiness_items || "") + "</td>" +
          "<td>" + escapeHtml(r.VERSION || r.version || "") + "</td>" +
          "<td>" + escapeHtml(r.STATUS || r.status || "") + "</td>" +
          "<td>" + escapeHtml(r.LAST_UPDATED_AT || r.last_updated_at || "") + "</td>" +
        "</tr>"
      );
    });

    html.push("</tbody></table>");
    container.innerHTML = html.join("");
  }

  // --- Core renderer used by all entry points -------------------------------
  function renderTechlogScreen(ctx) {
    var detailBodyEl = document.getElementById("detail-body");
    var detailTableContainer = document.getElementById("detail-table-container");

    if (!detailBodyEl || !detailTableContainer) {
      console.warn("[FC-TECHLOG] detail-body / detail-table-container not found");
      return;
    }

    ctx = ctx || {};
    var node = ctx.node || null;
    var nodeCode = (node && node.code) || "13.1";
    var nodeKey = (node && node.key) || "fc.techlog.all";

    detailBodyEl.innerHTML =
      '<div class="tile-header">' +
      '  <div class="tile-title">13.1 Technical Log – All Artefacts</div>' +
      '  <div class="tile-subtitle">' +
      "    Node: " + nodeCode +
      " • Key: " + nodeKey +
      "  </div>" +
      "</div>" +
      '<div style="margin-top:10px;font-size:13px;line-height:1.5;">' +
      "This table is the single source of truth for all TECH_ID artefacts across AI Wealth & FounderConsole. " +
      "It always shows every row from FC_TECH_LOG, regardless of STATUS (ACTIVE, DRAFT, DISABLED, etc.)." +
      "</div>";

    detailTableContainer.innerHTML =
      '<div style="padding:12px;font-size:13px;">Loading Technical Log…</div>';

    fetchAllTechlog()
      .then(function (rows) {
        renderTechlogTable(detailTableContainer, rows);
      })
      .catch(function (err) {
        console.error("[FC-TECHLOG] renderTechlogScreen error", err);
        detailTableContainer.innerHTML =
          '<div style="padding:12px;font-size:13px;color:#ff9d9d;">' +
          "Error loading Technical Log from /api/readiness/techlog-all. " +
          "Please check backend logs." +
          "</div>";
      });
  }

  // --- FC_TILES registration (preferred path) -------------------------------
  window.FC_TILES["fc.techlog.all"] = {
    renderTile: function (_container, ctx) {
      renderTechlogScreen(ctx || {});
    },
  };

  // --- Backwards-compat helper used earlier in index.html -------------------
  window.FC_TECHLOG = {
    open: function (ctx) {
      renderTechlogScreen(ctx || {});
    },
  };

  // --- Optional helper used by generic hook in index.html -------------------
  window.fcRenderTechLogAll = function (_detailBodyEl, _detailTableContainer, ctx) {
    renderTechlogScreen(ctx || {});
  };
})();

