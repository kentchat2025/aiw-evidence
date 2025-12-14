# fc_techlog_registry_v1.py
# Single SAP-style "function module" for:
#  1) Technical Log registry (all artefacts)
#  2) Auto-sync FC_TECH_LOG from registry
#  3) Readiness coverage helpers that link TECH_LOG to FC_READINESS_ITEM

from __future__ import annotations

import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime


def _utc_now_iso() -> str:
    """Return UTC timestamp in ISO format (for LAST_UPDATED_AT)."""
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


# ---------------------------------------------------------------------------
# 1) REGISTRY – Single source of truth for Technical Log entries
# ---------------------------------------------------------------------------

TECHLOG_REGISTRY_V1: List[Dict[str, Any]] = [
    # === FounderConsole / Readiness Routing =================================
    {
        "TECH_ID": "FC-READINESS-ROUTE-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "Readiness & Tech Log Router",
        "OBJECT_PATH": "/app/backend/readiness_route.py",
        "TILE_IDS": "8.1;8.2;13",
        "AIW_TABLES_USED": "",
        "FC_TABLES_USED": "FC_READINESS_ITEM;FC_TECH_LOG",
        "AGENTS_RELATED": "SC-FOUNDERCONSOLE",
        "READINESS_ITEMS": "AIW-CTRL-1..6",
        "VERSION": "v1",
        "STATUS": "ACTIVE",
    },
    {
        "TECH_ID": "FC-ROOT-UI-INDEX-V3",
        "OBJECT_TYPE": "FRONTEND",
        "OBJECT_NAME": "FounderConsole Root UI – index.html v3",
        "OBJECT_PATH": "/opt/founderconsole/root-ui/index.html",
        "TILE_IDS": "1;2;3;4;5;6;7;8;9;10;11;12;13",
        "AIW_TABLES_USED": "",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SC-FOUNDERCONSOLE",
        "READINESS_ITEMS": "AIW-CUT-003",
        "VERSION": "v3",
        "STATUS": "ACTIVE",
    },

    # === AI Wealth – Control Run / Brain / Data =============================
    {
        "TECH_ID": "AIW-CONTROL-RUN-SCRIPT-V1",
        "OBJECT_TYPE": "SCRIPT",
        "OBJECT_NAME": "AI Wealth Control Run Script v1",
        "OBJECT_PATH": "/opt/founderconsole/scripts/run_aiw_control_run_v1.sh",
        "TILE_IDS": "2.1.1;2.1.1.1",
        "AIW_TABLES_USED": "AIW_SIGNAL;AIW_VALIDATION",
        "FC_TABLES_USED": "FC_READINESS_ITEM",
        "AGENTS_RELATED": "SC-AIWEALTH",
        "READINESS_ITEMS": "AIW-CTRL-1..6",
        "VERSION": "v1",
        "STATUS": "ACTIVE",
    },
    {
        "TECH_ID": "AIW-CORE-BUSINESS-API-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Core Business API v1",
        "OBJECT_PATH": "/app/backend/aiw_core_business_v1.py",
        "TILE_IDS": "2.1;2.1.1;12",
        "AIW_TABLES_USED": "AIW_SIGNAL;AIW_UNIVERSE;AIW_VALIDATION",
        "FC_TABLES_USED": "FC_READINESS_ITEM",
        "AGENTS_RELATED": "SC-AIWEALTH",
        "READINESS_ITEMS": "AIW-CORE-001;AIW-CORE-002;AIW-APPROVAL-001",
        "VERSION": "v1",
        "STATUS": "ACTIVE",
    },
    {
        "TECH_ID": "AIW-CORE-BUSINESS-UI-V1",
        "OBJECT_TYPE": "FRONTEND",
        "OBJECT_NAME": "AI Wealth Core Business UI v1",
        "OBJECT_PATH": "/opt/founderconsole/root-ui/aiw-core-business-v1.js",
        "TILE_IDS": "12",
        "AIW_TABLES_USED": "AIW_SIGNAL;AIW_UNIVERSE;AIW_VALIDATION",
        "FC_TABLES_USED": "FC_READINESS_ITEM",
        "AGENTS_RELATED": "SC-FOUNDERCONSOLE",
        "READINESS_ITEMS": "AIW-CORE-002;AIW-APPROVAL-001",
        "VERSION": "v1",
        "STATUS": "ACTIVE",
    },
    {
        "TECH_ID": "AIW-DATA-UNIVERSE-API-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Data & Universe API v1",
        "OBJECT_PATH": "/app/backend/aiw_data_universe_v1.py",
        "TILE_IDS": "2.1.1.3",
        "AIW_TABLES_USED": "AIW_UNIVERSE",
        "FC_TABLES_USED": "FC_READINESS_ITEM",
        "AGENTS_RELATED": "SC-AIWEALTH",
        "READINESS_ITEMS": "AIW-DATA-001;AIW-DATA-002",
        "VERSION": "v1",
        "STATUS": "ACTIVE",
    },
    {
        "TECH_ID": "AIW-VALIDATION-API-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Validation API v1",
        "OBJECT_PATH": "/app/backend/app_fastapi.py",
        "TILE_IDS": "2.1.1.1",
        "AIW_TABLES_USED": "AIW_VALIDATION;AIW_SIGNAL",
        "FC_TABLES_USED": "FC_READINESS_ITEM",
        "AGENTS_RELATED": "SC-AIWEALTH",
        "READINESS_ITEMS": "AIW-CORE-001;AIW-CTRL-1",
        "VERSION": "v1",
        "STATUS": "ACTIVE",
    },
]


# ---------------------------------------------------------------------------
# 2) AUTO-SYNC FC_TECH_LOG FROM REGISTRY
# ---------------------------------------------------------------------------

def sync_techlog_to_db(conn: sqlite3.Connection) -> None:
    """
    Ensure FC_TECH_LOG contents match TECHLOG_REGISTRY_V1 (idempotent).
    - INSERT OR REPLACE based on TECH_ID.
    - Safe to call on every request that uses tech log.
    """
    cur = conn.cursor()
    now = _utc_now_iso()

    for item in TECHLOG_REGISTRY_V1:
        cur.execute(
            """
            INSERT INTO FC_TECH_LOG (
              TECH_ID,
              OBJECT_TYPE,
              OBJECT_NAME,
              OBJECT_PATH,
              DESCRIPTION,
              TILE_IDS,
              AIW_TABLES_USED,
              FC_TABLES_USED,
              AGENTS_RELATED,
              READINESS_ITEMS,
              VERSION,
              STATUS,
              LAST_UPDATED_AT
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(TECH_ID) DO UPDATE SET
              OBJECT_TYPE     = excluded.OBJECT_TYPE,
              OBJECT_NAME     = excluded.OBJECT_NAME,
              OBJECT_PATH     = excluded.OBJECT_PATH,
              DESCRIPTION     = excluded.DESCRIPTION,
              TILE_IDS        = excluded.TILE_IDS,
              AIW_TABLES_USED = excluded.AIW_TABLES_USED,
              FC_TABLES_USED  = excluded.FC_TABLES_USED,
              AGENTS_RELATED  = excluded.AGENTS_RELATED,
              READINESS_ITEMS = excluded.READINESS_ITEMS,
              VERSION         = excluded.VERSION,
              STATUS          = excluded.STATUS,
              LAST_UPDATED_AT = excluded.LAST_UPDATED_AT
            """,
            (
                item["TECH_ID"],
                item["OBJECT_TYPE"],
                item["OBJECT_NAME"],
                item.get("OBJECT_PATH", ""),
                item.get("DESCRIPTION", ""),
                item.get("TILE_IDS", ""),
                item.get("AIW_TABLES_USED", ""),
                item.get("FC_TABLES_USED", ""),
                item.get("AGENTS_RELATED", ""),
                item.get("READINESS_ITEMS", ""),
                item.get("VERSION", "v1"),
                item.get("STATUS", "ACTIVE"),
                now,
            ),
        )

    conn.commit()


# ---------------------------------------------------------------------------
# 3) TECHLOG QUERY HELPER (used by /api/readiness/techlog)
# ---------------------------------------------------------------------------

def fetch_techlog_items(
    conn: sqlite3.Connection,
    object_type: Optional[str] = None,
    status: Optional[str] = None,
    tile_id: Optional[str] = None,
    readiness_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Centralised query logic for FC_TECH_LOG.
    This mirrors the filters we had earlier, but now lives in one place.
    """
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    sql = "SELECT * FROM FC_TECH_LOG WHERE 1=1"
    params: List[Any] = []

    if object_type:
        sql += " AND OBJECT_TYPE = ?"
        params.append(object_type)

    if status:
        sql += " AND STATUS = ?"
        params.append(status)

    if tile_id:
        sql += " AND (TILE_IDS LIKE ? OR TILE_IDS LIKE ? OR TILE_IDS LIKE ? OR TILE_IDS = ?)"
        params.extend(
            [
                tile_id + ";%",
                "%;" + tile_id + ";%",
                "%;" + tile_id,
                tile_id,
            ]
        )

    if readiness_id:
        sql += " AND (READINESS_ITEMS LIKE ? OR READINESS_ITEMS LIKE ? OR READINESS_ITEMS LIKE ? OR READINESS_ITEMS = ?)"
        params.extend(
            [
                readiness_id + ";%",
                "%;" + readiness_id + ";%",
                "%;" + readiness_id,
                readiness_id,
            ]
        )

    sql += " ORDER BY TECH_ID"
    cur.execute(sql, params)
    return [dict(r) for r in cur.fetchall()]


# ---------------------------------------------------------------------------
# 4) READINESS COVERAGE – Attach TECHLOG counts to FC_READINESS_ITEM rows
# ---------------------------------------------------------------------------

def attach_techlog_counts_to_readiness(
    conn: sqlite3.Connection,
    readiness_rows: List[Dict[str, Any]],
) -> None:
    """
    For each FC_READINESS_ITEM row, add:
      - TECHLOG_LINKED_COUNT: number of TECH_LOG entries mapped to that READINESS_ID
    This is used by /api/readiness/items so that Readiness dashboard tiles
    can see which items have technical coverage.
    """
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    for row in readiness_rows:
        rid = row.get("READINESS_ID")
        if not rid:
            row["TECHLOG_LINKED_COUNT"] = 0
            continue

        cur.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM FC_TECH_LOG
            WHERE
              READINESS_ITEMS LIKE ? OR
              READINESS_ITEMS LIKE ? OR
              READINESS_ITEMS LIKE ? OR
              READINESS_ITEMS = ?
            """,
            [
                rid + ";%",
                "%;" + rid + ";%",
                "%;" + rid,
                rid,
            ],
        )
        res = cur.fetchone()
        row["TECHLOG_LINKED_COUNT"] = int(res["cnt"] if res else 0)

