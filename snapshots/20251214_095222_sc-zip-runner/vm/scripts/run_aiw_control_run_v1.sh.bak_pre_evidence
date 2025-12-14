#!/usr/bin/env bash
set -euo pipefail

RUN_DATE="${1:-$(date +%Y-%m-%d)}"

echo "[AIW-CONTROL] Building validation for RUN_DATE=${RUN_DATE}"

sudo python3 /home/ubuntu/aiw-validation-builder-v1/aiw-validation-builder-v1/aiw_build_validation_report_v1.py --date "${RUN_DATE}"

sudo docker cp /root/aiw_validation_report.json founderconsole-backend:/opt/founderconsole/runtime/aiw_validation_report.json

echo "[AIW-CONTROL] Updated /opt/founderconsole/runtime/aiw_validation_report.json inside founderconsole-backend"
echo "[AIW-CONTROL] Now you can call:"
echo "  https://founderconsole.kentechit.com/api/aiwealth/validation"
echo "  https://founderconsole.kentechit.com/aiwealth/control-run"
