#!/usr/bin/env python3
import sqlite3
import datetime

DB_PATH = "/opt/ai-wealth/db/aiw.db"

def iso_now():
    return datetime.datetime.now().isoformat(timespec="seconds")

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Check FC_TECH_LOG exists
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='FC_TECH_LOG';"
    )
    row = cur.fetchone()
    if not row:
        print("[ERROR] FC_TECH_LOG table not found in", DB_PATH)
        conn.close()
        return

    # Discover columns in FC_TECH_LOG
    cur.execute("PRAGMA table_info(FC_TECH_LOG);")
    cols_info = cur.fetchall()
    col_names = [c["name"] for c in cols_info]
    print("[INFO] FC_TECH_LOG columns:", col_names)

    if "TECH_ID" not in col_names:
        print("[ERROR] FC_TECH_LOG must have a TECH_ID column.")
        conn.close()
        return

    now = iso_now()

    # Helper: build row data only for existing columns
    def build_row(data: dict):
        cols = []
        vals = []
        for k, v in data.items():
            if k in col_names:
                cols.append(k)
                vals.append(v)
        if not cols:
            return None, None
        placeholders = ", ".join(["?"] * len(cols))
        col_list = ", ".join(cols)
        sql = f"INSERT OR REPLACE INTO FC_TECH_LOG ({col_list}) VALUES ({placeholders});"
        return sql, vals

    # === Entries to (re)register ===
    entries = []

    # 1) Spec builder script itself
    entries.append({
        "TECH_ID": "FC-BUILD-CODE-SPEC-V1",
        "OBJECT_TYPE": "SCRIPT",
        "OBJECT_NAME": "FC Build Code Spec v1",
        "OBJECT_PATH": "/opt/founderconsole/scripts/fc_build_code_spec_v1.py",
        "DESCRIPTION": "Scans FC_TECH_LOG + aiw.db table schemas and populates Code & Behaviour Dictionary (13.2).",
        "TILE_IDS": "13.2",
        "AIW_TABLES_USED": "FC_CODE_SPEC_HEADER,FC_CODE_SPEC_TABLE_SCHEMA",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "ACTIVE",
        "LAST_UPDATED_AT": now,
    })

    # 2) Brain – instrument super-agents (design-only)
    entries.append({
        "TECH_ID": "AIW-BRAIN-INSTRUMENT-EQ-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Instrument EQ v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_instrument_eq_v1.py (PLANNED)",
        "DESCRIPTION": "Instrument Brain for EQ; populates AIW_BRAIN_INSTRUMENT_SUMMARY/DETAIL (SIM = PROD logic).",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_INSTRUMENT_SUMMARY,AIW_BRAIN_INSTRUMENT_DETAIL",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-INSTRUMENT",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-INSTRUMENT-FO-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Instrument FO v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_instrument_fo_v1.py (PLANNED)",
        "DESCRIPTION": "Instrument Brain for F&O; populates AIW_BRAIN_INSTRUMENT_SUMMARY/DETAIL (SIM = PROD logic).",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_INSTRUMENT_SUMMARY,AIW_BRAIN_INSTRUMENT_DETAIL",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-INSTRUMENT",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-INSTRUMENT-MF-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Instrument MF v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_instrument_mf_v1.py (PLANNED)",
        "DESCRIPTION": "Instrument Brain for Mutual Funds; populates AIW_BRAIN_INSTRUMENT_SUMMARY/DETAIL (SIM = PROD logic).",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_INSTRUMENT_SUMMARY,AIW_BRAIN_INSTRUMENT_DETAIL",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-INSTRUMENT",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-INSTRUMENT-ETF-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Instrument ETF v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_instrument_etf_v1.py (PLANNED)",
        "DESCRIPTION": "Instrument Brain for ETFs; populates AIW_BRAIN_INSTRUMENT_SUMMARY/DETAIL (SIM = PROD logic).",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_INSTRUMENT_SUMMARY,AIW_BRAIN_INSTRUMENT_DETAIL",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-INSTRUMENT",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })

    # 3) Brain – profile super-agents
    entries.append({
        "TECH_ID": "AIW-BRAIN-PROFILE-CONSERVATIVE-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Profile CONSERVATIVE v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_profile_conservative_v1.py (PLANNED)",
        "DESCRIPTION": "Profile Brain for CONSERVATIVE bucket; writes AIW_BRAIN_PROFILE_SUMMARY/DECISION_ITEM.",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_PROFILE_SUMMARY,AIW_BRAIN_PROFILE_DECISION_ITEM",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-PROFILE",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-PROFILE-BALANCED-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Profile BALANCED v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_profile_balanced_v1.py (PLANNED)",
        "DESCRIPTION": "Profile Brain for BALANCED bucket; writes AIW_BRAIN_PROFILE_SUMMARY/DECISION_ITEM.",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_PROFILE_SUMMARY,AIW_BRAIN_PROFILE_DECISION_ITEM",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-PROFILE",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-PROFILE-AGGRESSIVE-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Profile AGGRESSIVE v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_profile_aggressive_v1.py (PLANNED)",
        "DESCRIPTION": "Profile Brain for AGGRESSIVE bucket; writes AIW_BRAIN_PROFILE_SUMMARY/DECISION_ITEM.",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_PROFILE_SUMMARY,AIW_BRAIN_PROFILE_DECISION_ITEM",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-PROFILE",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-PROFILE-ULTRA-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Profile ULTRA-AGGRESSIVE v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_profile_ultra_v1.py (PLANNED)",
        "DESCRIPTION": "Profile Brain for ULTRA-AGGRESSIVE bucket; writes AIW_BRAIN_PROFILE_SUMMARY/DECISION_ITEM.",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_PROFILE_SUMMARY,AIW_BRAIN_PROFILE_DECISION_ITEM",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-PROFILE",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })

    # 4) Guardian / Tech / Holiday / News Brains
    entries.append({
        "TECH_ID": "AIW-BRAIN-POLICY-GUARDIAN-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Policy Guardian v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_policy_guardian_v1.py (PLANNED)",
        "DESCRIPTION": "Global Policy Guardian Brain; no-loss rules, kill switches, and incident summary.",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_INCIDENT_SUMMARY",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-GUARDIAN",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-TECHNO-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Technical Health v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_techno_v1.py (PLANNED)",
        "DESCRIPTION": "Technical health Brain; updates AIW_BRAIN_SUPERAGENT_STATUS and AIW_BRAIN_RUN_HISTORY.",
        "TILE_IDS": "13.1,12.x-brain",
        "AIW_TABLES_USED": "AIW_BRAIN_SUPERAGENT_STATUS,AIW_BRAIN_RUN_HISTORY",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-TECHNO",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-HOLIDAY-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – Holiday v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_holiday_v1.py (PLANNED)",
        "DESCRIPTION": "Holiday awareness Brain; governs AIW_HOLIDAY_STATUS and run gating.",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_HOLIDAY_STATUS",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-ENV",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })
    entries.append({
        "TECH_ID": "AIW-BRAIN-NEWS-V1",
        "OBJECT_TYPE": "BACKEND",
        "OBJECT_NAME": "AI Wealth Brain – News v1 (design)",
        "OBJECT_PATH": "/opt/founderconsole/backend/aiw_brain_news_v1.py (PLANNED)",
        "DESCRIPTION": "News & Event Risk Brain; writes AIW_NEWS_RISK_TAG for symbols per run.",
        "TILE_IDS": "12.x-brain",
        "AIW_TABLES_USED": "AIW_NEWS_RISK_TAG",
        "FC_TABLES_USED": "",
        "AGENTS_RELATED": "SUPER-BRAIN-NEWS",
        "READINESS_ITEMS": "",
        "VERSION": "v1",
        "STATUS": "PLANNED",
        "LAST_UPDATED_AT": now,
    })

    # Execute upserts
    for e in entries:
        sql, vals = build_row(e)
        if sql is None:
            continue
        cur.execute(sql, vals)

    conn.commit()
    conn.close()
    print(f"[INFO] Registered/updated {len(entries)} entries in FC_TECH_LOG with rich metadata.")

if __name__ == "__main__":
    main()
