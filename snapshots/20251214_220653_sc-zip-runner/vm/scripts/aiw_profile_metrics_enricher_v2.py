#!/usr/bin/env python3
import argparse, sqlite3, math
from datetime import datetime

DB="/opt/ai-wealth/db/aiw.db"

# Profile baselines (your current means) + RR targets + confidence baselines
BASE = {
  "CONSERVATIVE":      {"roi": 2.75, "rr": 1.40, "conf": 80},
  "BALANCED":          {"roi": 4.50, "rr": 1.80, "conf": 76},
  "AGGRESSIVE":        {"roi": 7.50, "rr": 1.50, "conf": 72},
  "ULTRA_AGGRESSIVE":  {"roi": 11.0, "rr": 1.35, "conf": 70},
}

def clamp(x, lo, hi): return lo if x < lo else hi if x > hi else x

def risk_from_profile_id(pid: str) -> str:
    u = (pid or "").upper()
    if "ULTRA" in u: return "ULTRA_AGGRESSIVE"
    if "CONSERV" in u: return "CONSERVATIVE"
    if "AGGRESS" in u: return "AGGRESSIVE"
    if "BALANC" in u: return "BALANCED"
    return "BALANCED"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True)
    ap.add_argument("--date", required=True)
    ap.add_argument("--db", default=DB, help="Path to aiw.db")
    args = ap.parse_args()
    env = args.env
    run_date = args.date

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # max display rank per profile (used to normalize 0..1 strength)
    maxr = {}
    for r in cur.execute("""
        SELECT PROFILE_ID, COALESCE(MAX(DISPLAY_RANK), 0) AS mx
        FROM AIW_A_CREAMY_LAYER
        WHERE ENV_CODE=? AND RUN_DATE=? AND IS_CREAMY=1
        GROUP BY PROFILE_ID
    """, (env, run_date)):
        maxr[r["PROFILE_ID"]] = int(r["mx"] or 0)

    rows = list(cur.execute("""
        SELECT ENV_CODE, RUN_DATE, PROFILE_ID, INSTRUMENT_ID,
               ENTRY_PRICE, TARGET_PRICE, STOP_LOSS,
               DISPLAY_RANK
        FROM AIW_A_CREAMY_LAYER
        WHERE ENV_CODE=? AND RUN_DATE=? AND IS_CREAMY=1
    """, (env, run_date)))

    if not rows:
        print(f"[ENRICH_V2] No creamy rows for ENV={env}, RUN_DATE={run_date}.")
        return

    updates = []
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    for r in rows:
        pid = r["PROFILE_ID"]
        entry = float(r["ENTRY_PRICE"] or 0.0)
        if entry <= 0:
            continue

        risk = risk_from_profile_id(pid)
        b = BASE.get(risk, BASE["BALANCED"])

        dr = int(r["DISPLAY_RANK"] or 0)
        mx = maxr.get(pid, 0)
        if mx <= 1:
            mx = 200  # safe fallback

        # strength: top rank -> 1.0, bottom -> 0.0
        strength = 1.0 - (max(1, dr) - 1) / float(mx - 1)

        # VARY ROI within profile: factor 0.70..1.30 around baseline (visible variation)
        roi = b["roi"] * (0.70 + 0.60 * strength)
        roi = clamp(roi, b["roi"] * 0.60, b["roi"] * 1.50)

        rr_target = b["rr"]
        downside = roi / rr_target
        downside = clamp(downside, 0.75, 15.0)  # safety

        target = entry * (1.0 + roi / 100.0)
        stop   = entry * (1.0 - downside / 100.0)

        rr = (target - entry) / max(1e-9, (entry - stop))

        # confidence varies with strength, RR and downside
        conf = float(b["conf"])
        conf += (strength - 0.5) * 10.0          # +/-5
        conf += (clamp(rr, 0.5, 3.0) - 1.5) * 4  # reward better RR
        conf -= max(0.0, downside - 6.0) * 1.2   # penalize very wide SL
        conf = clamp(conf, 35.0, 95.0)
        conf_int = int(round(conf))

        reason = (
            f"Profile={pid} ({risk}). "
            f"Exp {roi:.2f}% / Down {downside:.2f}% / R:R {rr:.2f}. "
            f"Conf {conf_int}/100. Entry {entry:.2f}, Target {target:.2f}, SL {stop:.2f}."
        )

        updates.append((
            target, stop, conf, roi, reason, now,
            env, run_date, pid, r["INSTRUMENT_ID"]
        ))

    cur.executemany("""
        UPDATE AIW_A_CREAMY_LAYER
        SET TARGET_PRICE=?,
            STOP_LOSS=?,
            CONFIDENCE=?,
            EXPECTED_RETURN_PCT=?,
            AI_REASON=?,
            UPDATED_AT=?
        WHERE ENV_CODE=? AND RUN_DATE=? AND PROFILE_ID=? AND INSTRUMENT_ID=?
    """, updates)

    con.commit()
    print(f"[ENRICH_V2] Updated {len(updates)} creamy rows for ENV={env}, RUN_DATE={run_date}.")

if __name__ == "__main__":
    main()
