/**
 * @fc_module: AIW Data & Universe module
 * @fc_purpose: 2.1.1.3 Data & Universe table dictionary
 * @fc_source: ~/aiw-data-universe.js
 * @fc_status: ACTIVE
 */

window.AiwDataUniverse = (function () {
  // --- Small helpers --------------------------------------------------------

  function clearDetail() {
    detailTitleEl.textContent = "";
    detailPathEl.textContent = "";
    detailMetaEl.textContent = "";
    detailBodyEl.innerHTML = "";
    detailTableContainer.innerHTML = "";
  }

  function renderFieldTable(tableDef) {
    const fields = tableDef.fields || [];

    let html = "";
    html += `<h3 style="margin-bottom:8px;">${tableDef.name}</h3>`;
    if (tableDef.description) {
      html += `<p style="margin-top:0;">${tableDef.description}</p>`;
    }
    html += `<p style="font-size:11px; opacity:0.8; margin-top:4px;">Context key: <code>${tableDef.contextKey}</code></p>`;

    html += `<table class="aiw-settings-table">
      <thead>
        <tr>
          <th style="width:18%">Field</th>
          <th style="width:14%">Type</th>
          <th style="width:30%">Meaning</th>
          <th style="width:18%">Source</th>
          <th style="width:20%">Used in</th>
        </tr>
      </thead>
      <tbody>
    `;

    for (const f of fields) {
      html += `<tr>
        <td><strong>${f.name}</strong></td>
        <td><code>${f.type || ""}</code></td>
        <td>${f.description || ""}</td>
        <td>${f.source || ""}</td>
        <td>${f.usedIn || ""}</td>
      </tr>`;
    }

    html += `</tbody></table>`;

    detailTableContainer.innerHTML = html;
  }

  function renderTableList(group, allGroups) {
    // left: list of tables; bottom/right: fields of selected
    let listHtml = "";

    listHtml += `<div class="aiw-datauniverse-layout">`;

    // left list
    listHtml += `<div class="aiw-datauniverse-list">`;
    listHtml += `<h3 style="margin-bottom:6px;">${group.title}</h3>`;
    if (group.description) {
      listHtml += `<p style="margin-top:0; font-size:12px;">${group.description}</p>`;
    }

    listHtml += `<ul class="aiw-datauniverse-table-list">`;
    for (const t of group.tables) {
      listHtml += `<li class="aiw-datauniverse-table-item" data-table-id="${t.id}">
        <div class="aiw-datauniverse-table-name">${t.name}</div>
        <div class="aiw-datauniverse-table-desc">${t.short || ""}</div>
      </li>`;
    }
    listHtml += `</ul>`;

    listHtml += `</div>`; // end list

    // right area initially empty; will be filled when user clicks a table
    listHtml += `<div class="aiw-datauniverse-detail-placeholder">
      <p style="font-size:12px; opacity:0.8;">
        Select a table on the left to see its field dictionary.
      </p>
    </div>`;

    listHtml += `</div>`; // end layout

    detailBodyEl.innerHTML = listHtml;

    const listEls = Array.from(
      detailBodyEl.querySelectorAll(".aiw-datauniverse-table-item")
    );

    function findTableById(id) {
      for (const g of allGroups) {
        for (const t of g.tables) {
          if (t.id === id) return t;
        }
      }
      return null;
    }

    for (const li of listEls) {
      li.addEventListener("click", () => {
        const id = li.getAttribute("data-table-id");
        const tableDef = findTableById(id);
        if (!tableDef) return;

        listEls.forEach((x) => x.classList.remove("active"));
        li.classList.add("active");

        renderFieldTable(tableDef);
      });
    }

    // auto-select first table in group
    if (group.tables.length > 0) {
      const first = group.tables[0];
      const firstLi = listEls.find(
        (li) => li.getAttribute("data-table-id") === first.id
      );
      if (firstLi) firstLi.click();
    }
  }

  // --- Data model definitions ----------------------------------------------

  // These are logical tables; physical names in aiw.db/SQLite may differ slightly
  const groups = [
    {
      id: "universe",
      title: "Universe Tables",
      description:
        "Logical tables that hold the AI Wealth equity universe, prices and signals.",
      tables: [
        {
          id: "aiw_universe_master",
          name: "AIW_UNIVERSE_MASTER",
          contextKey: "aiw.universe.master",
          short: "Master list of all instruments in the AI Wealth universe.",
          description:
            "Universe master table: one row per instrument that AI Wealth can trade or analyse.",
          fields: [
            {
              name: "symbol",
              type: "TEXT",
              description: "Primary symbol (e.g., RELIANCE, TCS).",
              source: "Broker instruments / NSE bhavcopy / loader",
              usedIn: "All screens, signals, orders",
            },
            {
              name: "exchange",
              type: "TEXT",
              description: "Exchange code (e.g., NSE, BSE).",
              source: "Loader mapping",
              usedIn: "Universe filters, routing",
            },
            {
              name: "segment",
              type: "TEXT",
              description: "Market segment (EQ, F&O, ETF, MF, INDEX, SME).",
              source: "Loader mapping / broker API",
              usedIn: "Universe filters, risk buckets",
            },
            {
              name: "isin",
              type: "TEXT",
              description: "ISIN code where applicable.",
              source: "Ref data / vendor files",
              usedIn: "Back-office mapping, reports",
            },
            {
              name: "lot_size",
              type: "INTEGER",
              description: "Minimum tradable lot size (esp. F&O).",
              source: "Broker instruments / FO contract file",
              usedIn: "Order sizing, risk engine",
            },
            {
              name: "tick_size",
              type: "REAL",
              description: "Minimum tick size allowed by exchange.",
              source: "Exchange data",
              usedIn: "Price rounding, stop-loss calc",
            },
            {
              name: "is_active",
              type: "INTEGER (0/1)",
              description: "Whether this instrument is active in the universe.",
              source: "Universe management logic",
              usedIn: "Universe filters, UI",
            },
          ],
        },
        {
          id: "aiw_universe_prices_daily",
          name: "AIW_UNIVERSE_PRICES_DAILY",
          contextKey: "aiw.universe.pricesDaily",
          short: "Daily OHLCV prices per symbol.",
          description:
            "Normalized daily OHLCV prices for each symbol in the universe, used for indicators and backtests.",
          fields: [
            {
              name: "trade_date",
              type: "DATE",
              description: "Trading date (IST).",
              source: "Exchange bhavcopy / broker data",
              usedIn: "Charts, backtests, signals",
            },
            {
              name: "symbol",
              type: "TEXT",
              description: "Instrument symbol.",
              source: "Universe master join",
              usedIn: "Join key",
            },
            {
              name: "open",
              type: "REAL",
              description: "Open price for the day.",
              source: "Bhavcopy / prices feed",
              usedIn: "Indicators, returns",
            },
            {
              name: "high",
              type: "REAL",
              description: "High price for the day.",
              source: "Bhavcopy / prices feed",
              usedIn: "Indicators, returns",
            },
            {
              name: "low",
              type: "REAL",
              description: "Low price for the day.",
              source: "Bhavcopy / prices feed",
              usedIn: "Indicators, returns",
            },
            {
              name: "close",
              type: "REAL",
              description: "Close price for the day.",
              source: "Bhavcopy / prices feed",
              usedIn: "Indicators, P&L, charts",
            },
            {
              name: "volume",
              type: "REAL",
              description: "Traded volume.",
              source: "Bhavcopy / prices feed",
              usedIn: "Liquidity filters",
            },
            {
              name: "turnover",
              type: "REAL",
              description: "Turnover in base currency (approx).",
              source: "Derived: price * volume",
              usedIn: "Liquidity filters / creamy layer",
            },
          ],
        },
        {
          id: "aiw_signals_daily",
          name: "AIW_SIGNALS_DAILY",
          contextKey: "aiw.signals.daily",
          short: "Signals generated by the BBQF / strategy stack.",
          description:
            "Per-day, per-symbol signals generated by the AI Wealth strategy engines before creamy layer filtering.",
          fields: [
            {
              name: "run_date",
              type: "DATE",
              description:
                "Control/strategy run date (IST) for which this signal was produced.",
              source: "Control run driver",
              usedIn: "Validation, UI, reports",
            },
            {
              name: "symbol",
              type: "TEXT",
              description: "Instrument symbol.",
              source: "Universe master join",
              usedIn: "Key",
            },
            {
              name: "direction",
              type: "TEXT",
              description: "BUY / SELL / HOLD / EXIT.",
              source: "BBQF / strategy engine",
              usedIn: "Creamy layer, proposals",
            },
            {
              name: "entry_price",
              type: "REAL",
              description: "Suggested entry price.",
              source: "Strategy output",
              usedIn: "Order proposal, R:R",
            },
            {
              name: "target_price",
              type: "REAL",
              description: "Suggested target price.",
              source: "Strategy output",
              usedIn: "Expected return, R:R",
            },
            {
              name: "stop_loss_price",
              type: "REAL",
              description: "Suggested stop-loss price.",
              source: "Strategy output",
              usedIn: "Risk per trade, buckets",
            },
            {
              name: "expected_return_pct",
              type: "REAL",
              description: "Expected % return from entry to target.",
              source: "Derived from prices",
              usedIn: "Filters, creamy layer, UI",
            },
            {
              name: "risk_bucket",
              type: "TEXT",
              description:
                "Risk bucket label (CONSERVATIVE / BALANCED / AGGRESSIVE / ULTRA_AGGRESSIVE).",
              source: "Risk engine",
              usedIn: "Creamy layer, approvals, UI filters",
            },
            {
              name: "confidence_score",
              type: "REAL",
              description: "0–100 confidence score of this signal.",
              source: "AI / ensemble engine",
              usedIn: "Approvals, auto mode gating",
            },
            {
              name: "ai_reason",
              type: "TEXT",
              description: "Short textual rationale for the signal.",
              source: "LLM / explainer agent",
              usedIn: "FounderConsole trade detail panel",
            },
          ],
        },
      ],
    },
    {
      id: "staging",
      title: "Data & Staging Tables",
      description:
        "Loader, raw and staging tables used to bring data into AI Wealth before normalization.",
      tables: [
        {
          id: "aiw_loader_raw_bhavcopy",
          name: "AIW_LOADER_RAW_BHAVCOPY",
          contextKey: "aiw.loader.rawBhavcopy",
          short: "Raw bhavcopy / price files as received from source.",
          description:
            "Raw, minimally processed price files from NSE/BSE or vendor, kept for audit and replay.",
          fields: [
            {
              name: "file_name",
              type: "TEXT",
              description: "Original file name received.",
              source: "Downloader",
              usedIn: "ETL logging",
            },
            {
              name: "ingest_ts",
              type: "TIMESTAMP",
              description: "When this file was ingested (UTC/IST).",
              source: "Loader",
              usedIn: "Audit, troubleshooting",
            },
            {
              name: "raw_line",
              type: "TEXT",
              description: "Original line content.",
              source: "File contents",
              usedIn: "Debugging parsing issues",
            },
            {
              name: "parse_status",
              type: "TEXT",
              description: "OK / WARN / ERROR.",
              source: "Loader parser",
              usedIn: "Monitoring, retries",
            },
          ],
        },
        {
          id: "aiw_universe_loader_log",
          name: "AIW_UNIVERSE_LOADER_LOG",
          contextKey: "aiw.loader.universeLog",
          short: "High-level log of universe/price load operations.",
          description:
            "Tracks data loads into universe & price tables for observability and debugging.",
          fields: [
            {
              name: "run_ts",
              type: "TIMESTAMP",
              description: "Timestamp when this loader run started.",
              source: "Loader driver",
              usedIn: "Audit, run history",
            },
            {
              name: "data_date",
              type: "DATE",
              description: "Trading date covered by the load.",
              source: "Loader parameters",
              usedIn: "Re-runs, gap checks",
            },
            {
              name: "rows_inserted",
              type: "INTEGER",
              description: "Number of rows inserted.",
              source: "Loader metrics",
              usedIn: "Monitoring",
            },
            {
              name: "rows_updated",
              type: "INTEGER",
              description: "Number of rows updated/merged.",
              source: "Loader metrics",
              usedIn: "Monitoring",
            },
            {
              name: "status",
              type: "TEXT",
              description: "SUCCESS / PARTIAL / FAILED.",
              source: "Loader exit status",
              usedIn: "Alerts, dashboards",
            },
            {
              name: "error_message",
              type: "TEXT",
              description: "Error details if failed or partial.",
              source: "Exception / log",
              usedIn: "Troubleshooting",
            },
          ],
        },
      ],
    },
    {
      id: "reference",
      title: "Reference / Master Tables",
      description:
        "Static or slowly changing reference data (e.g., broker, segment, holiday calendars).",
      tables: [
        {
          id: "aiw_ref_segment",
          name: "AIW_REF_SEGMENT",
          contextKey: "aiw.ref.segment",
          short: "Reference list of segments and their properties.",
          description:
            "Defines high-level market segments with risk and behaviour notes.",
          fields: [
            {
              name: "segment_id",
              type: "TEXT",
              description: "Segment code (EQ, F&O, ETF, MF, INDEX, SME).",
              source: "Design-time config",
              usedIn: "Universe, filters",
            },
            {
              name: "description",
              type: "TEXT",
              description: "Human readable description.",
              source: "Design-time config",
              usedIn: "UI labels",
            },
            {
              name: "default_risk_bucket",
              type: "TEXT",
              description:
                "Default risk bucket if not overridden (CONSERVATIVE / BALANCED / etc.).",
              source: "Risk engine design",
              usedIn: "Initial risk tagging",
            },
            {
              name: "is_active",
              type: "INTEGER (0/1)",
              description: "If 0, segment is deprecated.",
              source: "Config",
              usedIn: "Filters",
            },
          ],
        },
        {
          id: "aiw_ref_holiday_calendar",
          name: "AIW_REF_HOLIDAY_CALENDAR",
          contextKey: "aiw.ref.holidayCalendar",
          short: "Trading holiday calendar for NSE/BSE.",
          description:
            "Pre-loaded list of market holidays used by schedulers and backtests.",
          fields: [
            {
              name: "holiday_date",
              type: "DATE",
              description: "Market holiday date (IST).",
              source: "Exchange holiday list",
              usedIn: "Scheduler, AIW holiday-aware agent",
            },
            {
              name: "exchange",
              type: "TEXT",
              description: "Exchange (NSE / BSE / BOTH).",
              source: "Exchange list",
              usedIn: "Multi-exchange scheduling",
            },
            {
              name: "reason",
              type: "TEXT",
              description: "Holiday reason (e.g., Diwali, Republic Day).",
              source: "Exchange list",
              usedIn: "UI, audit",
            },
          ],
        },
      ],
    },
    {
      id: "config",
      title: "Configuration Tables (AIW_C_*)",
      description:
        "Configuration and guardrail tables stored in aiw.db (AIW_C_*). These drive profiles, risk buckets, strategies, brokers, holidays, and tenant mappings.",
      tables: [
        {
          id: "aiw_c_environment",
          name: "AIW_C_ENVIRONMENT",
          contextKey: "universe.table.AIW_C_ENVIRONMENT",
          short: "Environment config (SIM / CONTROL / LIVE).",
          description:
            "Defines high-level environments (e.g., SIM, CONTROL, LIVE) with flags and parameters used across AI Wealth.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description:
                "Phase 1: refer to the live table view under 2.1.1.3.1.1 for full column list. This dictionary will be expanded in Phase 2.",
              source: "aiw.db / AIW_C_ENVIRONMENT",
              usedIn: "All env-aware logic"
            }
          ]
        },
        {
          id: "aiw_c_profile",
          name: "AIW_C_PROFILE",
          contextKey: "universe.table.AIW_C_PROFILE",
          short: "Risk profiles per environment.",
          description:
            "Defines profiles like EQUITY_CONSERVATIVE / BALANCED / AGGRESSIVE per environment.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description:
                "Phase 1: refer to 2.1.1.3.1.2 for detailed columns; dictionary will be refined later.",
              source: "aiw.db / AIW_C_PROFILE",
              usedIn: "Creamy layer, approvals, allocation"
            }
          ]
        },
        {
          id: "aiw_c_risk_category",
          name: "AIW_C_RISK_CATEGORY",
          contextKey: "universe.table.AIW_C_RISK_CATEGORY",
          short: "Risk categories (CONSERVATIVE, BALANCED, etc.).",
          description:
            "Reference table of risk categories and their characteristics.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description:
                "See live table node 2.1.1.3.1.3; this entry keeps the dictionary aligned.",
              source: "aiw.db / AIW_C_RISK_CATEGORY",
              usedIn: "Risk bucket engine"
            }
          ]
        },
        {
          id: "aiw_c_strategy",
          name: "AIW_C_STRATEGY",
          contextKey: "universe.table.AIW_C_STRATEGY",
          short: "High-level strategies (e.g., BBQF, mean-reversion).",
          description:
            "Names and descriptions of strategies available to the engine.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description:
                "See node 2.1.1.3.1.4 for full details; dictionary will be expanded.",
              source: "aiw.db / AIW_C_STRATEGY",
              usedIn: "Strategy selection, UI"
            }
          ]
        },
        {
          id: "aiw_c_strategy_param",
          name: "AIW_C_STRATEGY_PARAM",
          contextKey: "universe.table.AIW_C_STRATEGY_PARAM",
          short: "Parameters per strategy.",
          description:
            "Holds tunable parameters per strategy (lookback, thresholds, etc.).",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.1.5; mapped 1:1 to aiw.db.",
              source: "aiw.db / AIW_C_STRATEGY_PARAM",
              usedIn: "Backtests, live engine"
            }
          ]
        },
        {
          id: "aiw_c_strategy_profile",
          name: "AIW_C_STRATEGY_PROFILE",
          contextKey: "universe.table.AIW_C_STRATEGY_PROFILE",
          short: "Mapping between strategies and profiles.",
          description:
            "Defines which strategies apply to which profiles / environments.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.1.6 for full columns.",
              source: "aiw.db / AIW_C_STRATEGY_PROFILE",
              usedIn: "Allocation, control run"
            }
          ]
        },
        {
          id: "aiw_c_strategy_scope",
          name: "AIW_C_STRATEGY_SCOPE",
          contextKey: "universe.table.AIW_C_STRATEGY_SCOPE",
          short: "Scope of each strategy (segments, instruments).",
          description:
            "Controls where strategies are allowed to operate (EQ/F&O, NIFTY100, etc.).",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.1.7.",
              source: "aiw.db / AIW_C_STRATEGY_SCOPE",
              usedIn: "Universe filters, routing"
            }
          ]
        },
        {
          id: "aiw_c_creamy_layer",
          name: "AIW_C_CREAMY_LAYER",
          contextKey: "universe.table.AIW_C_CREAMY_LAYER",
          short: "Creamy layer sizing and rules.",
          description:
            "Rules defining how many instruments qualify for creamy layer and related thresholds.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.1.8.",
              source: "aiw.db / AIW_C_CREAMY_LAYER",
              usedIn: "Control run, approvals"
            }
          ]
        },
        {
          id: "aiw_c_profile_approval_rules",
          name: "AIW_C_PROFILE_APPROVAL_RULES",
          contextKey: "universe.table.AIW_C_PROFILE_APPROVAL_RULES",
          short: "Approval rules per profile.",
          description:
            "Defines manual/auto approval rules per profile and risk bucket.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.1.9.",
              source: "aiw.db / AIW_C_PROFILE_APPROVAL_RULES",
              usedIn: "FounderConsole approval engine"
            }
          ]
        },
        {
          id: "aiw_c_broker",
          name: "AIW_C_BROKER",
          contextKey: "universe.table.AIW_C_BROKER",
          short: "Broker master.",
          description:
            "Defines brokers (Zerodha, Samco, Global, etc.) and their properties.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.2.1.",
              source: "aiw.db / AIW_C_BROKER",
              usedIn: "Routing, connectivity"
            }
          ]
        },
        {
          id: "aiw_c_broker_routing",
          name: "AIW_C_BROKER_ROUTING",
          contextKey: "universe.table.AIW_C_BROKER_ROUTING",
          short: "Routing rules per broker / segment.",
          description:
            "Controls how orders are routed between brokers for segments/profiles.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.2.2.",
              source: "aiw.db / AIW_C_BROKER_ROUTING",
              usedIn: "Order router"
            }
          ]
        },
        {
          id: "aiw_c_user_profile_map",
          name: "AIW_C_USER_PROFILE_MAP",
          contextKey: "universe.table.AIW_C_USER_PROFILE_MAP",
          short: "Mapping between customers and profiles.",
          description:
            "Links each customer/tenant to a risk profile and environment.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.2.3.",
              source: "aiw.db / AIW_C_USER_PROFILE_MAP",
              usedIn: "Allocations, AIW User Settings"
            }
          ]
        },
        {
          id: "aiw_c_holiday_calendar",
          name: "AIW_C_HOLIDAY_CALENDAR",
          contextKey: "universe.table.AIW_C_HOLIDAY_CALENDAR",
          short: "Holiday calendar (NSE/BSE).",
          description:
            "Trading holiday list for schedulers and AIW holiday-aware agent.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.2.4.",
              source: "aiw.db / AIW_C_HOLIDAY_CALENDAR",
              usedIn: "Scheduler, control run"
            }
          ]
        },
        {
          id: "aiw_c_tenant_profile_env",
          name: "AIW_C_TENANT_PROFILE_ENV",
          contextKey: "universe.table.AIW_C_TENANT_PROFILE_ENV",
          short: "Tenant–profile–environment mapping.",
          description:
            "Maps tenants to profiles and environments, used for multi-tenant setups.",
          fields: [
            {
              name: "(columns…)",
              type: "see live table",
              description: "See node 2.1.1.3.2.5.",
              source: "aiw.db / AIW_C_TENANT_PROFILE_ENV",
              usedIn: "Multi-tenant deployments"
            }
          ]
        }
      ]
    }
  ];

  // --- Public entry: 2.1.1.3 Data & Universe -------------------------------

  function showOverview() {
    clearDetail();

    detailTitleEl.textContent = "AI Wealth – Data & Universe Dictionary";
    detailPathEl.textContent = "Node: 2.1.1.3 • Key: aiw.config.data_universe";
    detailMetaEl.textContent =
      "Context: Logical view of AI Wealth data model (universe, prices, signals, loaders, reference).";

    let html = "";
    html += `<p><strong>AI Wealth Data & Universe</strong></p>`;
    html += `<p>This screen acts like an SAP-style data dictionary for AI Wealth. On the left you see logical tables; selecting a table shows its field definition and how it is used.</p>`;
    html += `<p style="font-size:12px; opacity:0.85;">Phase 1: documentation only (no live DB introspection). Phase 2: this will read from <code>aiw.db</code> and show live schema & row counts.</p>`;

    // Render group tabs header
    html += `<div class="aiw-datauniverse-group-tabs">`;
    for (const g of groups) {
      html += `<button class="aiw-datauniverse-group-tab" data-group-id="${g.id}">${g.title}</button>`;
    }
    html += `</div>`;

    detailBodyEl.innerHTML = html;
    detailTableContainer.innerHTML = "";

    const tabButtons = Array.from(
      detailBodyEl.querySelectorAll(".aiw-datauniverse-group-tab")
    );

    function activateGroup(groupId) {
      const g = groups.find((x) => x.id === groupId) || groups[0];
      tabButtons.forEach((btn) => {
        if (btn.getAttribute("data-group-id") === g.id) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      renderTableList(g, groups);
    }

    for (const btn of tabButtons) {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-group-id");
        activateGroup(id);
      });
    }

    // default group
    if (groups.length > 0) {
      activateGroup(groups[0].id);
    }
  }

  // --- Expose public API ----------------------------------------------------

  return {
    showOverview,
  };
})();

