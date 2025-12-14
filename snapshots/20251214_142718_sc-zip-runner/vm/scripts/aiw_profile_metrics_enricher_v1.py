#!/usr/bin/env python3
import argparse
import datetime as dt
import re
import sqlite3

def now_iso():
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def clamp(x, lo, hi):
    if x < lo:
        return lo
    if x > hi:
        return hi
    return x

def guess_col(cols, patterns):
    cols_u = {}
    for c in cols:
        cols_u[c.upper()] = c
    for pat in patterns:
        rx = re.compile(pat, re.I)
        for cu, orig in cols_u.items():
            if rx.search(cu):
                return orig
    return ""

def table_cols(conn, table):
    cur = conn.execute("PRAGMA table_info(%s);" % table)
    return [r[1] for r in cur.fetchall()]

def load_profiles(conn):
    """
    Returns mapping profile_id -> { code, name, risk_class }
    risk_class inferred from code/name keywords if possible.
    """
    profiles = {}

    cols = table_cols(conn, "AIW_C_PROFILE")
    if not cols:
        return profiles

    c_profile_id = guess_col(cols, [r"^PROFILE_ID$", r"PROFILE_ID", r"^ID$"])
    c_code = guess_col(cols, [r"PROFILE_CODE", r"CODE", r"PROFILE"])
    c_name = guess_col(cols, [r"PROFILE_NAME", r"NAME", r"DESCRIPTION"])

    if not c_profile_id:
        return profiles

    sel = [c_profile_id]
    if c_code:
        sel.append(c_code)
    if c_name:
        sel.append(c_name)

    sql = "SELECT %s FROM AIW_C_PROFILE;" % (", ".join(sel))
    for row in conn.execute(sql).fetchall():
        pid = str(row[0])
        code = str(row[1]) if len(row) > 1 else pid
        name = str(row[2]) if len(row) > 2 else code

        txt = ("%s %s" % (code, name)).upper()
        if ("ULTRA" in txt) or ("HIGH" in txt):
            risk_class = "ULTRA_AGGRESSIVE"
        elif "AGGR" in txt:
            risk_class = "AGGRESSIVE"
        elif ("CONS" in txt) or ("SAFE" in txt):
            risk_class = "CONSERVATIVE"
        else:
            risk_class = "BALANCED"

        profiles[pid] = {"code": code, "name": name, "risk_class": risk_class}

    return profiles

def risk_params(risk_class):
    """
    (min_roi_pct, max_roi_pct, rr_target)
    DEFAULTS. Later we can wire AIW_C_STRATEGY_PROFILE values if needed.
    """
    if risk_class == "CONSERVATIVE":
        return (1.5, 4.0, 2.2)
    if risk_class == "BALANCED":
        return (2.0, 7.0, 1.8)
    if risk_class == "AGGRESSIVE":
        return (3.0, 12.0, 1.5)
    return (4.0, 18.0, 1.3)  # ULTRA_AGGRESSIVE

def norm_score(score, smin, smax):
    if smax <= smin:
        return 0.5
    return clamp((score - smin) / (smax - smin), 0.0, 1.0)

def patch_reason(reason, roi, conf, bucket, rr):
    r = reason or ""
    r = re.sub(r"Expected return about\\s+[0-9]+(\\.[0-9]+)?%", "Expected return about %.2f%%" % roi, r)
    r = re.sub(r"confidence\\s+[0-9]*\\.[0-9]+", "confidence %d/100" % conf, r)
    r = re.sub(r"confidence\\s+\\d{1,3}/100", "confidence %d/100" % conf, r)
    r = re.sub(r"Risk bucket:\\s*[A-Z_]+", "Risk bucket: %s" % bucket, r)
    r = re.sub(r"\\s*\\[CONF=\\d+/100\\]\\s*$", "", r)
    r = r.rstrip() + " [CONF=%d/100][RR=%.2f][RB=%s]" % (conf, rr, bucket)
    return r

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--date", required=True)
    ap.add_argument("--env", required=True)
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    profiles = load_profiles(conn)

    rows = conn.execute(
        """
        SELECT
          ENV_CODE, RUN_DATE, PROFILE_ID, INSTRUMENT_ID,
          ENTRY_PRICE, TARGET_PRICE, STOP_LOSS,
          CONFIDENCE, EXPECTED_RETURN_PCT,
          RANKING_SCORE, AI_REASON
        FROM AIW_A_CREAMY_LAYER
        WHERE ENV_CODE=? AND RUN_DATE=? AND IS_CREAMY=1
        """,
        (args.env, args.date),
    ).fetchall()

    if not rows:
        print("[ENRICH] No creamy rows for ENV=%s, RUN_DATE=%s. Nothing to do." % (args.env, args.date))
        return

    by_profile = {}
    for r in rows:
        pid = str(r["PROFILE_ID"])
        by_profile.setdefault(pid, []).append(r)

    updates = 0
    for pid, plist in by_profile.items():
        meta = profiles.get(pid, {"code": pid, "name": pid, "risk_class": "BALANCED"})
        risk_class = meta["risk_class"]
        rbucket = risk_class

        roi_min, roi_max, rr_target = risk_params(risk_class)

        scores = [float(x["RANKING_SCORE"] or 0.0) for x in plist]
        smin, smax = (min(scores), max(scores))

        for r in plist:
            entry = float(r["ENTRY_PRICE"] or 0.0)
            score = float(r["RANKING_SCORE"] or 0.0)
            n = norm_score(score, smin, smax)

            roi = roi_min + (roi_max - roi_min) * n
            roi = float("%.2f" % roi)

            sl_pct = roi / rr_target
            target = entry * (1.0 + roi / 100.0)
            stop = entry * (1.0 - sl_pct / 100.0)

            conf = 50.0 + n * 35.0 + (rr_target - 1.0) * 10.0
            conf = int(round(clamp(conf, 1.0, 99.0)))

            rr = 0.0
            if (entry > stop) and (target > entry):
                rr = (target - entry) / (entry - stop)

            new_reason = patch_reason(r["AI_REASON"] or "", roi, conf, rbucket, rr)

            conn.execute(
                """
                UPDATE AIW_A_CREAMY_LAYER
                SET
                  TARGET_PRICE=?,
                  STOP_LOSS=?,
                  EXPECTED_RETURN_PCT=?,
                  CONFIDENCE=?,
                  AI_REASON=?,
                  UPDATED_AT=?
                WHERE ENV_CODE=? AND RUN_DATE=? AND PROFILE_ID=? AND INSTRUMENT_ID=?
                """,
                (
                    float(target),
                    float(stop),
                    float(roi),
                    float(conf),
                    new_reason,
                    now_iso(),
                    args.env,
                    args.date,
                    pid,
                    str(r["INSTRUMENT_ID"]),
                ),
            )
            updates += 1

    conn.commit()
    conn.close()
    print("[ENRICH] Updated %d creamy rows for ENV=%s, RUN_DATE=%s." % (updates, args.env, args.date))

if __name__ == "__main__":
    main()
