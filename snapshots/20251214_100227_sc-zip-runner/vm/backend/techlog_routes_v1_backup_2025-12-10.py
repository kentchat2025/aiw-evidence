#!/usr/bin/env python3
"""
Techno Log API (Tile 13.1) – v1

This route exposes FC_TECH_LOG as a structured, data-driven JSON
so the FounderConsole UI can show ALL TECH_IDs and statuses
without further code changes.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import sqlite3
import os

router = APIRouter()

# Adjust if your DB path differs
DB_PATH = os.environ.get("AIW_DB_PATH", "/opt/ai-wealth/db/aiw.db")


def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {e}")


@router.get("/api/readiness/techlog", response_model=List[Dict[str, Any]])
def get_tech_log() -> List[Dict[str, Any]]:
    """
    Return ALL rows from FC_TECH_LOG, in a generic, data-driven way.
    No filtering on STATUS: the UI can filter as needed.

    Columns (as of now):
    - TECH_ID
    - OBJECT_TYPE
    - OBJECT_NAME
    - OBJECT_PATH
    - DESCRIPTION
    - TILE_IDS
    - AIW_TABLES_USED
    - FC_TABLES_USED
    - AGENTS_RELATED
    - READINESS_ITEMS
    - VERSION
    - STATUS
    - LAST_UPDATED_AT
    """

    conn = get_db_connection()
    try:
        cur = conn.cursor()
        # Ensure table exists
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='FC_TECH_LOG';"
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(
                status_code=500,
                detail="FC_TECH_LOG table not found in database",
            )

        cur.execute("SELECT * FROM FC_TECH_LOG;")
        rows = cur.fetchall()

        result: List[Dict[str, Any]] = []
        for r in rows:
            item = {k: r[k] for k in r.keys()}
            result.append(item)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading FC_TECH_LOG: {e}")
    finally:
        conn.close()

