#!/bin/bash
set -euo pipefail

LOCK_DIR=".hakky-lock-garmin"
cd /Users/might/clawd

# Acquire lock
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Lock held, skipping."
  exit 0
fi

trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT INT TERM

# Git config
git config --global user.name "Ivan Kuznetsov"
git config --global user.email "kuznetsovivan496@gmail.com"
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519
git config --global commit.gpgsign true

# Secrets
set -a
source /Users/might/clawd/.secrets/linear.env 2>/dev/null || true
set +a

echo "=== SYNC garmin-health-sync ==="
SYNC_DIR="/Users/might/clawd/repos/garmin-health-sync"
if [ -d "$SYNC_DIR" ]; then
  cd "$SYNC_DIR"
  pwd
  ls -la
  git remote set-url origin https://github.com/MightComeback/garmin-health-sync.git || true
  git fetch origin
  git pull --rebase --autostash || git pull || true
  git status
  git log --pretty=format:'%h %an &lt;%ae&gt; %G? %s' -5
else
  echo "SYNC_DIR missing: $SYNC_DIR"
fi

echo "=== SYNC garmin-health/app ==="
APP_DIR="/Users/might/clawd/repos/garmin-health/app"
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  pwd
  ls -la
  git remote set-url origin https://github.com/MightComeback/garmin-health.git || true
  git fetch origin
  git pull --rebase --autostash || git pull || true
  git status
  git log --pretty=format:'%h %an &lt;%ae&gt; %G? %s' -5
else
  echo "APP_DIR missing: $APP_DIR"
fi

echo "Sync complete."
