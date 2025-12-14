from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fc_techlog_registry_v1 import (
    sync_techlog_to_db,
    fetch_techlog_items,
    attach_techlog_counts_to_readiness,
)


router = APIRouter()

READINESS_JSON_PATH = Path("/opt/founderconsole/runtime/go_live_readiness.json")


def _load_raw_readiness() -> Dict[str, Any]:
    """
    Load raw go_live_readiness.json from runtime.
    If missing or invalid, raise HTTPException(500).
    """
    if not READINESS_JSON_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Readiness file not found at {READINESS_JSON_PATH}",
        )

    try:
        with READINESS_JSON_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse readiness JSON: {exc}",
        ) from exc

    if not isinstance(data, dict):
        raise HTTPException(
            status_code=500,
            detail="Readiness JSON must be a dict at top level.",
        )

    # Normalise basic shape if needed
    data.setdefault("status", "OK")
    data.setdefault("meta", {})
    data.setdefault("projects", [])

 # --- NEW: enrich readiness JSON with Tech Log counts (non-blocking) ---
 try:
     # Open AI Wealth DB and enrich readiness JSON with tech-log counts.
     conn = fc_aiw_get_conn()
     try:
         data = attach_techlog_counts_to_readiness(data, conn)
     finally:
         conn.close()
 except Exception as exc:
     # Non-blocking: if anything goes wrong, we log and still return readiness.
     print(f"[FC-READINESS] Tech-log enrichment failed: {exc}")

    return data


def _compute_summary(projects: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute a simple summary section for the readiness board.

    - Per project we compute a colour:
        GREEN   -> all COMPLETE
        YELLOW  -> at least one PARTIAL, none PENDING
        RED     -> at least one PENDING
    - Overall status:
        READY       -> all projects GREEN
        IN_PROGRESS -> otherwise (we treat any RED as still in progress
                       because this is a control-run board, not hard-block).
    """
    projects_total = len(projects)
    projects_green = 0
    projects_yellow = 0
    projects_red = 0

    total_tasks = 0

    for proj in projects:
        tasks = proj.get("tasks") or []
        total_tasks += len(tasks)

        has_pending = any((t.get("status") == "PENDING") for t in tasks)
        has_partial = any((t.get("status") == "PARTIAL") for t in tasks)
        all_complete = tasks and all((t.get("status") == "COMPLETE") for t in tasks)

        if has_pending:
            colour = "RED"
            projects_red += 1
        elif has_partial:
            colour = "YELLOW"
            projects_yellow += 1
        elif all_complete:
            colour = "GREEN"
            projects_green += 1
        else:
            # No tasks or mixed / unknown statuses -> treat as YELLOW
            colour = "YELLOW"
            projects_yellow += 1

        proj["readiness_colour"] = colour

    if projects_total > 0 and projects_green == projects_total:
        overall_status = "READY"
    else:
        overall_status = "IN_PROGRESS"

    summary: Dict[str, Any] = {
        "overall_status": overall_status,
        "overall_label": overall_status,  # UI uses either
        "projects_total": projects_total,
        "projects_green": projects_green,
        "projects_yellow": projects_yellow,
        "projects_red": projects_red,
        "tasks_total": total_tasks,
    }

    return summary


@router.get("/readiness")
async def get_readiness() -> Dict[str, Any]:
    """
    Main readiness endpoint used by:
      - Root cards (/api/readiness/readiness)
      - Node 2.1.1.2 – Readiness Dashboard

    It simply wraps go_live_readiness.json and adds a computed `summary`
    section so the UI can show G/Y/R counts without re-implementing logic.
    """
    data = _load_raw_readiness()

    projects = data.get("projects") or []
    if not isinstance(projects, list):
        raise HTTPException(
            status_code=500,
            detail="Readiness JSON: 'projects' must be a list.",
        )

    # Only compute summary if not already present or if caller expects fresh.
    summary = _compute_summary(projects)
    data["summary"] = summary

    return data
