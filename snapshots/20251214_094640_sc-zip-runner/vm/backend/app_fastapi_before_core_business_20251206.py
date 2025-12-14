# app_fastapi.py
# FounderConsole backend – Root UI + APIs v2
#
# v1 frozen in: app_fastapi_frozen_v1.py
# This file adds:
# - Rich /api/aiwealth/validation/table for Control Run & Approvals
# - Data & Universe router (aiw_data_universe_v1) for AIW tables

from pathlib import Path
import json
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response

from aiw_data_universe_v1 import router as aiw_data_universe_router

# -----------------------------------------------------------------------------
# FastAPI app + CORS
# -----------------------------------------------------------------------------

app = FastAPI(title="FounderConsole Backend – Root UI + APIs v2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------

BASE_PATH = Path("/opt/founderconsole")
RUNTIME_PATH = BASE_PATH / "runtime"
ROOT_UI_PATH = BASE_PATH / "root-ui" / "index.html"

# Backend-local path (inside the container)
BACKEND_PATH = Path(__file__).resolve().parent
AIW_CORE_JS_PATH = BACKEND_PATH / "static" / "aiw-core-business-v1.js"


# -----------------------------------------------------------------------------
# Root UI
# -----------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def root_ui() -> HTMLResponse:
    """
    Serve the FounderConsole Root UI (SAP-style tree) from:
        /opt/founderconsole/root-ui/index.html
    """
    if not ROOT_UI_PATH.exists():
        return HTMLResponse(
            "<h1>FounderConsole Root UI</h1>"
            "<p>index.html not found at /opt/founderconsole/root-ui/index.html.</p>",
            status_code=500,
        )

    try:
        html = ROOT_UI_PATH.read_text(encoding="utf-8")
        return HTMLResponse(html)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=500,
            detail=f"error reading Root UI HTML: {exc}",
        )
# -------------------------------------------------------------------------
# Core business JS – served as API asset
# -------------------------------------------------------------------------

@app.get("/api/aiwealth/core-business-v1.js")
def aiw_core_business_js() -> Response:
    """
    Serve the AI Wealth core business brain JS so the Root UI can load it
    as a separate function module.
    """
    if not AIW_CORE_JS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=f"AIW core JS not found at {AIW_CORE_JS_PATH}",
        )

    try:
        text = AIW_CORE_JS_PATH.read_text(encoding="utf-8")
        return Response(content=text, media_type="application/javascript")
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=500,
            detail=f"error reading AIW core JS: {exc}",
        )


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------

@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "component": "founderconsole-backend-rootui-v2",
    }


# -----------------------------------------------------------------------------
# Helper – load JSON from runtime folder
# -----------------------------------------------------------------------------

def _load_runtime_json(filename: str) -> Dict[str, Any]:
    """
    Read a JSON file from /opt/founderconsole/runtime and return it as dict.
    """
    path = RUNTIME_PATH / filename
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"{filename} not found in runtime",
        )

    try:
        text = path.read_text(encoding="utf-8")
        return json.loads(text)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=500,
            detail=f"error reading {filename}: {exc}",
        )


# -----------------------------------------------------------------------------
# Existing simple JSON APIs
# -----------------------------------------------------------------------------

@app.get("/api/readiness/readiness")
def readiness() -> Dict[str, Any]:
    """
    Returns go-live readiness JSON written by:
      /opt/founderconsole/tests/generate_readiness.py
    """
    return _load_runtime_json("go_live_readiness.json")


@app.get("/api/aiwealth/validation")
def aiwealth_validation() -> Dict[str, Any]:
    """
    Returns AI Wealth validation JSON written by:
      /opt/founderconsole/scripts/run_aiw_validation.sh
    """
    return _load_runtime_json("aiw_validation_report.json")


@app.get("/api/security/report")
def security_report() -> Dict[str, Any]:
    """
    Returns security_report.json written by:
      /opt/founderconsole/checks/verify_security.py
    """
    return _load_runtime_json("security_report.json")


# -----------------------------------------------------------------------------
# Rich table API for AI Wealth Control Run & Approvals
# -----------------------------------------------------------------------------

@app.get("/api/aiwealth/validation/table")
def aiwealth_validation_table() -> Dict[str, Any]:
    """
    Flatten aiw_validation_report.json into a rich table for the
    'Control Run & Approvals' UI.

    Behaviour:
    - Reads runtime/aiw_validation_report.json
    - Uses 'proposed_trades' (or 'creamy_layer') as the source list
    - Computes expected_return_pct and risk_reward_ratio if missing
    - Filters to show_for_manual_approval == True
    - Sorts by expected_return_pct (desc) then risk bucket
    - Returns { meta, rows, row_count, source_key }
    """

    data = _load_runtime_json("aiw_validation_report.json")

    summary: Dict[str, Any] = data.get("summary", {}) or {}
    trades: List[Dict[str, Any]] = (
        data.get("proposed_trades")
        or data.get("creamy_layer")
        or []
    )

    def _to_float(val: Any) -> float | None:
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    rows: List[Dict[str, Any]] = []

    for t in trades:
        entry = _to_float(t.get("entry_price"))
        target = _to_float(t.get("target_price"))
        sl = _to_float(t.get("stop_loss"))

        # Expected % return
        expected = t.get("expected_return_pct")
        if expected is None and entry and target:
            expected = (target - entry) / entry * 100.0

        # Risk : Reward ratio
        rr = t.get("risk_reward_ratio")
        if rr is None and entry and target and sl is not None and sl != entry:
            upside = target - entry
            downside = entry - sl if sl is not None else None
            if downside and downside != 0:
                rr = upside / downside

        row: Dict[str, Any] = {
            # identity / basic fields
            "symbol": t.get("symbol") or t.get("tradingsymbol"),
            "segment": t.get("segment"),
            "exchange": t.get("exchange"),
            "profile": t.get("profile") or t.get("profile_id"),
            "direction": t.get("direction"),
            "quantity": t.get("quantity"),
            "entry_price": entry,
            "target_price": target,
            "stop_loss": sl,
            "confidence": t.get("confidence"),

            # richer metrics
            "expected_return_pct": expected,
            "risk_bucket": t.get("risk_bucket"),
            "risk_reward_ratio": rr,

            # approvals / routing
            "ai_recommendation": t.get("ai_recommendation") or t.get("recommendation"),
            "show_for_manual_approval": bool(
                t.get("show_for_manual_approval", True)
            ),
            "broker": t.get("broker"),

            # explanation text
            "ai_reason": t.get("ai_reason") or t.get("notes"),
        }
        rows.append(row)

    # Only manual approvals by default
    rows = [r for r in rows if r.get("show_for_manual_approval", True)]

    # Sort by expected_return_pct (desc) and risk bucket
    risk_order = {
        "ULTRA_AGGRESSIVE": 4,
        "AGGRESSIVE": 3,
        "BALANCED": 2,
        "CONSERVATIVE": 1,
    }

    def sort_key(r: Dict[str, Any]):
        exp = r.get("expected_return_pct")
        exp_val: float
        try:
            exp_val = float(exp)
        except (TypeError, ValueError):
            exp_val = -1e9

        bucket_score = risk_order.get(r.get("risk_bucket") or "", 0)
        symbol = r.get("symbol") or ""
        # higher expected %, then higher bucket_score, then symbol asc
        return (-exp_val, -bucket_score, symbol)

    rows = sorted(rows, key=sort_key)

    meta: Dict[str, Any] = {
        "run_date": summary.get("run_date"),
        "env": summary.get("env"),
        "total_universe": summary.get("total_universe"),
        "total_candidates": summary.get("total_candidates"),
        "creamy_layer_count": summary.get("creamy_layer_count"),
        "profiles": summary.get("profiles"),
        "profile_broker_map": summary.get("profile_broker_map"),
        "manual_row_count": len(rows),
    }

    return {
        "meta": meta,
        "rows": rows,
        "row_count": len(rows),
        "source_key": "proposed_trades",
    }


# -----------------------------------------------------------------------------
# Data & Universe router (AI Wealth)
# -----------------------------------------------------------------------------

# Exposes:
#   /api/aiwealth/data-universe/tables
#   /api/aiwealth/data-universe/table/{table_key}
app.include_router(aiw_data_universe_router)

