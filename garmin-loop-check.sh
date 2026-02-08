#!/bin/bash
set -euo pipefail

WORKSPACE="/Users/might/clawd"
LOCK_DIR="${WORKSPACE}/.hakky-lock-garmin"
APP_DIR="${WORKSPACE}/repos/garmin-health/app"
SYNC_DIR="${WORKSPACE}/repos/garmin-health-sync"
APP_REMOTE="https://github.com/MightComeback/garmin-health.git"
SYNC_REMOTE="https://github.com/MightComeback/garmin-health-sync.git"

# Acquire lock
if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "Lock exists, skipping."
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT INT TERM

# Load secrets
cd "${WORKSPACE}"
set -a
source .secrets/linear.env 2>/dev/null || true
set +a

HAS_PENDING=false
DETAILS=""

check_repo() {
  local dir="$1"
  local remote="$2"
  local name="$3"
  
  if [ ! -d "$dir/.git" ]; then
    echo "Repo $name not cloned at $dir"
    return
  fi
  
  cd "$dir"
  
  # Set remote
  git remote set-url origin "$remote"
  
  # Sync
  git fetch origin
  if ! git pull --rebase --autostash; then
    echo "Pull failed in $name, continuing..."
  fi
  
  # Status
  local status=$(git status --porcelain --untracked-files=no 2>/dev/null || echo "")
  local unstaged=$(git status --porcelain --untracked-files=normal | grep '??' || true)
  
  if [ -n "$status" ] || [ -n "$unstaged" ]; then
    HAS_PENDING=true
    DETAILS+="\n${name} ($dir):"
    DETAILS+=$(git status --short)
    if [ -n "$unstaged" ]; then
      DETAILS+="\nUntracked: $unstaged"
    fi
    git log -1 --oneline
  else
    echo "Clean: $name"
  fi
  
  cd "${WORKSPACE}"
}

check_repo "${APP_DIR}" "${APP_REMOTE}" "garmin-health/app"
check_repo "${SYNC_DIR}" "${SYNC_REMOTE}" "garmin-health-sync"

if [ "${HAS_PENDING}" = false ]; then
  echo "Both repos clean after pull. NO_REPLY"
else
  echo "Pending changes detected:${DETAILS}"
  echo "Implement one shippable improvement, commit, push."
fi