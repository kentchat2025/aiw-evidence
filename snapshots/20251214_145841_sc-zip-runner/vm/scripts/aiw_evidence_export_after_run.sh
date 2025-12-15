#!/usr/bin/env bash
set -euo pipefail

# Always run as ubuntu with correct HOME (so ssh uses ubuntu key + known_hosts)
exec sudo -u ubuntu -H bash -lc '
  set -euo pipefail
  KEY=""
  for k in ~/.ssh/id_ed25519 ~/.ssh/id_rsa; do
    if [ -r "$k" ]; then KEY="$k"; break; fi
  done

  SSH_OPTS="-o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$HOME/.ssh/known_hosts"
  if [ -n "$KEY" ]; then
    export GIT_SSH_COMMAND="ssh -i $KEY $SSH_OPTS"
  else
    export GIT_SSH_COMMAND="ssh $SSH_OPTS"
  fi

  exec /opt/aiw-evidence/tools/export_aiw_evidence.sh
'
