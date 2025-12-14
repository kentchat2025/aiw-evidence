#!/usr/bin/env bash
set -euo pipefail

DB="/opt/ai-wealth/db/aiw.db"

# Prevent overlapping runs (debounce/concurrency guard)
LOCK="/tmp/aiw_auto_snapshot.lock"
exec 9>"$LOCK"
flock -n 9 || { echo "[AIW-AUTO] Another snapshot run is in progress. Exiting."; exit 0; }

# Detect latest RUN_DATE in SIM (adjust ENV if needed later)
RUN_DATE="$(sqlite3 "$DB" "SELECT MAX(RUN_DATE) FROM AIW_T_SIGNAL WHERE ENV_CODE='SIM';" || true)"
if [[ -z "${RUN_DATE:-}" || "${RUN_DATE}" == "NULL" ]]; then
  echo "[AIW-AUTO] No RUN_DATE found in AIW_T_SIGNAL for ENV_CODE=SIM. Nothing to do."
  exit 0
fi

echo "[AIW-AUTO] Detected DB change. Regenerating control-run JSON for RUN_DATE=${RUN_DATE} ..."
sudo /opt/founderconsole/scripts/run_aiw_control_run_v1.sh "$RUN_DATE"
echo "[AIW-AUTO] Done."
