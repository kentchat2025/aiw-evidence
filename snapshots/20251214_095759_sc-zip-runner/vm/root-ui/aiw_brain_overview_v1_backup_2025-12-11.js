// aiw_brain_overview_v1.js
// AIW Brain – Overview (SIM) tile
// Registers itself in window.FC_TILES and renders a simple Brain snapshot
// based on AIW_BRAIN_RUN_LOG. Phase 1: basic wiring + "no data" message.

(function () {
  if (!window.FC_TILES) {
    window.FC_TILES = {};
  }

  /**
   * Render Brain overview tile.
   * container: detail panel container from index.html (we don't depend on it heavily).
   * ctx: optional context (run_date, env, node, etc.). For now we fall back to SIM + control run date.
   */
  function renderTile(container, ctx) {
    // Core DOM elements used across tiles
    var detailBodyEl = document.getElementById("detail-body");
    var detailTableContainer = document.getElementById("detail-table-container");

    if (!detailBodyEl || !detailTableContainer) {
      console.warn("[AIW-BRAIN] detail panel elements not found");
      return;
    }

    // Try to pick run date / env from context; fall back to SIM control run header
    var runDate = (ctx && ctx.runDate) || getControlRunDateFromHeader() || "2025-11-24";
    var env = (ctx && ctx.env) || "SIM";

    // Optional node info
    var node = (ctx && ctx.node) || null;
    var nodeCode = (node && node.code) || "7.4.1";
    var nodeKey = (node && node.key) || "aiw.brain.overview.v1";

    // Header / description
    detailBodyEl.innerHTML =
      '<div class="tile-header">' +
      '  <div class="tile-title">AIW Brain – Overview (SIM)</div>' +
      '  <div class="tile-subtitle">' +
      "    Node: " +
      nodeCode +
      " • Key: " +
      nodeKey +
      " • Run date: " +
      runDate +
      " • ENV: " +
      env +
      "" +
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

  // Helper: try to grab the control-run date from the top AI Wealth card
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

  // Helper: render a small SAP-style table from AIW_BRAIN_RUN_LOG rows
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
      html.push(
        "<tr>" +
          "<td>" +
          escapeHtml(r.PROFILE_ID || r.profile_id || "") +
          "</td>" +
          "<td>" +
          escapeHtml(r.INSTRUMENT || r.instrument || "") +
          "</td>" +
          "<td>" +
          (r.SYMBOLS_CONSIDERED || r.symbols_considered || 0) +
          "</td>" +
          "<td>" +
          (r.SYMBOLS_APPROVED || r.symbols_approved || 0) +
          "</td>" +
          "<td>" +
          (r.SYMBOLS_BLOCKED || r.symbols_blocked || 0) +
          "</td>" +
          "<td>" +
          (r.HOLIDAY_FLAGS_COUNT || r.holiday_flags_count || 0) +
          "</td>" +
          "<td>" +
          (r.NEWS_FLAGS_COUNT || r.news_flags_count || 0) +
          "</td>" +
          "<td>" +
          (r.POLICY_BLOCK_COUNT || r.policy_block_count || 0) +
          "</td>" +
          "</tr>"
      );
    });

    html.push("</tbody></table>");

    container.innerHTML =
      '<div style="margin-top:10px;">' +
      '<div style="font-size:13px;margin-bottom:6px;">Run log – by profile & instrument (AIW_BRAIN_RUN_LOG)</div>' +
      html.join("") +
      "</div>";
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Register tile
  window.FC_TILES["aiw.brain.overview.v1"] = {
    key: "aiw.brain.overview.v1",
    renderTile: renderTile,
  };

  console.log("[AIW-BRAIN] aiw.brain.overview.v1 tile registered");
})();

