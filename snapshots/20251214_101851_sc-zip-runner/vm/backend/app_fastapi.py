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
from app_aiw_core_business_v1 import (
    router as aiw_core_business_router,
    CoreBusinessResponse,
)
from readiness_route import router as readiness_router
from techlog_routes_v1 import router as techlog_router
from aiw_brain_instrument_api_v1 import router as aiw_brain_instrument_router
from aiw_brain_profile_api_v1 import router as aiw_brain_profile_router
from aiw_brain_runlog_api_v1 import router as aiw_brain_runlog_router

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
app.include_router(aiw_core_business_router)
app.include_router(readiness_router)
app.include_router(readiness_router, prefix="/api/readiness", tags=["readiness"])
app.include_router(techlog_router)
app.include_router(aiw_brain_instrument_router)
app.include_router(aiw_brain_profile_router)
app.include_router(aiw_brain_runlog_router)

# -----------------------------------------------------------------------------
# Core Business – AI Wealth (proposed trades table)
# -----------------------------------------------------------------------------


#----------------------------------------------------------------------------
# === FC Readiness & Technical Log (Tree 13, Tiles 8.x, 12, etc.) ===
import os
import sqlite3
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


FC_AIW_DB_PATH = os.environ.get("AIW_DB_PATH", "/opt/ai-wealth/db/aiw.db")


def fc_aiw_get_conn():
    conn = sqlite3.connect(FC_AIW_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _fc_utc_now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


class ReadinessItem(BaseModel):
    readiness_id: str
    project_id: str
    bucket_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    tile_ids: Optional[str] = None
    status: str
    owner: Optional[str] = None


class TechLogEntry(BaseModel):
    tech_id: str
    object_type: str
    object_name: str
    object_path: str
    description: Optional[str] = None
    tile_ids: Optional[str] = None
    aiw_tables_used: Optional[str] = None
    fc_tables_used: Optional[str] = None
    agents_related: Optional[str] = None
    readiness_items: Optional[str] = None
    version: Optional[str] = None
    status: str


@app.get("/api/readiness/items")
def api_readiness_items(
    project_id: Optional[str] = None,
    bucket_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    List readiness items (for tiles 8.1, 8.2, 13.x).
    """
    conn = fc_aiw_get_conn()
    try:
        cur = conn.cursor()
        sql = "SELECT * FROM FC_READINESS_ITEM WHERE 1=1"
        params: List = []
        if project_id:
            sql += " AND PROJECT_ID = ?"
            params.append(project_id)
        if bucket_id:
            sql += " AND BUCKET_ID = ?"
            params.append(bucket_id)
        if status:
            sql += " AND STATUS = ?"
            params.append(status)
        sql += " ORDER BY PROJECT_ID, BUCKET_ID, READINESS_ID"
        cur.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()]
        return {"status": "OK", "items": rows}
    finally:
        conn.close()


@app.post("/api/readiness/items")
def api_readiness_upsert(item: ReadinessItem):
    """
    Create or update a single readiness item.
    This lets us mark items as DONE when Brain / infra tasks are completed.
    """
    conn = fc_aiw_get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO FC_READINESS_ITEM (
              READINESS_ID, PROJECT_ID, BUCKET_ID, TITLE, DESCRIPTION,
              TILE_IDS, STATUS, OWNER, LAST_UPDATED_AT
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(READINESS_ID) DO UPDATE SET
              PROJECT_ID = excluded.PROJECT_ID,
              BUCKET_ID = excluded.BUCKET_ID,
              TITLE = excluded.TITLE,
              DESCRIPTION = excluded.DESCRIPTION,
              TILE_IDS = excluded.TILE_IDS,
              STATUS = excluded.STATUS,
              OWNER = excluded.OWNER,
              LAST_UPDATED_AT = excluded.LAST_UPDATED_AT
            """,
            (
                item.readiness_id,
                item.project_id,
                item.bucket_id,
                item.title,
                item.description,
                item.tile_ids,
                item.status,
                item.owner,
                _fc_utc_now_iso(),
            ),
        )
        conn.commit()
        return {"status": "OK"}
    finally:
        conn.close()


@app.get("/api/techlog")
def api_techlog_list(
    object_type: Optional[str] = None,
    status: Optional[str] = None,
    tile_id: Optional[str] = None,
):
    """
    List technical log entries for Tree 13 / other tiles.
    Filters:
      - object_type: FRONTEND,BACKEND,SCRIPT,DB_TABLE,AGENT,CONFIG
      - status: ACTIVE,DEPRECATED,PLANNED
      - tile_id: find entries whose TILE_IDS contains this tile id
    """
    conn = fc_aiw_get_conn()
    try:
        cur = conn.cursor()
        sql = "SELECT * FROM FC_TECH_LOG WHERE 1=1"
        params: List = []
        if object_type:
            sql += " AND OBJECT_TYPE = ?"
            params.append(object_type)
        if status:
            sql += " AND STATUS = ?"
            params.append(status)
        if tile_id:
            sql += " AND (TILE_IDS LIKE ? OR TILE_IDS LIKE ? OR TILE_IDS LIKE ? OR TILE_IDS = ?)"
            # match start, middle, end, or exact; assuming ';' delimiter
            params.extend(
                [
                    tile_id + ";%",
                    "%;" + tile_id + ";%",
                    "%;" + tile_id,
                    tile_id,
                ]
            )
        sql += " ORDER BY TECH_ID"
        cur.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()]
        return {"status": "OK", "items": rows}
    finally:
        conn.close()


@app.post("/api/techlog")
def api_techlog_upsert(entry: TechLogEntry):
    """
    Create or update a Technical Log entry.
    This will be used by Supercoder & manual workflows to ensure every artefact
    is mapped to tiles, tables, agents and readiness items.
    """
    conn = fc_aiw_get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO FC_TECH_LOG (
              TECH_ID, OBJECT_TYPE, OBJECT_NAME, OBJECT_PATH, DESCRIPTION,
              TILE_IDS, AIW_TABLES_USED, FC_TABLES_USED,
              AGENTS_RELATED, READINESS_ITEMS,
              VERSION, STATUS, LAST_UPDATED_AT
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(TECH_ID) DO UPDATE SET
              OBJECT_TYPE = excluded.OBJECT_TYPE,
              OBJECT_NAME = excluded.OBJECT_NAME,
              OBJECT_PATH = excluded.OBJECT_PATH,
              DESCRIPTION = excluded.DESCRIPTION,
              TILE_IDS = excluded.TILE_IDS,
              AIW_TABLES_USED = excluded.AIW_TABLES_USED,
              FC_TABLES_USED = excluded.FC_TABLES_USED,
              AGENTS_RELATED = excluded.AGENTS_RELATED,
              READINESS_ITEMS = excluded.READINESS_ITEMS,
              VERSION = excluded.VERSION,
              STATUS = excluded.STATUS,
              LAST_UPDATED_AT = excluded.LAST_UPDATED_AT
            """,
            (
                entry.tech_id,
                entry.object_type,
                entry.object_name,
                entry.object_path,
                entry.description,
                entry.tile_ids,
                entry.aiw_tables_used,
                entry.fc_tables_used,
                entry.agents_related,
                entry.readiness_items,
                entry.version,
                entry.status,
                _fc_utc_now_iso(),
            ),
        )
        conn.commit()
        return {"status": "OK"}
    finally:
        conn.close()

