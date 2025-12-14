/**
 * @fc_module: AIW Settings module
 * @fc_purpose: 2.1.1.9 Founder/User/Broker settings screens
 * @fc_source: ~/aiw-settings.js
 * @fc_deploy: /app/backend/aiw-settings.js
 * @fc_status: ACTIVE
 */

window.AiwSettings = (function () {
  const STORAGE = {
    founder: "aiw_settings_founder_v1",
    user: "aiw_settings_user_v1",
    broker: "aiw_settings_broker_v1",
  };

  // ---------- Small helpers ----------

  function loadLocal(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function saveLocal(storageKey, obj) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(obj));
      return true;
    } catch (e) {
      console.error("AIW Settings save error", e);
      return false;
    }
  }

  // Collect values from the generated settings table
  function collectValues(fields, storageKey) {
    const out = {};
    for (const f of fields) {
      const id = `${storageKey}_${f.key}`;

      // Multicheck fields are rendered as groups of checkboxes
      if (f.type === "multicheck") {
        const vals = [];
        const boxes = document.querySelectorAll(`input[name="${id}"]:checked`);
        boxes.forEach((box) => vals.push(box.value));
        out[f.key] = vals;
        continue;
      }

      const el = document.getElementById(id);
      if (!el) continue;

      if (f.type === "checkbox") {
        out[f.key] = !!el.checked;
      } else if (f.type === "number") {
        const v = el.value;
        out[f.key] = v === "" ? null : Number(v);
      } else {
        out[f.key] = el.value;
      }
    }
    return out;
  }

  function renderSettingsScreen(config) {
    const {
      storageKey,
      title,
      nodePath,
      context,
      fields,
      introLines = [],
    } = config;

    // These DOM refs are defined in the Root UI script
    detailTitleEl.textContent = title;
    detailPathEl.textContent = nodePath;
    detailMetaEl.textContent = context;
    detailTableContainer.innerHTML = "";

    const saved = loadLocal(storageKey);

    let html = "";
    html += `<p><strong>${title}</strong></p>`;
    if (introLines.length) {
      html += "<ul>";
      for (const line of introLines) {
        html += `<li>${line}</li>`;
      }
      html += "</ul>";
    }
    html += `<p>Phase 1 – values are stored locally in this browser only. Use JSON preview to copy into backend tables later.</p>`;

    html += `<table class="aiw-settings-table">
      <thead>
        <tr><th style="width:28%">Setting</th><th style="width:32%">Value</th><th>Description</th></tr>
      </thead>
      <tbody>
    `;

    for (const f of fields) {
      const id = `${storageKey}_${f.key}`;
      const current =
        saved[f.key] !== undefined
          ? saved[f.key]
          : f.defaultValue !== undefined
          ? f.defaultValue
          : "";

      let inputHtml = "";

      if (f.type === "select") {
        inputHtml += `<select id="${id}">`;
        for (const opt of f.options || []) {
          const sel = String(current) === String(opt) ? " selected" : "";
          inputHtml += `<option value="${opt}"${sel}>${opt}</option>`;
        }
        inputHtml += `</select>`;
      } else if (f.type === "multicheck") {
        const currentArr = Array.isArray(current) ? current : [];
        inputHtml += `<div class="aiw-multicheck-group">`;
        for (const opt of f.options || []) {
          const checkboxId = `${id}__${opt}`;
          const checked = currentArr.includes(opt) ? " checked" : "";
          inputHtml += `
            <label style="display:block;">
              <input
                type="checkbox"
                id="${checkboxId}"
                name="${id}"
                value="${opt}"${checked}
              />
              ${opt}
            </label>`;
        }
        inputHtml += `</div>`;
      } else if (f.type === "checkbox") {
        const chk = current ? " checked" : "";
        inputHtml += `<input id="${id}" type="checkbox"${chk} />`;
      } else if (f.type === "time") {
        inputHtml += `<input id="${id}" type="time" value="${
          current || ""
        }" />`;
      } else if (f.type === "number") {
        const stepAttr = f.step ? ` step="${f.step}"` : "";
        inputHtml += `<input id="${id}" type="number"${stepAttr} value="${
          current === null || current === undefined ? "" : current
        }" />`;
      } else {
        inputHtml += `<input id="${id}" type="text" value="${
          current || ""
        }" />`;
      }

      html += `<tr>
        <td><strong>${f.label}</strong><br/><code>${f.key}</code></td>
        <td>${inputHtml}</td>
        <td>${f.description || ""}</td>
      </tr>`;
    }

    html += `</tbody></table>`;

    html += `
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button id="${storageKey}_save_btn">Save (browser)</button>
        <button id="${storageKey}_reset_btn">Reset to defaults</button>
        <button id="${storageKey}_json_btn">Preview JSON</button>
      </div>
      <pre id="${storageKey}_json_preview" style="margin-top:10px; padding:8px; background:#050b13; border-radius:6px; max-height:220px; overflow:auto; display:none;"></pre>
    `;

    detailBodyEl.innerHTML = html;

    const saveBtn = document.getElementById(`${storageKey}_save_btn`);
    const resetBtn = document.getElementById(`${storageKey}_reset_btn`);
    const jsonBtn = document.getElementById(`${storageKey}_json_btn`);
    const jsonPre = document.getElementById(`${storageKey}_json_preview`);

    function writeJsonPreview(obj) {
      if (!jsonPre) return;
      jsonPre.textContent = JSON.stringify(obj, null, 2);
      jsonPre.style.display = "block";
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const collected = collectValues(fields, storageKey);

        // 1) Keep existing local browser save behaviour
        const ok = saveLocal(storageKey, collected);
        if (ok) {
          alert("Settings saved in this browser (Phase 1).");
        } else {
          alert("Could not save settings to local storage.");
        }

        // 2) Sync to backend tables based on which screen this is
        const kind = inferSettingsKind(config.context, config.title);
        await syncSettingsToBackend(kind, collected);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const defaults = {};
        for (const f of fields) {
          if (f.defaultValue !== undefined) {
            defaults[f.key] = f.defaultValue;
          } else {
            defaults[f.key] = f.type === "checkbox" ? false : "";
          }
        }
        saveLocal(storageKey, defaults);
        renderSettingsScreen(config); // re-render with defaults
      });
    }

    if (jsonBtn) {
      jsonBtn.addEventListener("click", () => {
        const collected = collectValues(fields, storageKey);
        writeJsonPreview(collected);
      });
    }
  }

  // ---------- Backend wiring helpers ----------

  function inferSettingsKind(context, title) {
    const ctx = (context || "").toLowerCase();
    const t = (title || "").toLowerCase();

    if (ctx.includes("founder") || t.includes("founder")) return "founder";
    if (ctx.includes("user")) return "user";
    if (ctx.includes("broker")) return "broker";

    return null;
  }

  async function syncSettingsToBackend(kind, collected) {
    if (!kind) return;

    try {
      if (kind === "founder") {
        // Founder: single row, whole payload
        await fetch("/api/aiwealth/settings/founder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: collected }),
        });
      } else if (kind === "user") {
        // User: one row per customer
        const customerId = collected.customer_id || "";
        if (!customerId) {
          console.warn(
            "AIW user settings: customer_id missing; backend sync skipped"
          );
          return;
        }

        await fetch("/api/aiwealth/settings/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: customerId,
            payload: collected,
          }),
        });
      } else if (kind === "broker") {
        // Broker: one row per (broker_code, env)
        const brokerCode = collected.broker_code || "";
        if (!brokerCode) {
          console.warn(
            "AIW broker settings: broker_code missing; backend sync skipped"
          );
          return;
        }

        // If you later add an explicit env field on the broker screen, wire it here
        const env = collected.env || collected.environment_mode || "SIM";

        await fetch("/api/aiwealth/settings/broker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            broker_code: brokerCode,
            env,
            payload: collected,
          }),
        });
      }
    } catch (err) {
      console.warn("AIW settings backend sync error:", err);
    }
  }

  // ---------- Field definitions ----------

  const founderIntro = [
    "Global guardrails set by the founder for AI Wealth.",
    "These settings cap daily loss, per-trade risk and control routing to brokers.",
    "Phase 1: values are browser-only; later we will sync to backend tables.",
  ];

  const founderFields = [
    // Core
    {
      key: "environment_mode",
      label: "Environment mode",
      type: "select",
      options: ["SIM", "CONTROL", "LIVE"],
      defaultValue: "SIM",
      description:
        "Which environment these guardrails apply to (SIM / CONTROL / LIVE).",
    },
    {
      key: "base_currency",
      label: "Base currency",
      type: "select",
      options: ["INR"],
      defaultValue: "INR",
      description:
        "Base currency for risk, P&L and sizing (Phase 1: INR only).",
    },
    {
      key: "default_run_time",
      label: "Default control run time (IST)",
      type: "time",
      defaultValue: "09:00",
      description:
        "Default time when the control run should evaluate the daily universe and produce proposals.",
    },

    // Approval gates (global switches)
    {
      key: "enable_auto_approval_for_users",
      label: "Allow customers to use auto-approval",
      type: "checkbox",
      defaultValue: true,
      description:
        "If turned off, no customer can enable auto-approval in their AIW user settings.",
    },
    {
      key: "enable_manual_approval_for_users",
      label: "Allow customers to use manual approval",
      type: "checkbox",
      defaultValue: true,
      description:
        "If turned off, customers cannot use manual approval; all trades must follow auto-approval rules where allowed.",
    },

    // Portfolio risk caps
    {
      key: "max_daily_loss_pct",
      label: "Max daily portfolio loss %",
      type: "number",
      step: "0.1",
      defaultValue: 2.0,
      description:
        "If daily portfolio loss reaches this percent of capital, engine stops proposing new trades.",
    },
    {
      key: "max_per_trade_capital_pct",
      label: "Max per-trade capital risk %",
      type: "number",
      step: "0.1",
      defaultValue: 0.5,
      description:
        "Maximum capital (as % of portfolio) that can be at risk in a single trade, based on entry vs stop-loss.",
    },
    {
      key: "max_open_positions",
      label: "Max open positions",
      type: "number",
      defaultValue: 20,
      description:
        "Global cap on number of simultaneous open positions across all instruments.",
    },
    {
      key: "max_trades_per_day",
      label: "Max trades per day",
      type: "number",
      defaultValue: 50,
      description:
        "Hard cap on number of trade entries the engine is allowed to propose in a single trading day.",
    },

    // Universe sizing
    {
      key: "max_candidates_per_run",
      label: "Max candidates per run",
      type: "number",
      defaultValue: 5000,
      description: "Maximum number of candidate instruments considered per run.",
    },
    {
      key: "creamy_layer_size",
      label: "Creamy layer size",
      type: "number",
      defaultValue: 200,
      description:
        "Maximum number of final shortlisted instruments in the creamy layer output.",
    },

    // Universe filters
    {
      key: "allowed_segments",
      label: "Allowed segments",
      type: "multicheck",
      options: ["EQ", "F&O", "ETF", "MF", "INDEX", "SME"],
      defaultValue: ["EQ", "ETF", "INDEX"],
      description:
        "Market segments allowed for this configuration. Others are filtered out at universe stage.",
    },
    {
      key: "exclude_penny_stocks_below_price",
      label: "Exclude stocks below price (₹)",
      type: "number",
      defaultValue: 20,
      description:
        "Stocks with price below this level are excluded from the AI Wealth universe.",
    },
    {
      key: "require_min_liquidity_turnover",
      label: "Min daily turnover (₹)",
      type: "number",
      defaultValue: 0,
      description:
        "Optional liquidity filter. If greater than zero, only instruments with turnover >= this value are allowed.",
    },

    // Approval policy (customer auto-approval parameters)
    {
      key: "manual_approval_required",
      label: "Global manual approval flag (reserved)",
      type: "checkbox",
      defaultValue: true,
      description:
        "Legacy global manual approval flag. Currently not used for customer approvals (governed by the gates above).",
    },
    {
      key: "auto_approve_threshold_expected_pct",
      label: "Auto-approve min expected return %",
      type: "number",
      defaultValue: 1.0,
      description:
        "Minimum expected return for a trade to be eligible for customer auto-approval (subject to customer overrides).",
    },
    {
      key: "auto_approve_min_confidence",
      label: "Auto-approve min confidence %",
      type: "number",
      defaultValue: 70,
      description:
        "Minimum AI confidence score (0–100) required for a trade to be eligible for auto-approval.",
    },
    {
      key: "auto_approve_allowed_risk_buckets",
      label: "Auto-approve allowed risk buckets",
      type: "multicheck",
      options: ["CONSERVATIVE", "BALANCED", "AGGRESSIVE", "ULTRA_AGGRESSIVE"],
      defaultValue: ["CONSERVATIVE", "BALANCED"],
      description:
        "Only trades in these risk buckets can be auto-approved when hybrid mode is enabled.",
    },
    {
      key: "default_action_on_high_risk_bucket",
      label: "Action on HIGH / ULTRA risk",
      type: "select",
      options: ["REJECT", "HOLD", "ALLOW_WITH_HEDGE"],
      defaultValue: "HOLD",
      description:
        "What AI Wealth should do when a trade falls in a higher risk bucket.",
    },

    // Broker routing
    {
      key: "primary_broker_id",
      label: "Primary broker",
      type: "select",
      options: ["ZERODHA", "SAMCO", "GLOBAL", "UPSTOX", "ANGELONE"],
      defaultValue: "ZERODHA",
      description:
        "Primary broker to be used for order routing when available.",
    },
    {
      key: "default_broker_eq_id",
      label: "Default broker for EQ",
      type: "select",
      options: ["ZERODHA", "SAMCO", "GLOBAL", "UPSTOX", "ANGELONE"],
      defaultValue: "ZERODHA",
      description: "Preferred broker account for cash/equity segment.",
    },
    {
      key: "default_broker_fo_id",
      label: "Default broker for F&O",
      type: "select",
      options: ["ZERODHA", "SAMCO", "GLOBAL", "UPSTOX", "ANGELONE"],
      defaultValue: "SAMCO",
      description: "Preferred broker account for derivatives / F&O segment.",
    },
    {
      key: "allow_partial_execution",
      label: "Allow partial execution",
      type: "checkbox",
      defaultValue: true,
      description:
        "If disabled, engine prefers full fills only; if enabled, allows partial execution according to broker behaviour.",
    },
    {
      key: "broker_fallback_strategy",
      label: "Broker fallback strategy",
      type: "select",
      options: [
        "TRY_PRIMARY_ONLY",
        "FALLBACK_TO_SECONDARY",
        "ROUND_ROBIN_PRIMARY_SECONDARY",
      ],
      defaultValue: "FALLBACK_TO_SECONDARY",
      description:
        "Routing behaviour when primary broker is unavailable or rejects an order.",
    },

    // Alerts
    {
      key: "daily_email_summary_enabled",
      label: "Daily email summary enabled",
      type: "checkbox",
      defaultValue: true,
      description:
        "Send global daily P&L and risk summary email to the founder.",
    },
    {
      key: "daily_whatsapp_summary_enabled",
      label: "Daily WhatsApp summary enabled",
      type: "checkbox",
      defaultValue: true,
      description:
        "Send daily high-level updates to the founder via WhatsApp.",
    },
    {
      key: "alert_on_risk_breach",
      label: "Alert on risk breach",
      type: "checkbox",
      defaultValue: true,
      description:
        "If enabled, send instant alerts whenever global risk limits are breached.",
    },
    {
      key: "alert_recipient_group",
      label: "Alert recipient group",
      type: "select",
      options: ["FOUNDER_ONLY", "FOUNDER_CFO", "CUSTOM"],
      defaultValue: "FOUNDER_ONLY",
      description:
        "Who should receive risk breach alerts by default (more detailed routing later).",
    },
  ];

  // --- User settings (per-customer) ---

  const userIntro = [
    "Per-customer risk and preference overrides.",
    "These settings sit on top of the founder guardrails.",
  ];

  const userFields = [
    {
      key: "customer_id",
      label: "Customer ID",
      type: "text",
      defaultValue: "",
      description:
        "Internal customer or investor key (will later map to licensing / CRM).",
    },
    {
      key: "risk_profile_id",
      label: "Risk profile",
      type: "select",
      options: ["CONSERVATIVE", "BALANCED", "AGGRESSIVE", "ULTRA_AGGRESSIVE"],
      defaultValue: "BALANCED",
      description:
        "Which risk profile applies to this customer. Used to pick bucket engine parameters.",
    },
    {
      key: "target_return_min_pct",
      label: "Target return min %",
      type: "number",
      defaultValue: 10,
      description: "Minimum annualised return the customer expects.",
    },
    {
      key: "target_return_max_pct",
      label: "Target return max %",
      type: "number",
      defaultValue: 25,
      description:
        "Upper bound of target range. Used only for reporting and strategy selection.",
    },
    {
      key: "max_drawdown_pct",
      label: "Max drawdown %",
      type: "number",
      defaultValue: 15,
      description:
        "Per-customer drawdown guardrail. If breached, allocations are reduced or paused.",
    },

    // Segments & capital
    {
      key: "allowed_segments",
      label: "Allowed segments",
      type: "multicheck",
      options: ["EQ", "F&O", "ETF", "MF", "INDEX", "SME"],
      defaultValue: ["EQ", "ETF"],
      description:
        "Market segments this customer is allowed to invest in. All others blocked.",
    },
    {
      key: "capital_base_amount",
      label: "Capital base amount (₹)",
      type: "number",
      defaultValue: 0,
      description:
        "Total capital amount engine should consider for sizing allocations for this customer.",
    },
    {
      key: "cash_withdrawal_reserved_amount",
      label: "Cash withdrawal reserved (₹)",
      type: "number",
      defaultValue: 0,
      description:
        "Amount the customer plans to withdraw soon. AI Wealth will not use this amount for new trades.",
    },
    {
      key: "per_trade_capital_pct",
      label: "Per-trade capital cap %",
      type: "number",
      defaultValue: 5,
      description:
        "Optional per-customer cap on capital per trade. If 0, founder-level setting is used.",
    },
    {
      key: "max_open_positions",
      label: "Max open positions (customer)",
      type: "number",
      defaultValue: 10,
      description:
        "Per-customer limit on number of simultaneous open positions (if > 0).",
    },

    // Approval mode for this customer
    {
      key: "manual_approval_required",
      label: "Require manual approval in customer console",
      type: "checkbox",
      defaultValue: true,
      description:
        "If checked (and global manual approvals are allowed), this customer will approve trades manually in their console.",
    },
    {
      key: "auto_approval_enabled",
      label: "Allow auto-approval for this customer",
      type: "checkbox",
      defaultValue: false,
      description:
        "If checked (and global auto-approval is allowed), this customer can use auto-approval for trades that meet global and customer thresholds.",
    },
    {
      key: "auto_approve_threshold_expected_pct",
      label: "Auto-approve min expected return %",
      type: "number",
      defaultValue: 2,
      description:
        "Customer-level override for the expected return threshold used by auto-approval (stricter than founder if higher).",
    },

    // Broker / account selection (Phase 1 simple: primary broker)
    {
      key: "preferred_broker_account_id",
      label: "Primary trading broker/account",
      type: "select",
      options: ["DEFAULT", "ZERODHA", "SAMCO", "GLOBAL", "UPSTOX"],
      defaultValue: "DEFAULT",
      description:
        "Primary broker/account AI Wealth should use for this customer. DEFAULT follows founder-level routing (Phase 1 placeholder; later this maps to actual DEMAT accounts).",
    },

    // Notifications
    {
      key: "notification_email",
      label: "Notification email",
      type: "text",
      defaultValue: "",
      description:
        "Email address to receive this customer's statements and alerts.",
    },
    {
      key: "notification_whatsapp",
      label: "Notification WhatsApp number",
      type: "text",
      defaultValue: "",
      description:
        "WhatsApp number for alerts for this customer only.",
    },

    // Status
    {
      key: "is_active",
      label: "Is active",
      type: "checkbox",
      defaultValue: true,
      description:
        "Whether this customer configuration is active. Inactive customers are skipped in allocation.",
    },
  ];

  // --- Broker API capabilities ---

  const brokerIntro = [
    "Per-broker API capability matrix (Phase 1 manual).",
    "Helps AI Wealth decide which broker can handle which type of order.",
  ];

  const brokerFields = [
    {
      key: "broker_code",
      label: "Broker code",
      type: "select",
      options: ["ZERODHA", "SAMCO", "GLOBAL", "UPSTOX", "ANGELONE"],
      defaultValue: "ZERODHA",
      description:
        "Logical broker identifier. Later this will map to aiw_brokers table.",
    },
    {
      key: "supports_eq",
      label: "Supports EQ",
      type: "checkbox",
      defaultValue: true,
      description: "Whether the broker supports equity delivery/cash segment.",
    },
    {
      key: "supports_fo",
      label: "Supports F&O",
      type: "checkbox",
      defaultValue: true,
      description: "Whether the broker supports derivatives / F&O segment.",
    },
    {
      key: "supports_mf",
      label: "Supports Mutual Funds",
      type: "checkbox",
      defaultValue: false,
      description:
        "Whether the broker offers mutual fund execution via API or platform.",
    },
    {
      key: "supports_gtt",
      label: "Supports GTT / advanced orders",
      type: "checkbox",
      defaultValue: true,
      description:
        "Whether advanced order types such as GTT / bracket orders are supported via API.",
    },
    {
      key: "max_orders_per_min",
      label: "Rate limit (orders/min)",
      type: "number",
      defaultValue: 60,
      description:
        "Approximate safe rate limit for this broker. Used by throttle logic.",
    },
    {
      key: "notes",
      label: "Notes",
      type: "text",
      defaultValue: "",
      description:
        "Free-form notes about API quirks, stability or special handling.",
    },
  ];

  // ---------- Public API ----------

  function showFounder() {
    renderSettingsScreen({
      storageKey: STORAGE.founder,
      title: "AIW Founder Settings",
      nodePath: "Node: 2.1.1.9.1.1 • Key: aiw.settings.founder",
      context: "Context: aiw_settings_founder",
      fields: founderFields,
      introLines: founderIntro,
    });
  }

  function showUser() {
    renderSettingsScreen({
      storageKey: STORAGE.user,
      title: "AIW User Settings",
      nodePath: "Node: 2.1.1.9.1.2 • Key: aiw.settings.user",
      context: "Context: aiw_settings_user",
      fields: userFields,
      introLines: userIntro,
    });
  }

  function showBroker() {
    renderSettingsScreen({
      storageKey: STORAGE.broker,
      title: "AIW Broker API Capabilities",
      nodePath: "Node: 2.1.1.9.1.3 • Key: aiw.settings.broker",
      context: "Context: aiw_settings_brokerApi",
      fields: brokerFields,
      introLines: brokerIntro,
    });
  }

  return {
    showFounder,
    showUser,
    showBroker,
  };
})();

// =======================================================
// AIW SETTINGS – GENERIC WIRING v1 (do not edit the UI)
// =======================================================
(function () {
  // Collect all inputs/selects/textareas from a container
  function collectFormFields(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.warn("AIW settings container not found:", containerSelector);
      return {};
    }

    const fields = {};
    const elements = container.querySelectorAll("input, select, textarea");

    elements.forEach((el) => {
      const key = el.id || el.name;
      if (!key) return;

      if (el.type === "checkbox") {
        fields[key] = el.checked;
      } else if (el.type === "number") {
        fields[key] = el.value === "" ? null : Number(el.value);
      } else {
        fields[key] = el.value;
      }
    });

    return fields;
  }

  // Fill fields from a JSON payload
  function fillFormFields(containerSelector, data) {
    const container = document.querySelector(containerSelector);
    if (!container || !data) return;

    const elements = container.querySelectorAll("input, select, textarea");

    elements.forEach((el) => {
      const key = el.id || el.name;
      if (!key || !(key in data)) return;

      const value = data[key];

      if (el.type === "checkbox") {
        el.checked = !!value;
      } else {
        el.value = value === null || value === undefined ? "" : value;
      }
    });
  }

  // ---------- Founder screen ----------
  function initAiwFounderSettingsScreen() {
    // wrapper for founder settings section
    const containerSelector = "#aiw-founder-settings";
    const saveBtn = document.getElementById("aiw-founder-settings-save");
    if (!saveBtn) return; // if IDs don’t exist, do nothing

    // Load existing data
    fetch("/api/aiwealth/settings/founder")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.payload) {
          fillFormFields(containerSelector, data.payload);
        }
      })
      .catch((err) => console.warn("AIW founder settings load error:", err));

    // Save current fields
    saveBtn.onclick = function () {
      const payload = collectFormFields(containerSelector);

      fetch("/api/aiwealth/settings/founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Save failed");
          alert("AIW Founder settings saved");
        })
        .catch((err) => {
          console.error(err);
          alert("Error while saving AIW Founder settings");
        });
    };
  }

  // ---------- User screen ----------
  function initAiwUserSettingsScreen() {
    const containerSelector = "#aiw-user-settings";
    const saveBtn = document.getElementById("aiw-user-settings-save");
    const customerIdEl = document.getElementById("aiw-user-customer-id");
    if (!saveBtn || !customerIdEl) return;

    function loadUserSettings() {
      const customerId = customerIdEl.value;
      if (!customerId) return;

      fetch(`/api/aiwealth/settings/user/${encodeURIComponent(customerId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.payload) {
            fillFormFields(containerSelector, data.payload);
          }
        })
        .catch((err) => console.warn("AIW user settings load error:", err));
    }

    customerIdEl.addEventListener("change", loadUserSettings);
    loadUserSettings();

    saveBtn.onclick = function () {
      const customerId = customerIdEl.value;
      if (!customerId) {
        alert("Customer ID is required");
        return;
      }

      const payload = collectFormFields(containerSelector);

      fetch("/api/aiwealth/settings/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, payload }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Save failed");
          alert("AIW User settings saved");
        })
        .catch((err) => {
          console.error(err);
          alert("Error while saving AIW User settings");
        });
    };
  }

  // ---------- Broker screen ----------
  function initAiwBrokerSettingsScreen() {
    const containerSelector = "#aiw-broker-settings";
    const saveBtn = document.getElementById("aiw-broker-settings-save");
    const brokerCodeEl = document.getElementById("aiw-broker-code");
    const envEl = document.getElementById("aiw-broker-env");
    if (!saveBtn || !brokerCodeEl || !envEl) return;

    function loadBrokerSettings() {
      const brokerCode = brokerCodeEl.value;
      const env = envEl.value;
      if (!brokerCode || !env) return;

      fetch(
        `/api/aiwealth/settings/broker/${encodeURIComponent(
          brokerCode
        )}/${encodeURIComponent(env)}`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.payload) {
            fillFormFields(containerSelector, data.payload);
          }
        })
        .catch((err) => console.warn("AIW broker settings load error:", err));
    }

    brokerCodeEl.addEventListener("change", loadBrokerSettings);
    envEl.addEventListener("change", loadBrokerSettings);
    loadBrokerSettings();

    saveBtn.onclick = function () {
      const brokerCode = brokerCodeEl.value;
      const env = envEl.value;
      if (!brokerCode || !env) {
        alert("Broker + Env are required");
        return;
      }

      const payload = collectFormFields(containerSelector);

      fetch("/api/aiwealth/settings/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker_code: brokerCode, env, payload }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Save failed");
          alert("AIW Broker settings saved");
        })
        .catch((err) => {
          console.error(err);
          alert("Error while saving AIW Broker settings");
        });
    };
  }

  // ---------- Hook into existing loader ----------
  const originalLoader = window.loadAiWealthSettingsModule || function () {};

  window.loadAiWealthSettingsModule = function (screenKey) {
    // call any existing logic first (do not break frozen UI)
    originalLoader(screenKey);

    if (screenKey === "founder") {
      initAiwFounderSettingsScreen();
    } else if (screenKey === "user") {
      initAiwUserSettingsScreen();
    } else if (screenKey === "broker") {
      initAiwBrokerSettingsScreen();
    }
  };
})();


