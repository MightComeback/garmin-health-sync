#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/might/clawd/repos/mig-15"
LOCK_DIR="$REPO_DIR/.hakky-lock-mig15"
SECRETS="/Users/might/clawd/.secrets/linear.env"

cd "$REPO_DIR"

# Acquire lock
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Lock held, exiting."
  exit 0
fi
trap "rmdir '$LOCK_DIR' 2>/dev/null || true" EXIT

# Load secrets
set -a
source "$SECRETS"
set +a

# Check Linear state
STATE=$(hakky-linear-issue-state MIG-15)
echo "Linear state: $STATE"

if [[ "$STATE" == *"completed"* ]] || [[ "$STATE" == *"canceled"* ]]; then
  echo "DONE: Disabled MIG-15 cron job because Linear issue state is $STATE."
  exit 0
fi

# Git config for cron (as per MEMORY.md)
git config user.name "Ivan Kuznetsov"
git config user.email "kuznetsovivan496@gmail.com"
git config gpg.format ssh
git config user.signingkey ~/.ssh/id_ed25519
git config commit.gpgsign true

# Sync
git fetch origin
git pull --rebase --autostash

# Check status
git status

# For now, check if changes, but placeholder for work
echo "No changes detected or work to do. NO_REPLY"

# Placeholder for actual work logic...
