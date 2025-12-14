#!/usr/bin/env bash
set -euo pipefail

RUN_DATE="${1:-$(date +%Y-%m-%d)}"

RUNTIME_DIR="/opt/founderconsole/runtime"
OUT_JSON="${RUNTIME_DIR}/aiw_validation_report.json"

BUILDER="/opt/founderconsole/scripts/aiw_build_validation_report_v1.py"
BACKEND_CONTAINER="founderconsole-backend"
BACKEND_JSON="/opt/founderconsole/runtime/aiw_validation_report.json"

EVID_LOG="${RUNTIME_DIR}/aiw_evidence_export.log"
EVID_TOOL="/opt/aiw-evidence/tools/export_aiw_evidence.sh"
EVID_WRAPPER="/opt/founderconsole/scripts/aiw_evidence_export_after_run.sh"

echo "[AIW-CONTROL] Building validation for RUN_DATE=${RUN_DATE}"

# 1) Build validation JSON directly into runtime (no /root dependency)
sudo mkdir -p "${RUNTIME_DIR}" >/dev/null 2>&1 || true
sudo env OUTPUT_PATH="${OUT_JSON}" python3 "${BUILDER}" --date "${RUN_DATE}"

# 2) Copy JSON into backend container runtime path (so API serves fresh data)
sudo docker cp "${OUT_JSON}" "${BACKEND_CONTAINER}:${BACKEND_JSON}"

echo "[AIW-CONTROL] Updated ${BACKEND_JSON} inside ${BACKEND_CONTAINER}"
echo "[AIW-CONTROL] Now you can call:"
echo "  https://founderconsole.kentechit.com/api/aiwealth/validation"
echo "  https://founderconsole.kentechit.com/aiwealth/control-run"

# 3) Evidence export must NOT block auto-snapshot (path->service).
#    We skip it when AIW_SKIP_EVIDENCE=1, else run in background with 120s timeout.
if [[ "${AIW_SKIP_EVIDENCE:-0}" == "1" ]]; then
  echo "[AIW-EVIDENCE] Skipped (AIW_SKIP_EVIDENCE=1)"
  exit 0
fi

# ensure log file exists and is writable
sudo mkdir -p "${RUNTIME_DIR}" >/dev/null 2>&1 || true
sudo touch "${EVID_LOG}" >/dev/null 2>&1 || true
sudo chmod 664 "${EVID_LOG}" >/dev/null 2>&1 || true

_evidence_bg_run () {
  local cmd="$1"
  if command -v timeout >/dev/null 2>&1; then
    ( timeout 120s bash -lc "${cmd}" >>"${EVID_LOG}" 2>&1 || echo "[AIW-EVIDENCE] WARN: failed or timed out: ${cmd}" >>"${EVID_LOG}" ) &
  else
    ( bash -lc "${cmd}" >>"${EVID_LOG}" 2>&1 || echo "[AIW-EVIDENCE] WARN: failed: ${cmd}" >>"${EVID_LOG}" ) &
  fi
}

echo "[AIW-EVIDENCE] Exporting evidence snapshot to GitHub (background, <=120s)..." | tee -a "${EVID_LOG}"
if [[ -x "${EVID_TOOL}" ]]; then
  _evidence_bg_run "sudo -u ubuntu ${EVID_TOOL}"
else
  echo "[AIW-EVIDENCE] WARN: evidence tool missing or not executable: ${EVID_TOOL}" | tee -a "${EVID_LOG}"
fi

# optional post-run wrapper (if you have extra steps)
if [[ -x "${EVID_WRAPPER}" ]]; then
  echo "[AIW-EVIDENCE] Exporting evidence snapshot (post-run wrapper, background, <=120s)..." | tee -a "${EVID_LOG}"
  _evidence_bg_run "${EVID_WRAPPER}"
else
  echo "[AIW-EVIDENCE] Wrapper missing (ok): ${EVID_WRAPPER}" | tee -a "${EVID_LOG}"
fi

# Do NOT wait here (must exit fast for systemd path service)
exit 0

