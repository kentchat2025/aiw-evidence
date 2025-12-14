# aiw_data_universe_v1.py
# AI Wealth - Data & Universe "function module" v1
# DO NOT DELETE OR OVERWRITE: create new _v2 for future changes.

import sqlite3
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

DB_PATH = "/opt/ai-wealth/db/aiw.db"

router = APIRouter(prefix="/api/aiwealth/data-universe", tags=["aiwealth-data-universe-v1"])

# ----- Wiring metadata: categories and tables -----

CATEGORIES: Dict[str, Dict[str, Any]] = {
    "customization": {
        "label": "Customization / Configuration",
        "tables": [
            {
                "key": "AIW_C_ENVIRONMENT",
                "name": "Environment Config",
                "description": "Defines environments (SIM, PROD) and whether real orders are allowed."
            },
            {
                "key": "AIW_C_PROFILE",
                "name": "Profiles",
                "description": "Risk profiles per environment."
            },
            {
                "key": "AIW_C_RISK_CATEGORY",
                "name": "Risk Categories",
                "description": "Master list of risk categories (LOW/MEDIUM/HIGH)."
            },
            {
                "key": "AIW_C_STRATEGY",
                "name": "Strategies",
                "description": "High-level AI Wealth strategies (EQUITY, MF, INDEX, MIXED)."
            },
            {
                "key": "AIW_C_STRATEGY_PARAM",
                "name": "Strategy Parameters",
                "description": "Key/value parameters per strategy and environment."
            },
            {
                "key": "AIW_C_STRATEGY_PROFILE",
                "name": "Strategy–Profile Mapping",
                "description": "Which strategies are enabled for which profiles and environments."
            },
            {
                "key": "AIW_C_STRATEGY_SCOPE",
                "name": "Strategy Scope",
                "description": "Instrument types, market cap buckets, and sectors allowed per strategy."
            },
            {
                "key": "AIW_C_CREAMY_LAYER",
                "name": "Creamy Layer Size",
                "description": "Min/default/max creamy layer sizes per environment and profile."
            },
            {
                "key": "AIW_C_PROFILE_APPROVAL_RULES",
                "name": "Profile Approval Rules",
                "description": "Auto-approval limits and thresholds per profile and environment."
            },
            {
                "key": "AIW_C_BROKER",
                "name": "Broker Config",
                "description": "Broker capabilities and connection metadata per environment."
            },
            {
                "key": "AIW_C_BROKER_ROUTING",
                "name": "Broker Routing",
                "description": "Routing rules to select brokers based on profile, risk and instrument type."
            },
            {
                "key": "AIW_C_USER_PROFILE_MAP",
                "name": "User Profile Map",
                "description": "Mapping of FounderConsole users to AI Wealth profiles and roles.",
            },
            {
                "key": "AIW_C_HOLIDAY_CALENDAR",
                "name": "Holiday Calendar",
                "description": "Trading/holiday flags per exchange and date."
            },
            {
                "key": "AIW_C_SCHEDULER",
                "name": "Scheduler Windows",
                "description": "Allowed run windows and retry rules per environment and tenant."
            },
            {
                "key": "AIW_C_TENANT",
                "name": "Tenant Master",
                "description": "AI Wealth customer/tenant definitions, status and license linkage."
            },
            {
                "key": "AIW_C_TENANT_PROFILE_ENV",
                "name": "Tenant Profile–Env Mapping",
                "description": "Which profiles and environments each tenant is allowed to use."
            },
        ],
    },
    "master": {
        "label": "Master Data",
        "tables": [
            {
                "key": "AIW_M_INSTRUMENT",
                "name": "Instrument Master",
                "description": "Master list of tradable instruments with exchange, type and industry code."
            },
        ],
    },
    "transaction": {
        "label": "Transaction & Market Data",
        "tables": [
            {
                "key": "aiw_universe_broker_prices",
                "name": "Universe – Broker Prices",
                "description": "Universe snapshot per symbol, exchange, broker and run_date with LTP.",
            },
            {
                "key": "aiw_broker_prices_live",
                "name": "Live Broker Prices",
                "description": "Live price cache per symbol, exchange and broker.",
            },
            {
                "key": "AIW_T_SIGNAL",
                "name": "Signals",
                "description": "Signals per environment, run_date, profile and instrument.",
            },
            {
                "key": "AIW_A_CREAMY_LAYER",
                "name": "Creamy Layer",
                "description": "Final shortlisted instruments per run, profile and environment.",
            },
            {
                "key": "AIW_T_APPROVAL",
                "name": "Approvals (Current)",
                "description": "Current approval state for each proposed trade.",
            },
            {
                "key": "AIW_T_RUN",
                "name": "Run Summary",
                "description": "Per-run summary counts and status per environment, profile and tenant.",
            },
            {
                "key": "AIW_T_EXECUTION",
                "name": "Executions",
                "description": "Executed broker orders with quantities, prices and status.",
            },
            {
                "key": "AIW_T_EXECUTION_DIFF",
                "name": "Execution vs Proposal",
                "description": "Slippage and delay between proposed and executed trades.",
            },
        ],
    },
    "history": {
        "label": "History & Analytics",
        "tables": [
            {
                "key": "AIW_H_PRICE_EOD",
                "name": "EOD Price History",
                "description": "Daily OHLCV price history per instrument.",
            },
            {
                "key": "AIW_A_APPROVAL_HISTORY",
                "name": "Approval History",
                "description": "State change history for approvals.",
            },
            {
                "key": "AIW_T_VALIDATION_SNAPSHOT",
                "name": "Validation Snapshots",
                "description": "Stored validation reports per run (aiw_validation_report.json equivalent).",
            },
            {
                "key": "AIW_T_USAGE_METRICS",
                "name": "Usage Metrics",
                "description": "Daily per-tenant usage counts for billing and monitoring.",
            },
            {
                "key": "AIW_A_AUDIT_LOG",
                "name": "Audit Log",
                "description": "System audit trail of key actions and changes.",
            },
        ],
    },
}

# Flatten lookup: key -> (category_id, table_meta)
TABLE_INDEX: Dict[str, Dict[str, Any]] = {}
for cat_id, cat in CATEGORIES.items():
    for t in cat["tables"]:
        TABLE_INDEX[t["key"]] = {
            "category_id": cat_id,
            "meta": t,
        }


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@router.get("/tables")
def list_tables() -> Dict[str, Any]:
    """
    Returns the Data & Universe table structure:
    categories (Customization, Master, Transaction, History) and their tables.
    """
    return {
        "version": "v1",
        "categories": [
            {
                "id": cat_id,
                "label": cat_def["label"],
                "tables": cat_def["tables"],
            }
            for cat_id, cat_def in CATEGORIES.items()
        ],
    }


@router.get("/table/{table_key}")
def get_table_rows(
    table_key: str,
    env_code: Optional[str] = Query(None),
    run_date: Optional[str] = Query(None),
    profile_id: Optional[str] = Query(None),
    tenant_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    """
    Generic reader for any wired table.
    Applies filters only if the corresponding columns exist.
    """
    if table_key not in TABLE_INDEX:
        raise HTTPException(status_code=404, detail=f"Unknown table key: {table_key}")

    table_name = table_key  # same as DB table
    filters: List[str] = []
    params: List[Any] = []

    # discover columns for this table (so we don't guess)
    with get_connection() as conn:
        cur = conn.execute(f"PRAGMA table_info('{table_name}');")
        cols = [row["name"] for row in cur.fetchall()]

    def maybe_add_filter(column: str, value: Optional[str]) -> None:
        if value is not None and column in cols:
            filters.append(f"{column} = ?")
            params.append(value)

    maybe_add_filter("ENV_CODE", env_code)
    maybe_add_filter("RUN_DATE", run_date)
    maybe_add_filter("PROFILE_ID", profile_id)
    maybe_add_filter("TENANT_ID", tenant_id)
    # lowercase variants for some market tables
    maybe_add_filter("env_code", env_code)
    maybe_add_filter("run_date", run_date)
    maybe_add_filter("profile_id", profile_id)
    maybe_add_filter("tenant_id", tenant_id)

    where_clause = ""
    if filters:
        where_clause = " WHERE " + " AND ".join(filters)

    sql = f"SELECT * FROM {table_name}{where_clause} LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with get_connection() as conn:
        cur = conn.execute(sql, params)
        rows = [dict(row) for row in cur.fetchall()]

    return {
        "version": "v1",
        "table": table_key,
        "category": TABLE_INDEX[table_key]["category_id"],
        "description": TABLE_INDEX[table_key]["meta"]["description"],
        "row_count": len(rows),
        "rows": rows,
    }

