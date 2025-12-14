// aiw-brain-overview-v1.js
//
// AI Wealth – Brain Overview v1
// Read-only overview of Brain instrument/profile/runlog state.
//
// Backend APIs used:
//   - GET /api/aiwealth/brain/instrument
//   - GET /api/aiwealth/brain/profile
//   - GET /api/aiwealth/brain/runlog
//
// DB tables used:
//   - AIW_BRAIN_INSTRUMENT_STATE
//   - AIW_BRAIN_PROFILE_STATE
//   - AIW_BRAIN_RUN_LOG
//
// TECH_IDs (Brain layer):
//   - AIW-BRAIN-INSTRUMENT-*-V1
//   - AIW-BRAIN-PROFILE-*-V1
//   - AIW-BRAIN-HOLIDAY-V1
//   - AIW-BRAIN-NEWS-V1
//   - AIW-BRAIN-POLICY-GUARDIAN-V1
//   - AIW-BRAIN-TECHNO-V1
//
// NOTE: This is a tile/function-module file. It assumes the Root UI
// has a simple registration mechanism like window.FC_TILES[...] or
// window.registerFCTile(...). We attach to a neutral global map
// (window.FC_TILES) and the main index.html can decide which key to use.
//
// In the next step, index.html will be wired so that a navigation node
// (e.g. "aiw.brain.overview") loads this module and calls renderTile(container, ctx).

(function () {
  // Simple registry fallback if not already defined
  window.FC_TILES = window.FC_TILES || {};

  const TILE_KEY = "aiw.brain.overview.v1";

  /**
   * Utility: create an element with optional className and text.
   */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  }

  /**
   * Utility: simple table builder.
   */
  function buildTable(headers, rows) {
    const table = el("table", "fc-table");

    const thead = el("thead");
    const trHead = el("tr");
    headers.forEach((h) => {
      const th = el("th", "", h);
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = el("tbody");
    rows.forEach((row) => {
      const tr = el("tr");
      row.forEach((cell) => {
        const td = el("td");
        if (cell === null || cell === undefined) {
          td.textContent = "";
        } else if (typeof cell === "number") {
          td.textContent = cell.toString();
        } else {
          td.textContent = cell;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }

  /**
   * Utility: fetch JSON with basic error handling.
   */
  async function fetchJson(url) {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error("HTTP " + resp.status + " - " + text);
    }
    return resp.json();
  }

  /**
   * Main render entry point for the tile.
   * container: DOM node to render into
   * ctx: optional context object from Root UI (run_date, env, etc.)
   */
  async function renderTile(container, ctx) {
    container.innerHTML = "";

    // Basic container styling for this tile (local only)
    container.classList.add("fc-tile-brain-overview");

    // --- Technical Info header ------------------------------------------------
    const techCard = el("div", "fc-card fc-tech-header");
    const title = el("h2", "fc-tile-title", "AI Wealth – Brain Overview (SIM)");
    techCard.appendChild(title);

    const techInfo = el("pre", "fc-tech-info");
    techInfo.textContent =
      "Technical Info (Brain v1)\n" +
      "Frontend: /opt/founderconsole/root-ui/aiw-brain-overview-v1.js\n" +
      "Backend:  /app/backend/aiw_brain_instrument_api_v1.py\n" +
      "          /app/backend/aiw_brain_profile_api_v1.py\n" +
      "          /app/backend/aiw_brain_runlog_api_v1.py\n" +
      "DB:       /opt/ai-wealth/db/aiw.db\n" +
      "Tables:   AIW_BRAIN_INSTRUMENT_STATE\n" +
      "          AIW_BRAIN_PROFILE_STATE\n" +
      "          AIW_BRAIN_RUN_LOG\n" +
      "Agents:   SC-AIWEALTH, SC-FOUNDERCONSOLE\n";

    techCard.appendChild(techInfo);
    container.appendChild(techCard);

    // --- Status + summaries ---------------------------------------------------
    const statusCard = el("div", "fc-card fc-brain-status");
    const statusTitle = el("h3", "", "Brain Snapshot (latest SIM data)");
    statusCard.appendChild(statusTitle);

    const statusMsg = el("div", "fc-brain-status-msg", "Loading Brain data…");
    statusCard.appendChild(statusMsg);

    container.appendChild(statusCard);

    // --- Layout for tables ----------------------------------------------------
    const grid = el("div", "fc-brain-grid");
    container.appendChild(grid);

    const colLeft = el("div", "fc-brain-col");
    const colRight = el("div", "fc-brain-col");
    grid.appendChild(colLeft);
    grid.appendChild(colRight);

    const instCard = el("div", "fc-card");
    instCard.appendChild(el("h3", "", "Instrument View (EQ/FO/ETF/MF)"));
    colLeft.appendChild(instCard);

    const profCard = el("div", "fc-card");
    profCard.appendChild(el("h3", "", "Profile View (Conservative → Ultra)"));
    colRight.appendChild(profCard);

    const runCard = el("div", "fc-card");
    runCard.appendChild(el("h3", "", "Brain Run Log (summary)"));
    container.appendChild(runCard);

    // --- Fetch Brain data in parallel ----------------------------------------
    try {
      const [instJson, profJson, runlogJson] = await Promise.all([
        fetchJson("/api/aiwealth/brain/instrument"),
        fetchJson("/api/aiwealth/brain/profile"),
        fetchJson("/api/aiwealth/brain/runlog")
      ]);

      const instrumentRows = instJson || [];
      const profileRows = profJson || [];
      const runlogRows = runlogJson || [];

      // High-level status message
      if (instrumentRows.length === 0 && profileRows.length === 0 && runlogRows.length === 0) {
        statusMsg.textContent =
          "No Brain data found yet. After the next Control Run (SIM) with Brain enabled, this tile will show " +
          "instrument/profile decisions and run summaries.";
      } else {
        const distinctInstruments = Array.from(
          new Set(instrumentRows.map((r) => r.instrument || r.INSTRUMENT || ""))
        ).filter(Boolean);
        const distinctProfiles = Array.from(
          new Set(profileRows.map((r) => r.profile_id || r.PROFILE_ID || ""))
        ).filter(Boolean);

        statusMsg.textContent =
          "Brain data loaded. Instruments: " + distinctInstruments.join(", ") +
          " | Profiles: " + distinctProfiles.join(", ") +
          " | Runlog rows: " + runlogRows.length;
      }

      // --- Instrument table ---------------------------------------------------
      const instHeaders = [
        "Run date",
        "Env",
        "Instrument",
        "Symbol",
        "Exch",
        "Score",
        "Allowed profiles",
        "Primary reason"
      ];

      const instTableRows = instrumentRows.map((row) => {
        const r = row.RUN_DATE ? row : {
          RUN_DATE: row.run_date,
          ENV: row.env,
          INSTRUMENT: row.instrument,
          SYMBOL: row.symbol,
          EXCHANGE: row.exchange,
          INSTRUMENT_SCORE: row.instrument_score,
          ALLOWED_PROFILES: row.allowed_profiles,
          PRIMARY_REASON: row.primary_reason
        };

        return [
          r.RUN_DATE,
          r.ENV,
          r.INSTRUMENT,
          r.SYMBOL,
          r.EXCHANGE,
          r.INSTRUMENT_SCORE,
          r.ALLOWED_PROFILES,
          r.PRIMARY_REASON
        ];
      });

      if (instTableRows.length > 0) {
        instCard.appendChild(buildTable(instHeaders, instTableRows));
      } else {
        instCard.appendChild(
          el("div", "fc-empty", "No instrument-level Brain rows yet.")
        );
      }

      // --- Profile table ------------------------------------------------------
      const profHeaders = [
        "Run date",
        "Env",
        "Profile",
        "Instrument",
        "Symbol",
        "Exch",
        "Exp %",
        "Conf %",
        "Risk bucket",
        "Action",
        "Holiday",
        "News",
        "Policy",
        "Final status"
      ];

      const profTableRows = profileRows.map((row) => {
        const r = row.RUN_DATE ? row : {
          RUN_DATE: row.run_date,
          ENV: row.env,
          PROFILE_ID: row.profile_id,
          INSTRUMENT: row.instrument,
          SYMBOL: row.symbol,
          EXCHANGE: row.exchange,
          EXPECTED_RETURN_PCT: row.expected_return_pct,
          CONFIDENCE_PCT: row.confidence_pct,
          RISK_BUCKET: row.risk_bucket,
          ACTION_DEFAULT: row.action_default,
          HOLIDAY_BLOCK_FLAG: row.holiday_block_flag,
          NEWS_BLOCK_FLAG: row.news_block_flag,
          POLICY_BLOCK_FLAG: row.policy_block_flag,
          FINAL_STATUS: row.final_status
        };

        return [
          r.RUN_DATE,
          r.ENV,
          r.PROFILE_ID,
          r.INSTRUMENT,
          r.SYMBOL,
          r.EXCHANGE,
          r.EXPECTED_RETURN_PCT,
          r.CONFIDENCE_PCT,
          r.RISK_BUCKET,
          r.ACTION_DEFAULT,
          r.HOLIDAY_BLOCK_FLAG,
          r.NEWS_BLOCK_FLAG,
          r.POLICY_BLOCK_FLAG,
          r.FINAL_STATUS
        ];
      });

      if (profTableRows.length > 0) {
        profCard.appendChild(buildTable(profHeaders, profTableRows));
      } else {
        profCard.appendChild(
          el("div", "fc-empty", "No profile-level Brain rows yet.")
        );
      }

      // --- Runlog table -------------------------------------------------------
      const runHeaders = [
        "Run date",
        "Env",
        "Profile",
        "Instrument",
        "Symbols considered",
        "Symbols approved",
        "Symbols blocked",
        "Holiday flags",
        "News flags",
        "Policy blocks",
        "Created at"
      ];

      const runTableRows = runlogRows.map((row) => {
        const r = row.RUN_DATE ? row : {
          RUN_DATE: row.run_date,
          ENV: row.env,
          PROFILE_ID: row.profile_id,
          INSTRUMENT: row.instrument,
          SYMBOLS_CONSIDERED: row.symbols_considered,
          SYMBOLS_APPROVED: row.symbols_approved,
          SYMBOLS_BLOCKED: row.symbols_blocked,
          HOLIDAY_FLAGS_COUNT: row.holiday_flags_count,
          NEWS_FLAGS_COUNT: row.news_flags_count,
          POLICY_BLOCK_COUNT: row.policy_block_count,
          CREATED_AT: row.created_at
        };

        return [
          r.RUN_DATE,
          r.ENV,
          r.PROFILE_ID,
          r.INSTRUMENT,
          r.SYMBOLS_CONSIDERED,
          r.SYMBOLS_APPROVED,
          r.SYMBOLS_BLOCKED,
          r.HOLIDAY_FLAGS_COUNT,
          r.NEWS_FLAGS_COUNT,
          r.POLICY_BLOCK_COUNT,
          r.CREATED_AT
        ];
      });

      if (runTableRows.length > 0) {
        runCard.appendChild(buildTable(runHeaders, runTableRows));
      } else {
        runCard.appendChild(
          el("div", "fc-empty", "No Brain runlog rows yet.")
        );
      }
    } catch (err) {
      console.error("Error loading Brain overview:", err);
      statusMsg.textContent = "Error loading Brain data: " + err.message;
    }
  }

  // Minimal CSS hook: index.html already has global styles; we only add classes.
  // The main Root UI stylesheet can style these classes if needed.
  const styleId = "fc-brain-overview-inline-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .fc-tile-brain-overview {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .fc-card {
        background: rgba(15, 23, 42, 0.8);
        border-radius: 8px;
        padding: 12px 16px;
      }
      .fc-tile-title {
        margin: 0 0 4px 0;
        font-size: 18px;
      }
      .fc-tech-info {
        margin: 4px 0 0 0;
        font-size: 11px;
        line-height: 1.4;
        white-space: pre-wrap;
      }
      .fc-brain-status-msg {
        font-size: 13px;
        margin-top: 4px;
      }
      .fc-brain-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
        gap: 16px;
      }
      .fc-brain-col {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .fc-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .fc-table th,
      .fc-table td {
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        padding: 4px 6px;
        text-align: left;
      }
      .fc-table th {
        font-weight: 600;
      }
      .fc-empty {
        font-size: 12px;
        opacity: 0.7;
      }
    `;
    document.head.appendChild(style);
  }

  // Register in global map; index.html will call renderTile later.
  window.FC_TILES[TILE_KEY] = {
    key: TILE_KEY,
    renderTile
  };
})();

