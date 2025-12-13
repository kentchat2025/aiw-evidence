#!/usr/bin/env bash

# --- AIW_EVIDENCE_OCI_CHECK_V2: make OCI manifests work safely (no secrets) ---
export PATH=/home/ubuntu/bin:/usr/local/bin:/usr/bin:/bin:$PATH
oci_ok() {
  OCI_CLI_AUTH=instance_principal oci os ns get --query "data" --raw-output >/dev/null 2>&1 || return 1
  return 0
}

# -----------------------------------------------------------------------------
set -euo pipefail

# ---------------------------
# CONFIG (lean + safe)
# ---------------------------
EVIDENCE_REPO_DIR="/opt/aiw-evidence"
SNAP_ROOT="${EVIDENCE_REPO_DIR}/snapshots"
TS="$(date +%Y%m%d_%H%M%S)"
HOST_TAG="$(hostname -s)"
OUT_DIR="${SNAP_ROOT}/${TS}_${HOST_TAG}"

# VM source locations (do NOT include env/secrets)
VM_ROOT_UI="/opt/founderconsole/root-ui"
VM_BACKEND="/opt/founderconsole/backend"
VM_RUNTIME="/opt/founderconsole/runtime"

# Container names (best-effort)
UI_CONTAINER="fc-root-ui"
BE_CONTAINER="founderconsole-backend"

# OCI manifest settings (best-effort; ok if OCI CLI not configured)
OCI_BUCKETS=("bucket-supercoder-zip-upload" "bucket-supercoder-zip-archive")
OCI_PREFIX=""   # keep blank for full list; later we can narrow

# ---------------------------
# helpers
# ---------------------------
safe_rsync() {
  local src="$1"
  local dst="$2"
  if [ -d "$src" ]; then
    mkdir -p "$dst"
    rsync -a \
      --exclude ".env" --exclude "*.env" --exclude "env/" --exclude "secrets*" \
      --exclude "*token*" --exclude "*.key" --exclude "*.pem" --exclude "id_rsa*" \
      "$src/" "$dst/" || true
  fi
}

cmd_to_file() {
  local outfile="$1"; shift
  mkdir -p "$(dirname "$outfile")"
  ( "$@" ) >"$outfile" 2>&1 || true
}

mkdir -p "$OUT_DIR" "${EVIDENCE_REPO_DIR}/deployed-proof" "${EVIDENCE_REPO_DIR}/oci/manifests"
mkdir -p "$OUT_DIR/oci"

# 1) VM SOURCE (proof of what you edit)
safe_rsync "$VM_ROOT_UI"   "$OUT_DIR/vm/root-ui"
safe_rsync "$VM_BACKEND"   "$OUT_DIR/vm/backend"
safe_rsync "/opt/founderconsole/scripts" "$OUT_DIR/vm/scripts"
safe_rsync "/opt/founderconsole/ui-spec" "$OUT_DIR/vm/ui-spec"
safe_rsync "/opt/founderconsole/tests"   "$OUT_DIR/vm/tests"

# 2) VM RUNTIME OUTPUTS (executed outputs)
if compgen -G "$VM_RUNTIME/*.json" > /dev/null; then
  mkdir -p "$OUT_DIR/executions/runtime"
  cp -a $VM_RUNTIME/*.json "$OUT_DIR/executions/runtime/" || true
fi

# 3) DEPLOYED PROOF (what is actually served)
mkdir -p "$OUT_DIR/deployed"
cmd_to_file "$OUT_DIR/deployed/docker_ps.txt" docker ps
cmd_to_file "$OUT_DIR/deployed/docker_images.txt" docker images
cmd_to_file "$OUT_DIR/deployed/docker_inspect_${UI_CONTAINER}.txt" docker inspect "$UI_CONTAINER"
cmd_to_file "$OUT_DIR/deployed/docker_inspect_${BE_CONTAINER}.txt" docker inspect "$BE_CONTAINER"

# UI container proof (hash + listing + script tags)
cmd_to_file "$OUT_DIR/deployed/ui_ls.txt" docker exec "$UI_CONTAINER" sh -lc "ls -la /usr/share/nginx/html | head -200"
cmd_to_file "$OUT_DIR/deployed/ui_index_sha256.txt" docker exec "$UI_CONTAINER" sh -lc "sha256sum /usr/share/nginx/html/index.html"
cmd_to_file "$OUT_DIR/deployed/ui_index_script_tags.txt" docker exec "$UI_CONTAINER" sh -lc "grep -n \"<script\" /usr/share/nginx/html/index.html || true"

# Backend container proof (hash key file, best-effort paths)
cmd_to_file "$OUT_DIR/deployed/be_ls.txt" docker exec "$BE_CONTAINER" sh -lc "ls -la /app/backend 2>/dev/null || ls -la /opt/founderconsole/backend 2>/dev/null || true"
cmd_to_file "$OUT_DIR/deployed/be_app_fastapi_sha256.txt" docker exec "$BE_CONTAINER" sh -lc "sha256sum /app/backend/app_fastapi.py 2>/dev/null || sha256sum /opt/founderconsole/backend/app_fastapi.py 2>/dev/null || true"

# 4) OCI MANIFESTS (object list; NO PAR URLs)
if oci_ok; then
  for B in "${OCI_BUCKETS[@]}"; do
    cmd_to_file "$OUT_DIR/oci/${B}_list.json" OCI_CLI_AUTH=instance_principal oci os object list --bucket-name "$B" --prefix "$OCI_PREFIX" --all
  done
else
  echo "OCI CLI not installed/configured on this VM" > "$OUT_DIR/oci/oci_cli_missing.txt"
fi

# 5) Human-readable summary
cat > "$OUT_DIR/STATE_SUMMARY.md" << SUM
# AIW Evidence Snapshot
- Timestamp: $TS
- Host: $HOST_TAG

## Included
- VM source: root-ui, backend, scripts, ui-spec, tests (secrets excluded)
- Executions: /opt/founderconsole/runtime/*.json (if present)
- Deployed proof: container hashes + listings
- OCI manifests: object lists (if OCI CLI available)

## Notes
- Public repo: NO secrets, NO tokens, NO PAR URLs.
SUM

# 6) Commit + push
cd "$EVIDENCE_REPO_DIR"
git add -A
git commit -m "Evidence snapshot $TS ($HOST_TAG)" || true
git push

echo "DONE: wrote snapshot -> $OUT_DIR"
