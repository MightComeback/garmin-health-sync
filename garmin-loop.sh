#!/bin/bash
set -euo pipefail

cd /Users/might/clawd

# Concurrency guard
mkdir .hakky-lock-garmin 2&gt;/dev/null || { echo &quot;Lock held, exiting.&quot;; exit 0; }
trap &quot;rmdir .hakky-lock-garmin 2&gt;/dev/null || true&quot; EXIT

# Source secrets
set -a
source .secrets/linear.env
set +a

# Global git config (enforced for cron)
git config --global user.name &quot;Ivan Kuznetsov&quot;
git config --global user.email &quot;kuznetsovivan496@gmail.com&quot;
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519
git config --global commit.gpgsign true

function sync_repo {
  local repo_path=$1
  local remote_url=$2
  cd &quot;$repo_path&quot;
  git remote set-url origin &quot;$remote_url&quot;
  git fetch origin
  git pull --rebase --autostash || git pull --ff-only
  echo &quot;=== Status for $repo_path ===&quot;
  git status --short
  git log --oneline -5
  git branch -v --no-color
  echo &quot;Pending changes: $(git diff --shortstat || echo none)&quot;
}

sync_repo &quot;/Users/might/clawd/repos/garmin-health-sync&quot; &quot;https://github.com/MightComeback/garmin-health-sync.git&quot;
sync_repo &quot;/Users/might/clawd/repos/garmin-health/app&quot; &quot;https://github.com/MightComeback/garmin-health.git&quot;

echo &quot;=== SYNC COMPLETE. Check for pending work next. ===&quot;