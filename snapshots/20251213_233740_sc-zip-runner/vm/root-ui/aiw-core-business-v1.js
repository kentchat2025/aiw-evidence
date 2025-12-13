// aiw-core-business-v1.js
// Phase-1 core business brain for AI Wealth (Data & Universe + Approvals + Readiness)
//
// This module is designed to be PURE and DETERMINISTIC.
// It does not call network or mutate global state.
// It takes backend table JSON + settings JSON and returns:
//
//   {
//     rows: [...enrichedRows],
//     meta: {...},
//     summary: {...},
//     warnings: [...],
//     errors: [...]
//   }
//
// It is safe to run both in browser (Root UI) and in tests.

(function (global) {
  "use strict";

  const BRAIN_VERSION = "aiw-core-business-v1.0.0";
  const POLICY_VERSION = "risk-policy-2025-12-04";

  // ---------- Small helpers ----------

  function safeNumber(val) {
    if (val === null || val === undefined) return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }

  function safeString(val) {
    if (val === null || val === undefined) return "";
    return String(val);
  }

  function parseRiskBucketFromReason(aiReasonRaw) {
    const txt = safeString(aiReasonRaw);
    const m = txt.match(/Risk bucket:\s*([A-Z_]+)/i);
    if (!m) return "UNKNOWN";
    return m[1].toUpperCase();
  }

  function parseExpectedPctFromReason(aiReasonRaw) {
    const txt = safeString(aiReasonRaw);
    // Example: "Expected return ≈ 5.00% with confidence 0.60"
    const m = txt.match(/Expected return\s*[≈~=]\s*([0-9.]+)\s*%/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeConfidence(confidenceRaw) {
    const n = safeNumber(confidenceRaw);
    if (n === null) return null;
    // If backend gives 0–1, convert to %; if already looks like %, keep as-is.
    if (n <= 1) return n * 100;
    return n;
  }

  function clampPct(val) {
    const n = safeNumber(val);
    if (n === null) return null;
    if (n < -1000) return -1000;
    if (n > 1000) return 1000;
    return n;
  }

  function computeExpectedPct(entry, target, aiReasonRaw) {
    // Prefer explicit value from ai_reason text if available
    const fromReason = parseExpectedPctFromReason(aiReasonRaw);
    if (fromReason !== null) return clampPct(fromReason);

    const e = safeNumber(entry);
    const t = safeNumber(target);
    if (e === null || t === null || e === 0) return null;

    const pct = ((t - e) / e) * 100.0;
    return clampPct(pct);
  }

  function computeDownsidePct(entry, stoploss) {
    const e = safeNumber(entry);
    const s = safeNumber(stoploss);
    if (e === null || s === null || e === 0) return null;
    const pct = ((e - s) / e) * 100.0;
    return clampPct(pct);
  }

  function computeRRRatio(expectedPct, downsidePct) {
    const up = safeNumber(expectedPct);
    const down = safeNumber(downsidePct);
    if (up === null || down === null || down <= 0) return null;
    return up / down;
  }

  function computeCapitalRequired(entry, qty) {
    const e = safeNumber(entry);
    const q = safeNumber(qty);
    if (e === null || q === null) return null;
    return e * q;
  }

  function computeCapitalAtRisk(entry, stoploss, qty) {
    const e = safeNumber(entry);
    const s = safeNumber(stoploss);
    const q = safeNumber(qty);
    if (e === null || s === null || q === null) return null;
    const diff = e - s;
    if (!Number.isFinite(diff)) return null;
    return diff * q;
  }

  // Safety-class logic: very conservative for Phase-1
  function deriveSafetyClass(row, settings) {
    // Base heuristics using expected %, downside %, risk bucket
    const expected = safeNumber(row.expected_return_pct);
    const downside = safeNumber(row.downside_pct);
    const riskBucket = safeString(row.risk_bucket).toUpperCase();

    if (expected === null || downside === null || downside <= 0) {
      return "BLOCK";
    }

    // If expected <= 0, never treat as investable
    if (expected <= 0) {
      return "BLOCK";
    }

    // Very naive first version:
    // - CONSERVATIVE + decent rr_ratio => SAFE
    // - BALANCED + decent rr_ratio => SAFE or WATCH
    // - AGGRESSIVE/ULTRA if rr_ratio ok => WATCH, otherwise BLOCK
    const rr = safeNumber(row.rr_ratio) || 0;

    if (riskBucket === "CONSERVATIVE") {
      if (rr >= 1.2 && downside <= 5) return "SAFE";
      return "WATCH";
    }

    if (riskBucket === "BALANCED") {
      if (rr >= 1.5 && downside <= 8) return "SAFE";
      if (rr >= 1.0) return "WATCH";
      return "BLOCK";
    }

    if (riskBucket === "AGGRESSIVE" || riskBucket === "ULTRA_AGGRESSIVE") {
      if (rr >= 2.0 && downside <= 12) return "WATCH";
      return "BLOCK";
    }

    // Unknown bucket → be cautious
    if (rr >= 1.5 && downside <= 8) return "WATCH";
    return "BLOCK";
  }

  function deriveRiskBucketColor(riskBucket) {
    const b = safeString(riskBucket).toUpperCase();
    if (b === "CONSERVATIVE") return "GREEN";
    if (b === "BALANCED") return "BLUE";
    if (b === "AGGRESSIVE") return "ORANGE";
    if (b === "ULTRA_AGGRESSIVE") return "RED";
    return "GREY";
  }

  function deriveAISuggestion(row, settings) {
    // Phase-1: very simple:
    // - BLOCK → REJECT
    // - If not blocked and show_for_manual_approval → KEEP original recommendation (if present) else HOLD
    // - For auto-approval checks & per-trade checks we add later.
    const safetyClass = safeString(row.safety_class).toUpperCase();
    if (safetyClass === "BLOCK") return "REJECT";

    const raw = safeString(row.ai_recommendation_raw).toUpperCase();
    if (raw === "BUY" || raw === "SELL" || raw === "EXIT") {
      return raw;
    }

    return "HOLD";
  }

  function buildShortReason(row) {
    // Compact human-readable summary for the row
    const symbol = safeString(row.symbol);
    const dir = safeString(row.direction).toUpperCase() || "BUY";
    const exp = safeNumber(row.expected_return_pct);
    const rr = safeNumber(row.rr_ratio);
    const riskBucket = safeString(row.risk_bucket);
    const safetyClass = safeString(row.safety_class);

    const parts = [];

    parts.push(`${symbol}: ${dir}`);

    if (exp !== null) {
      parts.push(`Exp ≈ ${exp.toFixed(2)}%`);
    }

    if (rr !== null) {
      parts.push(`R:R ≈ ${rr.toFixed(2)}`);
    }

    if (riskBucket) {
      parts.push(`Bucket: ${riskBucket}`);
    }

    if (safetyClass) {
      parts.push(`Safety: ${safetyClass}`);
    }

    return parts.join(" | ");
  }

  // ---------- Core row enrichment ----------

  function enrichRow(baseRow, settings, contextMeta) {
    const row = Object.assign({}, baseRow);

    // Normalize + derive metrics
    row.symbol = safeString(row.symbol);
    row.segment = safeString(row.segment);
    row.exchange = safeString(row.exchange);
    row.profile = safeString(row.profile);
    row.direction = safeString(row.direction || "BUY").toUpperCase();
    row.quantity = safeNumber(row.quantity);

    row.entry_price = safeNumber(row.entry_price);
    row.target_price = safeNumber(row.target_price);
    // normalize stop_loss -> stoploss_price
    row.stoploss_price = safeNumber(
      row.stop_loss !== undefined ? row.stop_loss : row.stoploss_price
    );

    row.ai_recommendation_raw = safeString(row.ai_recommendation);
    row.show_for_manual_approval = !!row.show_for_manual_approval;
    row.ai_reason_raw = safeString(row.ai_reason);
    row.broker = safeString(row.broker);

    // Confidence
    row.confidence_pct = normalizeConfidence(row.confidence);

    // Expected % and downside % and RR
    row.expected_return_pct = computeExpectedPct(
      row.entry_price,
      row.target_price,
      row.ai_reason_raw
    );

    row.downside_pct = computeDownsidePct(
      row.entry_price,
      row.stoploss_price
    );

    row.rr_ratio = computeRRRatio(
      row.expected_return_pct,
      row.downside_pct
    );

    // Risk bucket
    row.risk_bucket = parseRiskBucketFromReason(row.ai_reason_raw);
    row.risk_bucket_color_tag = deriveRiskBucketColor(row.risk_bucket);

    // Capital metrics (per-row)
    row.capital_required = computeCapitalRequired(
      row.entry_price,
      row.quantity
    );

    row.capital_at_risk = computeCapitalAtRisk(
      row.entry_price,
      row.stoploss_price,
      row.quantity
    );

    // Placeholder for future portfolio-level checks
    row.within_per_trade_limit = null;
    row.within_daily_loss_limit = null;

    // Safety class and AI suggestion
    row.safety_class = deriveSafetyClass(row, settings);
    row.ai_suggestion = deriveAISuggestion(row, settings);

    // Short reason
    row.ai_reason_short = buildShortReason(row);

    // Minimal rule trace for Phase-1.
    // Later we expand this into a full policy_id-based trace.
    row.rule_trace = [
      `BUCKET=${row.risk_bucket}`,
      `SAFETY=${row.safety_class}`,
      `RR_RATIO=${row.rr_ratio !== null ? row.rr_ratio.toFixed(2) : "NA"}`,
    ];

    return row;
  }

  // ---------- Summary & modes ----------

  function buildSummary(enrichedRows) {
    const summary = {
      total_universe: null,
      total_candidates: null,
      creamy_layer_count: null,
      manual_approval_count: 0,
      auto_approvable_count: 0, // reserved for future logic
      blocked_by_risk_count: 0,
      safety_class_counts: {
        SAFE: 0,
        WATCH: 0,
        BLOCK: 0,
        UNKNOWN: 0,
      },
      suggestion_counts: {
        APPROVE: 0,
        HOLD: 0,
        REJECT: 0,
        BUY: 0,
        SELL: 0,
        EXIT: 0,
      },
      total_capital_if_all_approved: 0,
      estimated_daily_loss_if_all_SL_hit: null, // placeholder for later
    };

    let capitalSum = 0;
    let atRiskSum = 0;

    for (const row of enrichedRows) {
      const safety = safeString(row.safety_class).toUpperCase() || "UNKNOWN";
      const sugg = safeString(row.ai_suggestion).toUpperCase();

      if (row.show_for_manual_approval) {
        summary.manual_approval_count += 1;
      }

      if (safety === "BLOCK") {
        summary.blocked_by_risk_count += 1;
      }

      if (safety === "SAFE") summary.safety_class_counts.SAFE += 1;
      else if (safety === "WATCH") summary.safety_class_counts.WATCH += 1;
      else if (safety === "BLOCK") summary.safety_class_counts.BLOCK += 1;
      else summary.safety_class_counts.UNKNOWN += 1;

      if (sugg === "APPROVE") summary.suggestion_counts.APPROVE += 1;
      else if (sugg === "HOLD") summary.suggestion_counts.HOLD += 1;
      else if (sugg === "REJECT") summary.suggestion_counts.REJECT += 1;
      else if (sugg === "BUY") summary.suggestion_counts.BUY += 1;
      else if (sugg === "SELL") summary.suggestion_counts.SELL += 1;
      else if (sugg === "EXIT") summary.suggestion_counts.EXIT += 1;

      const cap = safeNumber(row.capital_required);
      if (cap !== null) {
        capitalSum += cap;
      }

      const atRisk = safeNumber(row.capital_at_risk);
      if (atRisk !== null) {
        atRiskSum += atRisk;
      }
    }

    summary.total_capital_if_all_approved = capitalSum;
    summary.estimated_daily_loss_if_all_SL_hit = atRiskSum;

    return summary;
  }

  function deriveModeFromProblems(warnings, errors) {
    if (errors && errors.length > 0) return "DEGRADED";
    if (warnings && warnings.length > 0) return "SAFE_GUARD";
    return "NORMAL";
  }

  // ---------- Main entrypoint ----------

  /**
   * Build the AIW core view.
   *
   * @param {Object} params
   * @param {Object} params.settingsRaw   - JSON from /aiwealth/settings/founder (entire response or just payload)
   * @param {Object} params.tableRaw      - JSON from /aiwealth/validation/table
   * @param {String} [params.viewMode]    - "UNIVERSE" | "CREAMY" | "APPROVALS" | etc. (not heavily used in Phase-1)
   * @returns {Object} { rows, meta, summary, warnings, errors }
   */
  function buildCoreView(params) {
    const warnings = [];
    const errors = [];

    const settingsRaw = params && params.settingsRaw ? params.settingsRaw : {};
    const tableRaw = params && params.tableRaw ? params.tableRaw : {};
    const viewMode = safeString(params && params.viewMode) || "UNIVERSE";

    // settingsRaw might be either the full response {payload, updated_at}
    // or just the payload itself. Normalize to settingsPayload.
    let settingsPayload = settingsRaw;
    if (settingsRaw && settingsRaw.payload) {
      settingsPayload = settingsRaw.payload;
    }

    const rowsInput = Array.isArray(tableRaw.rows) ? tableRaw.rows : [];
    const metaInput = tableRaw.meta || {};

    if (!Array.isArray(tableRaw.rows)) {
      errors.push("TABLE_ROWS_MISSING_OR_INVALID");
    }

    if (!settingsPayload || typeof settingsPayload !== "object") {
      warnings.push("SETTINGS_PAYLOAD_MISSING_OR_INVALID");
    }

    // Enrich rows
    const enrichedRows = rowsInput.map((row) =>
      enrichRow(row, settingsPayload, metaInput)
    );

    // For Phase-1, viewMode only affects which rows the caller chooses to show.
    // We return all rows; tile-level function modules can filter by viewMode.

    const summary = buildSummary(enrichedRows);

    // Try to pass through counts if present in metaInput
    if (metaInput.total_universe !== undefined) {
      summary.total_universe = safeNumber(metaInput.total_universe);
    }
    if (metaInput.total_candidates !== undefined) {
      summary.total_candidates = safeNumber(metaInput.total_candidates);
    }
    if (metaInput.creamy_layer_count !== undefined) {
      summary.creamy_layer_count = safeNumber(metaInput.creamy_layer_count);
    }

    const mode = deriveModeFromProblems(warnings, errors);

    const meta = {
      run_date: safeString(metaInput.run_date),
      env: safeString(metaInput.env),
      profiles: Array.isArray(metaInput.profiles)
        ? metaInput.profiles.slice()
        : [],
      profile_broker_map:
        (metaInput && metaInput.profile_broker_map) || {},
      view_mode: viewMode,

      brain_version: BRAIN_VERSION,
      policy_version: POLICY_VERSION,
      mode,

      // Small snapshot of key settings for UI / debugging
      settings_snapshot: {
        environment_mode: safeString(settingsPayload.environment_mode),
        base_currency: safeString(settingsPayload.base_currency),
        creamy_layer_size: safeNumber(settingsPayload.creamy_layer_size),
        max_daily_loss_pct: safeNumber(settingsPayload.max_daily_loss_pct),
        max_per_trade_capital_pct: safeNumber(
          settingsPayload.max_per_trade_capital_pct
        ),
        auto_approve_threshold_expected_pct: safeNumber(
          settingsPayload.auto_approve_threshold_expected_pct
        ),
        auto_approve_min_confidence: safeNumber(
          settingsPayload.auto_approve_min_confidence
        ),
      },
    };

    return {
      rows: enrichedRows,
      meta,
      summary,
      warnings,
      errors,
    };
  }

  // Expose as a global for Root UI & tests
  const exported = {
    buildCoreView,
  };

  if (typeof global !== "undefined") {
    global.AIWCoreBusinessV1 = exported;
  }

})(typeof window !== "undefined" ? window : globalThis);

