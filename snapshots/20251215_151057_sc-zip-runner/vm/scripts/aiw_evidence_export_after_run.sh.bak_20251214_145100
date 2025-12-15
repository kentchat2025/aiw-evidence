#!/usr/bin/env bash
set -euo pipefail

RUNTIME="/opt/founderconsole/runtime"
LOG="$RUNTIME/aiw_evidence_export.log"
mkdir -p "$RUNTIME"

echo "[AIW-EVIDENCE] $(date -Is) Export start" | tee -a "$LOG"

# Run exporter as ubuntu with ubuntu HOME (so SSH auth works)
OUT="$(
  sudo -H -u ubuntu bash -lc '/opt/aiw-evidence/tools/export_aiw_evidence.sh' 2>&1 | tee -a "$LOG"
)" || true

# Detect snapshot path from exporter output
SNAP="$(echo "$OUT" | awk '/DONE: wrote snapshot -> /{print $NF}' | tail -n 1)"

if [ -n "${SNAP:-}" ] && [ -d "$SNAP" ]; then
  SHA="$(sudo -H -u ubuntu bash -lc 'cd /opt/aiw-evidence && git rev-parse --short HEAD' 2>/dev/null || true)"
  echo "[AIW-EVIDENCE] OK snapshot=$SNAP commit=${SHA:-unknown}" | tee -a "$LOG"
  echo "AIW_EVIDENCE_SNAPSHOT=$SNAP"
  echo "AIW_EVIDENCE_COMMIT=${SHA:-unknown}"
else
  echo "[AIW-EVIDENCE] WARNING: snapshot not detected. Check $LOG" | tee -a "$LOG"
  # IMPORTANT: do NOT fail control-run even if evidence export has issues
  exit 0
fi
