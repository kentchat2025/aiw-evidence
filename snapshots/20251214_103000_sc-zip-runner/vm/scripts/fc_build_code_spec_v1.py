#!/usr/bin/env python3
import sqlite3
import datetime

DB_PATH = "/opt/ai-wealth/db/aiw.db"

def iso_now():
    return datetime.datetime.now().isoformat(timespec="seconds")

def map_layer(object_type: str) -> str:
    if not object_type:
        return "JOB"
    ot = str(object_type).upper()
    if ot in ("BACKEND", "API"):
        return "BACKEND"
    if ot in ("FRONTEND", "UI"):
        return "FRONTEND"
    if ot in ("SCRIPT", "JOB"):
        return "SCRIPT"
    return "JOB"

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    now = iso_now()

    # Sanity: ensure FC_TECH_LOG exists
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='FC_TECH_LOG';"
    )
    row = cur.fetchone()
    if not row:
        print("[ERROR] FC_TECH_LOG table not found in", DB_PATH)
        conn.close()
        return

    # Read all TECH objects
    cur.execute("SELECT * FROM FC_TECH_LOG;")
    tech_rows = cur.fetchall()
    print(f"[INFO] Found {len(tech_rows)} TECH_ID rows in FC_TECH_LOG")

    if not tech_rows:
        conn.close()
        print("[WARN] FC_TECH_LOG is empty; nothing to do.")
        return

    # Helper to safely read from sqlite3.Row
    def get_col(r: sqlite3.Row, name: str, default=None):
        keys = r.keys()
        if name in keys and r[name] is not None:
            return r[name]
        return default

    # Prepare upsert statements
    insert_header = """
    INSERT OR REPLACE INTO FC_CODE_SPEC_HEADER
      (TECH_ID, VERSION, LAYER, PURPOSE, RUN_CONTEXT, TRUST_LEVEL, LAST_VERIFIED_AT)
    VALUES
      (?, 'v1', ?, ?, ?, ?, ?);
    """

    insert_schema = """
    INSERT OR REPLACE INTO FC_CODE_SPEC_TABLE_SCHEMA
      (TABLE_NAME, COLUMN_NAME, DATA_TYPE, SEMANTIC_ROLE, MANDATORY,
       LAST_SEEN_TECH_ID, LAST_VERIFIED_AT)
    VALUES
      (?, ?, ?, 'UNKNOWN', 'N', ?, ?);
    """

    # Helper to split comma-separated table lists
    def parse_table_list(val):
        if not val:
            return []
        return [p.strip() for p in str(val).split(",") if p.strip()]

    # Upsert header + schema
    for r in tech_rows:
        tech_id = get_col(r, "TECH_ID", "").strip()
        if not tech_id:
            continue

        object_type = get_col(r, "OBJECT_TYPE")
        object_name = get_col(r, "OBJECT_NAME", tech_id)
        layer = map_layer(object_type)

        # For now we default to SIM_ONLY and AUTO_SCANNED
        run_context = "SIM_ONLY"
        trust_level = "AUTO_SCANNED"

        # 1) Header row
        cur.execute(
            insert_header,
            (tech_id, layer, object_name, run_context, trust_level, now),
        )

        # 2) Table schemas based on AIW_TABLES / FC_TABLES columns (if present)
        table_names = set()

        aiw_tables_val = get_col(r, "AIW_TABLES", "")
        fc_tables_val = get_col(r, "FC_TABLES", "")

        table_names.update(parse_table_list(aiw_tables_val))
        table_names.update(parse_table_list(fc_tables_val))

        for tbl in sorted(table_names):
            # Introspect schema via PRAGMA
            try:
                pragma_sql = f"PRAGMA table_info({tbl});"
                cur.execute(pragma_sql)
                cols = cur.fetchall()
            except Exception as e:
                print(f"[WARN] Could not introspect table {tbl}: {e}")
                continue

            if not cols:
                print(f"[WARN] Table {tbl} has no columns or does not exist.")
                continue

            for col in cols:
                # col is also sqlite3.Row
                col_name = col["name"]
                col_type = col["type"] or "TEXT"
                cur.execute(
                    insert_schema,
                    (tbl, col_name, col_type, tech_id, now),
                )

    conn.commit()
    conn.close()
    print("[INFO] FC_CODE_SPEC_HEADER and FC_CODE_SPEC_TABLE_SCHEMA updated successfully.")

if __name__ == "__main__":
    main()

