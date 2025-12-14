# AI Wealth Brain – Run Log API v1
# Read-only API for AIW_BRAIN_RUN_LOG.
#
# TECH_IDs related (from FC_TECH_LOG):
#   - AIW-BRAIN-PROFILE-* (via summary)
#   - AIW-BRAIN-HOLIDAY-V1
#   - AIW-BRAIN-NEWS-V1
#   - AIW-BRAIN-POLICY-GUARDIAN-V1
#   - AIW-BRAIN-TECHNO-V1
#
# DB tables used:
#   - AIW_BRAIN_RUN_LOG (primary)
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


@router.get("/api/aiwealth/brain/runlog", response_model=List[Dict[str, Any]])
def get_brain_runlog(
    run_date: Optional[str] = Query(
        None,
        description="Run date in YYYY-MM-DD. If omitted, returns latest available runs.",
    ),
    env: str = Query(
        "SIM",
        description="Environment: SIM (default) or PROD (future).",
    ),
    profile_id: Optional[str] = Query(
        None,
        description="Optional profile filter (CONSERVATIVE / BALANCED / AGGRESSIVE / ULTRA / ALL).",
    ),
    instrument: Optional[str] = Query(
        None,
        description="Optional instrument filter (EQ / FO / ETF / MF / ALL).",
    ),
) -> List[Dict[str, Any]]:
    """
    Return rows from AIW_BRAIN_RUN_LOG with optional filters.

    If run_date is not provided, we pick the latest RUN_DATE available for the given ENV.
    """

    try:
        conn = open_connection()
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"DB connection error: {exc}") from exc

    try:
        cur = conn.cursor()

        effective_run_date = run_date
        if effective_run_date is None:
            cur.execute(
                """
                SELECT MAX(RUN_DATE) AS latest_run_date
                FROM AIW_BRAIN_RUN_LOG
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
                SYMBOLS_CONSIDERED,
                SYMBOLS_APPROVED,
                SYMBOLS_BLOCKED,
                HOLIDAY_FLAGS_COUNT,
                NEWS_FLAGS_COUNT,
                POLICY_BLOCK_COUNT,
                CREATED_AT
            FROM AIW_BRAIN_RUN_LOG
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

        sql += """
            ORDER BY
                PROFILE_ID ASC,
                INSTRUMENT ASC
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
                    "symbols_considered": r["SYMBOLS_CONSIDERED"],
                    "symbols_approved": r["SYMBOLS_APPROVED"],
                    "symbols_blocked": r["SYMBOLS_BLOCKED"],
                    "holiday_flags_count": r["HOLIDAY_FLAGS_COUNT"],
                    "news_flags_count": r["NEWS_FLAGS_COUNT"],
                    "policy_block_count": r["POLICY_BLOCK_COUNT"],
                    "created_at": r["CREATED_AT"],
                }
            )

        return result

    finally:
        try:
            conn.close()
        except Exception:
            pass

