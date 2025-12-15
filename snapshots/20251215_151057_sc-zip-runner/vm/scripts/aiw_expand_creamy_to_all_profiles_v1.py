#!/usr/bin/env python3
import argparse
import sqlite3
from datetime import datetime

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="/opt/ai-wealth/db/aiw.db")
    ap.add_argument("--env", required=True)
    ap.add_argument("--date", required=True)
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # Base profile present in creamy layer for this env/date
    cur.execute("""
        SELECT PROFILE_ID, COUNT(*) AS c
        FROM AIW_A_CREAMY_LAYER
        WHERE ENV_CODE=? AND RUN_DATE=? AND IS_CREAMY=1
        GROUP BY PROFILE_ID
        ORDER BY c DESC, PROFILE_ID ASC
        LIMIT 1
    """, (args.env, args.date))
    row = cur.fetchone()
    if not row:
        print(f"[EXPAND] No creamy rows found for ENV={args.env}, RUN_DATE={args.date}. Nothing to expand.")
        return
    base_profile = row["PROFILE_ID"]

    # All profiles defined
    cur.execute("SELECT PROFILE_ID FROM AIW_C_PROFILE ORDER BY PROFILE_ID")
    all_profiles = [r["PROFILE_ID"] for r in cur.fetchall()]
    if not all_profiles:
        print("[EXPAND] AIW_C_PROFILE is empty. Nothing to expand.")
        return

    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    created = 0
    for pid in all_profiles:
        if pid == base_profile:
            continue

        cur.execute("""
            SELECT COUNT(*) FROM AIW_A_CREAMY_LAYER
            WHERE ENV_CODE=? AND RUN_DATE=? AND PROFILE_ID=? AND IS_CREAMY=1
        """, (args.env, args.date, pid))
        exists = cur.fetchone()[0]
        if exists > 0:
            continue

        # Clone rows from base_profile into pid
        cur.execute(f"""
            INSERT INTO AIW_A_CREAMY_LAYER (
              ENV_CODE, RUN_DATE, PROFILE_ID, INSTRUMENT_ID, BROKER_CODE,
              DIRECTION, QUANTITY, ENTRY_PRICE, TARGET_PRICE, STOP_LOSS,
              CONFIDENCE, EXPECTED_RETURN_PCT, AI_RECOMMENDATION, AI_REASON,
              RANKING_SCORE, IS_CREAMY, DISPLAY_RANK, CREATED_AT, UPDATED_AT
            )
            SELECT
              ENV_CODE, RUN_DATE, ?, INSTRUMENT_ID, BROKER_CODE,
              DIRECTION, QUANTITY, ENTRY_PRICE, TARGET_PRICE, STOP_LOSS,
              CONFIDENCE, EXPECTED_RETURN_PCT, AI_RECOMMENDATION, AI_REASON,
              RANKING_SCORE, IS_CREAMY, DISPLAY_RANK, COALESCE(CREATED_AT, ?), ?
            FROM AIW_A_CREAMY_LAYER
            WHERE ENV_CODE=? AND RUN_DATE=? AND PROFILE_ID=? AND IS_CREAMY=1
        """, (pid, now, now, args.env, args.date, base_profile))
        created += cur.rowcount

    con.commit()
    print(f"[EXPAND] Base profile={base_profile}. Profiles in AIW_C_PROFILE={len(all_profiles)}. Cloned rows created={created}.")

if __name__ == "__main__":
    main()
