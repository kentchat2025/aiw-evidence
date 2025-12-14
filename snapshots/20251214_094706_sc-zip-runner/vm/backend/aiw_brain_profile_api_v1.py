# aiw_brain_profile_api_v1.py
#
# AI Wealth Brain – Profile Mesh API v1
# Read-only API for AIW_BRAIN_PROFILE_STATE.
#
# TECH_IDs related (from FC_TECH_LOG):
#   - AIW-BRAIN-PROFILE-CONSERVATIVE-V1
#   - AIW-BRAIN-PROFILE-BALANCED-V1
#   - AIW-BRAIN-PROFILE-AGGRESSIVE-V1
#   - AIW-BRAIN-PROFILE-ULTRA-V1
#   - AIW-BRAIN-HOLIDAY-V1
#   - AIW-BRAIN-NEWS-V1
#   - AIW-BRAIN-POLICY-GUARDIAN-V1
#
# DB tables used:
#   - AIW_BRAIN_PROFILE_STATE (primary)
#
# This API is SIM-safe: it only reads from aiw.db and returns JSON.

from typing import Any, Dict, List, Optional

import os
import sqlite3

from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


def get_aiw_db_path() -> str:
    """
    Resolve AI Wealth DB path from environment or use default.
    """
    return os.environ.get("AIW_DB_PATH", "/opt/ai-wealth/db/aiw.db")


def open_connection() -> sqlite3.Connection:
    """
    Open a read-only connection to aiw.db when possible.
    Falls back to normal mode if URI read-only fails.
    """
    db_path = get_aiw_db_path()

    uri = f"file:{db_path}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.OperationalError:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn


@router.get("/api/aiwealth/brain/profile", response_model=List[Dict[str, Any]])
def get_brain_profile_state(
    run_date: Optional[str] = Query(
        None,
        description="Run date in YYYY-MM-DD. If omitted, returns latest available rows.",
    ),
    env: str = Query(
        "SIM",
        description="Environment: SIM (default) or PROD (future).",
    ),
    profile_id: Optional[str] = Query(
        None,
        description="Profile filter: CONSERVATIVE / BALANCED / AGGRESSIVE / ULTRA.",
    ),
    instrument: Optional[str] = Query(
        None,
        description="Instrument filter: EQ / FO / ETF / MF. If omitted, returns all instruments.",
    ),
    symbol: Optional[str] = Query(
        None,
        description="Optional symbol filter.",
    ),
    exchange: Optional[str] = Query(
        None,
        description="Optional exchange filter (e.g., NSE, BSE).",
    ),
    min_expected_pct: Optional[float] = Query(
        None,
        description="Optional minimum EXPECTED_RETURN_PCT filter.",
    ),
    min_confidence_pct: Optional[float] = Query(
        None,
        description="Optional minimum CONFIDENCE_PCT filter.",
    ),
    status: Optional[str] = Query(
        None,
        description="Optional FINAL_STATUS filter (e.g., APPROVED_FOR_SIM / BLOCKED / WARN_ONLY).",
    ),
) -> List[Dict[str, Any]]:
    """
    Return rows from AIW_BRAIN_PROFILE_STATE with optional filters.

    If run_date is not provided, we pick the latest RUN_DATE available for the given ENV.
    """

    try:
        conn = open_connection()
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"DB connection error: {exc}") from exc

    try:
        cur = conn.cursor()

        # Resolve RUN_DATE if not provided.
        effective_run_date = run_date
        if effective_run_date is None:
            cur.execute(
                """
                SELECT MAX(RUN_DATE) AS latest_run_date
                FROM AIW_BRAIN_PROFILE_STATE
                WHERE ENV = ?
                """,
                (env,),
            )
            row = cur.fetchone()
            if row is None or row["latest_run_date"] is None:
                # No data yet for this ENV.
                return []
            effective_run_date = row["latest_run_date"]

        sql = """
            SELECT
                RUN_DATE,
                ENV,
                PROFILE_ID,
                INSTRUMENT,
                SYMBOL,
                EXCHANGE,
                EXPECTED_RETURN_PCT,
                CONFIDENCE_PCT,
                RISK_BUCKET,
                MAX_QTY_ALLOWED,
                ACTION_DEFAULT,
                HOLIDAY_BLOCK_FLAG,
                NEWS_BLOCK_FLAG,
                POLICY_BLOCK_FLAG,
                FINAL_STATUS,
                REASONS_JSON,
                CREATED_AT,
                UPDATED_AT
            FROM AIW_BRAIN_PROFILE_STATE
            WHERE RUN_DATE = ?
              AND ENV = ?
        """
        params: List[Any] = [effective_run_date, env]

        if profile_id:
            sql += " AND PROFILE_ID = ?"
            params.append(profile_id)

        if instrument:
            sql += " AND INSTRUMENT = ?"
            params.append(instrument)

        if symbol:
            sql += " AND SYMBOL = ?"
            params.append(symbol)

        if exchange:
            sql += " AND EXCHANGE = ?"
            params.append(exchange)

        if min_expected_pct is not None:
            sql += " AND EXPECTED_RETURN_PCT >= ?"
            params.append(min_expected_pct)

        if min_confidence_pct is not None:
            sql += " AND CONFIDENCE_PCT >= ?"
            params.append(min_confidence_pct)

        if status:
            sql += " AND FINAL_STATUS = ?"
            params.append(status)

        # Order: profile, instrument, expected %, symbol.
        sql += """
            ORDER BY
                PROFILE_ID ASC,
                INSTRUMENT ASC,
                EXPECTED_RETURN_PCT DESC,
                CONFIDENCE_PCT DESC,
                SYMBOL ASC
        """

        cur.execute(sql, params)
        rows = cur.fetchall()

        result: List[Dict[str, Any]] = []
        for r in rows:
            result.append(
                {
                    "run_date": r["RUN_DATE"],
                    "env": r["ENV"],
                    "profile_id": r["PROFILE_ID"],
                    "instrument": r["INSTRUMENT"],
                    "symbol": r["SYMBOL"],
                    "exchange": r["EXCHANGE"],
                    "expected_return_pct": r["EXPECTED_RETURN_PCT"],
                    "confidence_pct": r["CONFIDENCE_PCT"],
                    "risk_bucket": r["RISK_BUCKET"],
                    "max_qty_allowed": r["MAX_QTY_ALLOWED"],
                    "action_default": r["ACTION_DEFAULT"],
                    "holiday_block_flag": r["HOLIDAY_BLOCK_FLAG"],
                    "news_block_flag": r["NEWS_BLOCK_FLAG"],
                    "policy_block_flag": r["POLICY_BLOCK_FLAG"],
                    "final_status": r["FINAL_STATUS"],
                    "reasons_json": r["REASONS_JSON"],
                    "created_at": r["CREATED_AT"],
                    "updated_at": r["UPDATED_AT"],
                }
            )

        return result

    finally:
        try:
            conn.close()
        except Exception:
            pass

