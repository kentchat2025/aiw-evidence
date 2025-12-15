#!/usr/bin/env python3
import argparse, sqlite3, csv
from datetime import datetime, timedelta

def f(x):
    try:
        if x is None: return 0.0
        return float(x)
    except: return 0.0

def pct(a, b):
    return (a / b * 100.0) if b else 0.0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="/opt/ai-wealth/db/aiw.db")
    ap.add_argument("--env", default="SIM")
    ap.add_argument("--days", type=int, default=365)
    ap.add_argument("--horizon", type=int, default=7)
    ap.add_argument("--topn", type=int, default=200)
    ap.add_argument("--amb_rule", choices=["stop_first","skip","half_half"], default="stop_first")
    ap.add_argument("--out", default="/opt/founderconsole/runtime/aiw_backtest_1y_h7_top200_stopfirst.csv")
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # Find run dates in last N days (based on max RUN_DATE present)
    mx = cur.execute("SELECT MAX(RUN_DATE) mx FROM AIW_A_CREAMY_LAYER WHERE ENV_CODE=? AND IS_CREAMY=1", (args.env,)).fetchone()["mx"]
    if not mx:
        raise SystemExit("ERROR: No RUN_DATE found in AIW_A_CREAMY_LAYER.")
    mx_dt = datetime.strptime(mx, "%Y-%m-%d").date()
    start_dt = mx_dt - timedelta(days=args.days)
    start = start_dt.strftime("%Y-%m-%d")

    run_dates = [r["RUN_DATE"] for r in cur.execute("""
        SELECT DISTINCT RUN_DATE
        FROM AIW_A_CREAMY_LAYER
        WHERE ENV_CODE=? AND IS_CREAMY=1 AND RUN_DATE>=?
        ORDER BY RUN_DATE
    """, (args.env, start))]

    # Cache EOD prices per (instrument, date) for quick lookups
    # We will query per trade to keep it simple (horizon is small).

    stats = {}  # profile -> counters/sums
    def S(profile):
        if profile not in stats:
            stats[profile] = dict(days=set(), n=0,
                                  sum_edge=0.0, sum_conf=0.0, sum_roi=0.0,
                                  tgt_hit=0, sl_hit=0, amb=0, none=0,
                                  win=0, lose=0,
                                  sum_realized=0.0)
        return stats[profile]

    for rd in run_dates:
        # pull topN per profile for that day
        rows = list(cur.execute("""
            SELECT PROFILE_ID, INSTRUMENT_ID,
                   ENTRY_PRICE, TARGET_PRICE, STOP_LOSS,
                   EXPECTED_RETURN_PCT, CONFIDENCE,
                   DISPLAY_RANK
            FROM AIW_A_CREAMY_LAYER
            WHERE ENV_CODE=? AND RUN_DATE=? AND IS_CREAMY=1
            ORDER BY PROFILE_ID, DISPLAY_RANK ASC
        """, (args.env, rd)))

        # split per profile
        byp = {}
        for r in rows:
            byp.setdefault(r["PROFILE_ID"], []).append(r)

        for pid, lst in byp.items():
            take = lst[:args.topn]
            for r in take:
                st = S(pid)
                st["days"].add(rd)
                st["n"] += 1

                entry = f(r["ENTRY_PRICE"])
                target = f(r["TARGET_PRICE"])
                stop = f(r["STOP_LOSS"])
                roi = f(r["EXPECTED_RETURN_PCT"])
                conf = f(r["CONFIDENCE"])

                # Edge = expected - downside (downside from stop)
                downside = pct((entry - stop), entry) if entry else 0.0
                edge = roi - downside

                st["sum_edge"] += edge
                st["sum_conf"] += conf
                st["sum_roi"]  += roi

                # Fetch next horizon trading rows for that instrument
                eods = list(cur.execute("""
                    SELECT TRADE_DATE, HIGH_PRICE, LOW_PRICE, CLOSE_PRICE
                    FROM AIW_H_PRICE_EOD
                    WHERE INSTRUMENT_ID=? AND TRADE_DATE>?
                    ORDER BY TRADE_DATE
                    LIMIT ?
                """, (r["INSTRUMENT_ID"], rd, args.horizon)))

                if not eods:
                    st["none"] += 1
                    continue

                max_high = max(f(x["HIGH_PRICE"]) for x in eods)
                min_low  = min(f(x["LOW_PRICE"])  for x in eods)
                close_last = f(eods[-1]["CLOSE_PRICE"])

                hit_t = (target > 0 and max_high >= target)
                hit_s = (stop   > 0 and min_low  <= stop)

                realized = 0.0
                if hit_t and hit_s:
                    st["amb"] += 1
                    if args.amb_rule == "skip":
                        # ignore this trade
                        continue
                    elif args.amb_rule == "half_half":
                        # average of target and stop outcomes
                        r_t = pct((target - entry), entry) if entry else 0.0
                        r_s = pct((stop - entry), entry)   if entry else 0.0
                        realized = 0.5 * (r_t + r_s)
                        # win/lose not counted strictly
                    else:
                        # STOP-FIRST (conservative)
                        realized = pct((stop - entry), entry) if entry else 0.0
                        st["sl_hit"] += 1
                        st["lose"] += 1

                elif hit_t:
                    st["tgt_hit"] += 1
                    st["win"] += 1
                    realized = pct((target - entry), entry) if entry else 0.0
                elif hit_s:
                    st["sl_hit"] += 1
                    st["lose"] += 1
                    realized = pct((stop - entry), entry) if entry else 0.0
                else:
                    st["none"] += 1
                    realized = pct((close_last - entry), entry) if entry else 0.0

                st["sum_realized"] += realized

    # Write per-profile summary
    rows_out = []
    for pid, st in sorted(stats.items()):
        n = st["n"]
        days = len(st["days"])
        if n == 0: continue
        rows_out.append({
            "profile": pid,
            "days": days,
            "trades": n,
            "avg_edge": round(st["sum_edge"]/n, 3),
            "avg_conf": round(st["sum_conf"]/n, 3),
            "avg_roi":  round(st["sum_roi"]/n, 3),
            "tgt_hit_pct": round(pct(st["tgt_hit"], n), 3),
            "sl_hit_pct":  round(pct(st["sl_hit"], n), 3),
            "amb_pct":     round(pct(st["amb"], n), 3),
            "none_pct":    round(pct(st["none"], n), 3),
            "win_pct":     round(pct(st["win"], n), 3),
            "lose_pct":    round(pct(st["lose"], n), 3),
            "realized7d_avg": round(st["sum_realized"]/max(1,n), 3),
            "amb_rule": args.amb_rule
        })

    with open(args.out, "w", newline="") as fp:
        w = csv.DictWriter(fp, fieldnames=list(rows_out[0].keys()) if rows_out else ["profile"])
        w.writeheader()
        for r in rows_out:
            w.writerow(r)

    # Print compact table
    print("=== BACKTEST SUMMARY (1y rolling, horizon=%dd, topN=%d per day, AMB=%s) ===" % (args.horizon, args.topn, args.amb_rule))
    if not rows_out:
        print("No rows produced.")
        return
    hdr = ["profile","days","trades","avg_edge","avg_conf","avg_roi","tgt_hit_pct","sl_hit_pct","amb_pct","none_pct","win_pct","lose_pct","realized7d_avg"]
    print("  ".join([h.rjust(14) for h in hdr]))
    for r in rows_out:
        print("  ".join([str(r[h]).rjust(14) for h in hdr]))
    print("\nWROTE:", args.out)

if __name__ == "__main__":
    main()
