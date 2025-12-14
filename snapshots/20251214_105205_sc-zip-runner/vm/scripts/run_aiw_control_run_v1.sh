#!/usr/bin/env bash
set -euo pipefail

RUN_DATE="${1:-$(date +%Y-%m-%d)}"

RUNTIME_DIR="/opt/founderconsole/runtime"
OUT_JSON="${RUNTIME_DIR}/aiw_validation_report.json"
EVID_LOG="${RUNTIME_DIR}/aiw_evidence_export.log"

mkdir -p "$RUNTIME_DIR"

echo "[AIW-CONTROL] Building validation for RUN_DATE=${RUN_DATE}"

# 1) Build validation JSON (write directly to runtime path)
sudo env OUTPUT_PATH="$OUT_JSON" python3 /opt/founderconsole/scripts/aiw_build_validation_report_v1.py --date "${RUN_DATE}"

# 2) Copy JSON into founderconsole-backend container (same path inside container)
sudo docker cp "$OUT_JSON" founderconsole-backend:"$OUT_JSON"

echo "[AIW-CONTROL] Updated $OUT_JSON inside founderconsole-backend"
echo "[AIW-CONTROL] Now you can call:"
echo "  https://founderconsole.kentechit.com/api/aiwealth/validation"
echo "  https://founderconsole.kentechit.com/aiwealth/control-run"

# 3) Evidence export (must NOT block auto-snapshot)
#    Modes:
#      AIW_EVIDENCE_MODE=skip  -> do nothing (for path/service runs)
#      AIW_EVIDENCE_MODE=async -> background + timeout 120s (default)
#      AIW_EVIDENCE_MODE=sync  -> wait up to 120s then continue
AIW_EVIDENCE_MODE="${AIW_EVIDENCE_MODE:-async}"

if [[ "$AIW_EVIDENCE_MODE" == "skip" ]]; then
  echo "[AIW-EVIDENCE] Skipping evidence export (AIW_EVIDENCE_MODE=skip)."
  exit 0
fi

mkdir -p "$RUNTIME_DIR"
echo "[AIW-EVIDENCE] Exporting evidence snapshot to GitHub (${AIW_EVIDENCE_MODE})..." | tee -a "$EVID_LOG"

if [[ "$AIW_EVIDENCE_MODE" == "sync" ]]; then
  sudo -u ubuntu bash -lc "timeout 120s /opt/aiw-evidence/tools/export_aiw_evidence.sh" >>"$EVID_LOG" 2>&1 || \
    echo "[AIW-EVIDENCE] WARNING: export failed or timed out (see $EVID_LOG)" | tee -a "$EVID_LOG"
else
  # async (non-blocking)
  sudo -u ubuntu bash -lc "nohup timeout 120s /opt/aiw-evidence/tools/export_aiw_evidence.sh >>'$EVID_LOG' 2>&1 &" || true
  echo "[AIW-EVIDENCE] Launched async export (timeout 120s). Log: $EVID_LOG" | tee -a "$EVID_LOG"
fi

exit 0

