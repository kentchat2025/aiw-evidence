# aiw_brain_instrument_api_v1.py
#
# AI Wealth Brain – Instrument Mesh API v1
# Read-only API for AIW_BRAIN_INSTRUMENT_STATE.
#
# TECH_IDs related (from FC_TECH_LOG):
#   - AIW-BRAIN-INSTRUMENT-EQ-V1
#   - AIW-BRAIN-INSTRUMENT-FO-V1
#   - AIW-BRAIN-INSTRUMENT-ETF-V1
#   - AIW-BRAIN-INSTRUMENT-MF-V1
#
# DB tables used:
#   - AIW_BRAIN_INSTRUMENT_STATE (primary)
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

    # Try read-only URI mode first (safe for SIM/control-run views).
    uri = f"file:{db_path}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.OperationalError:
        # Fallback to normal connection if read-only URI is not supported.
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn


@router.get("/api/aiwealth/brain/instrument", response_model=List[Dict[str, Any]])
def get_brain_instrument_state(
    run_date: Optional[str] = Query(
        None,
        description="Run date in YYYY-MM-DD. If omitted, returns latest available rows.",
    ),
    env: str = Query(
        "SIM",
        description="Environment: SIM (default) or PROD (future).",
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
) -> List[Dict[str, Any]]:
    """
    Return rows from AIW_BRAIN_INSTRUMENT_STATE with optional filters.

    If run_date is not provided, we pick the latest RUN_DATE available for the given ENV.
    """

    try:
        conn = open_connection()
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"DB connection error: {exc}") from exc

    try:
        cur = conn.cursor()

        # If run_date is not provided, find the latest available for this ENV.
        effective_run_date = run_date
        if effective_run_date is None:
            cur.execute(
                """
                SELECT MAX(RUN_DATE) AS latest_run_date
                FROM AIW_BRAIN_INSTRUMENT_STATE
                WHERE ENV = ?
                """,
                (env,),
            )
            row = cur.fetchone()
            if row is None or row["latest_run_date"] is None:
                # No data yet for this ENV.
                return []
            effective_run_date = row["latest_run_date"]

        # Build the main query.
        sql = """
            SELECT
                RUN_DATE,
                ENV,
                INSTRUMENT,
                SYMBOL,
                EXCHANGE,
                RAW_SIGNAL_ID,
                INSTRUMENT_SCORE,
                ALLOWED_PROFILES,
                PRIMARY_REASON,
                REASONS_JSON,
                CREATED_AT,
                UPDATED_AT
            FROM AIW_BRAIN_INSTRUMENT_STATE
            WHERE RUN_DATE = ?
              AND ENV = ?
        """
        params: List[Any] = [effective_run_date, env]

        if instrument:
            sql += " AND INSTRUMENT = ?"
            params.append(instrument)

        if symbol:
            sql += " AND SYMBOL = ?"
            params.append(symbol)

        if exchange:
            sql += " AND EXCHANGE = ?"
            params.append(exchange)

        # Order by score desc, symbol for stable display.
        sql += " ORDER BY INSTRUMENT_SCORE DESC, SYMBOL ASC"

        cur.execute(sql, params)
        rows = cur.fetchall()

        result: List[Dict[str, Any]] = []
        for r in rows:
            result.append(
                {
                    "run_date": r["RUN_DATE"],
                    "env": r["ENV"],
                    "instrument": r["INSTRUMENT"],
                    "symbol": r["SYMBOL"],
                    "exchange": r["EXCHANGE"],
                    "raw_signal_id": r["RAW_SIGNAL_ID"],
                    "instrument_score": r["INSTRUMENT_SCORE"],
                    "allowed_profiles": r["ALLOWED_PROFILES"],
                    "primary_reason": r["PRIMARY_REASON"],
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

