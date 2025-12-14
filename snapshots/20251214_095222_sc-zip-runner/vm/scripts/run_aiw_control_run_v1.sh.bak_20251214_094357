#!/usr/bin/env bash
set -euo pipefail

RUN_DATE="${1:-$(date +%Y-%m-%d)}"

echo "[AIW-CONTROL] Building validation for RUN_DATE=${RUN_DATE}"

sudo python3 /opt/founderconsole/scripts/aiw_build_validation_report_v1.py --date "${RUN_DATE}"

sudo docker cp /root/aiw_validation_report.json founderconsole-backend:/opt/founderconsole/runtime/aiw_validation_report.json

echo "[AIW-CONTROL] Updated /opt/founderconsole/runtime/aiw_validation_report.json inside founderconsole-backend"
echo "[AIW-CONTROL] Now you can call:"
echo "  https://founderconsole.kentechit.com/api/aiwealth/validation"
echo "  https://founderconsole.kentechit.com/aiwealth/control-run"

# --- AIW-EVIDENCE:EXPORT (auto evidence snapshot after control run) ----------
mkdir -p /opt/founderconsole/runtime >/dev/null 2>&1 || true
echo "[AIW-EVIDENCE] Exporting evidence snapshot to GitHub..." | tee -a /opt/founderconsole/runtime/aiw_evidence_export.log
sudo -u ubuntu /opt/aiw-evidence/tools/export_aiw_evidence.sh >> /opt/founderconsole/runtime/aiw_evidence_export.log 2>&1 \
  || echo "[AIW-EVIDENCE] WARNING: export failed (see /opt/founderconsole/runtime/aiw_evidence_export.log)" | tee -a /opt/founderconsole/runtime/aiw_evidence_export.log
# --- AIW-EVIDENCE:EXPORT ----------------------------------------------------
