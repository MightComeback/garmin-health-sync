#!/bin/bash
set -euo pipefail
mkdir .hakky-lock-garmin 2>/dev/null || exit 0
trap 'rmdir .hakky-lock-garmin 2>/dev/null || true' EXIT
set -a
source /Users/might/clawd/.secrets/linear.env
set +a
git config --global user.name "Ivan Kuznetsov"
git config --global user.email "kuznetsovivan496@gmail.com"
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519
git config --global commit.gpgsign true
echo "=== APP REPO ==="
cd /Users/might/clawd/repos/garmin-health/app || echo "App dir not found"
if [ -d .git ]; then
  git remote set-url origin https://github.com/MightComeback/garmin-health.git || true
  git fetch origin
  git pull --rebase --autostash || true
  git status --porcelain
  git log -1 --oneline --pretty=format:'%H %an <%ae>'
else
  echo "No git repo in app dir"
fi
echo ""
echo "=== SYNC REPO ==="
cd /Users/might/clawd/repos/garmin-health-sync || echo "Sync dir not found"
if [ -d .git ]; then
  git remote set-url origin https://github.com/MightComeback/garmin-health-sync.git || true
  git fetch origin
  git pull --rebase --autostash || true
  git status --porcelain
  git log -1 --oneline --pretty=format:'%H %an <%ae>'
else
  echo "No git repo in sync dir"
fi
echo "Status check complete"