// aiw_brain_overview_v1.js
// AIW Brain – Overview (SIM) tile
// Phase 1: read AIW_BRAIN_RUN_LOG via /api/aiwealth/brain/runlog
// and render a small SAP-style table. If there is no data yet,
// show a clear "no data yet" message.

// Wrap in IIFE so we don't leak symbols into global scope.
(function () {
  // --- Global tile registry -----------------------------------------------
  if (!window.FC_TILES) {
    window.FC_TILES = {};
  }

  // --- Small HTML escaper -------------------------------------------------
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // --- Helper: try to grab control-run date from header chips -------------
  function getControlRunDateFromHeader() {
    try {
      var chips = document.querySelectorAll(".summary-chip, .pill, .tag");
      for (var i = 0; i < chips.length; i++) {
        var text = chips[i].textContent || "";
        if (text.indexOf("Run date:") >= 0) {
          // Example: "Run date: 2025-11-24 • ENV: SIM"
          var parts = text.split("Run date:")[1].trim().split(" ")[0];
          if (parts && /^\d{4}-\d{2}-\d{2}$/.test(parts)) {
            return parts;
          }
        }
      }
    } catch (e) {
      console.warn("[AIW-BRAIN] unable to parse control run date from header", e);
    }
    return null;
  }

  // --- Main render function -----------------------------------------------
  /**
   * Render Brain overview tile.
   * container: the detail panel element – we ignore it and use the
   *            standard detail-body + detail-table-container IDs.
   * ctx: { runDate?, env?, node? }
   */
  function renderTile(container, ctx) {
    var detailBodyEl = document.getElementById("detail-body");
    var detailTableContainer = document.getElementById("detail-table-container");

    if (!detailBodyEl || !detailTableContainer) {
      console.warn("[AIW-BRAIN] detail panel elements not found");
      return;
    }

    ctx = ctx || {};
    var node = ctx.node || null;
    var nodeCode = (node && node.code) || "7.4.1";
    var nodeKey = (node && node.key) || "aiw.brain.overview.v1";

    var runDate = ctx.runDate || getControlRunDateFromHeader() || "2025-11-24";
    var env = ctx.env || "SIM";

    // Header / description
    detailBodyEl.innerHTML =
      '<div class="tile-header">' +
      '  <div class="tile-title">AIW Brain – Overview (SIM)</div>' +
      '  <div class="tile-subtitle">' +
      "    Node: " +
      escapeHtml(nodeCode) +
      " • Key: " +
      escapeHtml(nodeKey) +
      " • Run date: " +
      escapeHtml(runDate) +
      " • ENV: " +
      escapeHtml(env) +
      "  </div>" +
      "</div>" +
      '<div style="margin-top:10px;font-size:13px;line-height:1.5;">' +
      "This view summarises AI Wealth Brain decisions per profile & instrument for the selected control run. " +
      "Phase&nbsp;1 shows a simple snapshot; later phases will add deep drill-down, charts, and AI explanations." +
      "</div>";

    // Initial "loading" state
    detailTableContainer.innerHTML =
      '<div style="padding:12px;font-size:13px;">Loading Brain run summary…</div>';

    // Call backend run-log API
    var url =
      "/api/aiwealth/brain/runlog" +
      "?env=" +
      encodeURIComponent(env) +
      "&run_date=" +
      encodeURIComponent(runDate);

    fetch(url)
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("HTTP " + resp.status);
        }
        return resp.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          detailTableContainer.innerHTML =
            '<div style="padding:12px;font-size:13px;">' +
            "No Brain run data is available yet for this run date. " +
            "Once the Brain jobs populate AIW_BRAIN_RUN_LOG, this tile will show counts per profile & instrument." +
            "</div>";
          return;
        }

        renderRunLogTable(detailTableContainer, rows);
      })
      .catch(function (err) {
        console.error("[AIW-BRAIN] runlog fetch failed", err);
        detailTableContainer.innerHTML =
          '<div style="padding:12px;font-size:13px;color:#ff9d9d;">' +
          "Error loading Brain run summary from backend. " +
          "Please check /api/aiwealth/brain/runlog and logs for details." +
          "</div>";
      });
  }

  // --- Helper: render table from AIW_BRAIN_RUN_LOG rows --------------------
  function renderRunLogTable(container, rows) {
    var html = [];
    html.push('<table class="fc-table">');
    html.push(
      "<thead><tr>" +
        "<th>Profile</th>" +
        "<th>Instrument</th>" +
        "<th>Symbols considered</th>" +
        "<th>Approved</th>" +
        "<th>Blocked</th>" +
        "<th>Holiday flags</th>" +
        "<th>News flags</th>" +
        "<th>Policy blocks</th>" +
        "</tr></thead>"
    );
    html.push("<tbody>");

    rows.forEach(function (r) {
      var profile = r.PROFILE_ID || r.profile_id || "";
      var instrument = r.INSTRUMENT || r.instrument || "";
      var considered = r.SYMBOLS_CONSIDERED || r.symbols_considered || 0;
      var approved = r.SYMBOLS_APPROVED || r.symbols_approved || 0;
      var blocked = r.SYMBOLS_BLOCKED || r.symbols_blocked || 0;
      var hol = r.HOLIDAY_FLAGS_COUNT || r.holiday_flags_count || 0;
      var news = r.NEWS_FLAGS_COUNT || r.news_flags_count || 0;
      var policy = r.POLICY_BLOCK_COUNT || r.policy_block_count || 0;

      html.push(
        "<tr>" +
          "<td>" +
          escapeHtml(profile) +
          "</td>" +
          "<td>" +
          escapeHtml(instrument) +
          "</td>" +
          "<td style=\"text-align:right;\">" +
          escapeHtml(considered) +
          "</td>" +
          "<td style=\"text-align:right;\">" +
          escapeHtml(approved) +
          "</td>" +
          "<td style=\"text-align:right;\">" +
          escapeHtml(blocked) +
          "</td>" +
          "<td style=\"text-align:right;\">" +
          escapeHtml(hol) +
          "</td>" +
          "<td style=\"text-align:right;\">" +
          escapeHtml(news) +
          "</td>" +
          "<td style=\"text-align:right;\">" +
          escapeHtml(policy) +
          "</td>" +
          "</tr>"
      );
    });

    html.push("</tbody></table>");
    container.innerHTML = html.join("");
  }

  // --- Register tile in global registry ------------------------------------
  window.FC_TILES["aiw.brain.overview.v1"] = {
    renderTile: renderTile,
  };

  // Optional debug helper you can call from browser console if needed
  window.fcRenderBrainOverview = function (ctx) {
    var body =
      document.getElementById("detail-table-container") ||
      document.getElementById("detail-body");
    if (body) {
      renderTile(body, ctx || {});
    }
  };
})();

