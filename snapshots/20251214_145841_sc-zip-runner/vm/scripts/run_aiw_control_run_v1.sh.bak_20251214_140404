#!/usr/bin/env bash
set -euo pipefail

RUN_DATE="${1:-$(date +%Y-%m-%d)}"

# --- Paths ------------------------------------------------------------
RUNTIME_DIR="/opt/founderconsole/runtime"
OUT_JSON="${RUNTIME_DIR}/aiw_validation_report.json"
DB_PATH="/opt/ai-wealth/db/aiw.db"
ENV_CODE="${AIW_ENV_CODE:-SIM}"   # default SIM unless overridden

# --- Ensure runtime dir exists ---------------------------------------
sudo mkdir -p "${RUNTIME_DIR}"

echo "[AIW-CONTROL] Building validation for RUN_DATE=${RUN_DATE}"

# 1) Build base validation report JSON
sudo /usr/bin/env OUTPUT_PATH="${OUT_JSON}" python3 /opt/founderconsole/scripts/aiw_build_validation_report_v1.py --date "${RUN_DATE}"

# 2) Enrich creamy rows in DB (profile-driven ROI/Confidence/RiskBucket + target/SL)
#    Then rebuild JSON again so API reflects enriched fields.
echo "[AIW-CONTROL] Enriching creamy layer metrics (profile-driven) for ENV=${ENV_CODE}, RUN_DATE=${RUN_DATE}"
sudo /usr/bin/env python3 /opt/founderconsole/scripts/aiw_profile_metrics_enricher_v1.py --db "${DB_PATH}" --date "${RUN_DATE}" --env "${ENV_CODE}"

echo "[AIW-CONTROL] Rebuilding validation JSON after enrichment..."
sudo /usr/bin/env OUTPUT_PATH="${OUT_JSON}" python3 /opt/founderconsole/scripts/aiw_build_validation_report_v1.py --date "${RUN_DATE}"

# 3) Copy JSON into founderconsole-backend container runtime path
sudo docker cp "${OUT_JSON}" founderconsole-backend:/opt/founderconsole/runtime/aiw_validation_report.json

echo "[AIW-CONTROL] Updated ${OUT_JSON} inside founderconsole-backend"
echo "[AIW-CONTROL] Now you can call:"
echo "  https://founderconsole.kentechit.com/api/aiwealth/validation"
echo "  https://founderconsole.kentechit.com/aiwealth/control-run"

# 4) Evidence export (must never block control-run / auto-snapshot)
if [ "${AIW_SKIP_EVIDENCE:-0}" = "1" ]; then
  echo "[AIW-EVIDENCE] Skipped (AIW_SKIP_EVIDENCE=1)"
else
  echo "[AIW-EVIDENCE] Exporting evidence snapshot to GitHub (async)..."
  LOG="${RUNTIME_DIR}/aiw_evidence_export.log"
  # best-effort: ensure ubuntu can write the log
  sudo touch "${LOG}" || true
  sudo chown ubuntu:ubuntu "${LOG}" 2>/dev/null || true
  ( timeout 120s bash -lc "/opt/aiw-evidence/tools/export_aiw_evidence.sh" >>"${LOG}" 2>&1 ) &
  disown || true
  echo "[AIW-EVIDENCE] Launched async export (timeout 120s). Log: ${LOG}"
fi
