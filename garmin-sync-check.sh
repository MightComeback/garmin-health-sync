#!/bin/bash
set -euo pipefail
WORKSPACE=&quot;/Users/might/clawd&quot;
cd &quot;$WORKSPACE&quot;
LOCK=&quot;.hakky-lock-garmin&quot;
mkdir &quot;$LOCK&quot; 2&gt;/dev/null || { echo &quot;Already locked, exiting.&quot;; exit 0; }
trap &quot;rmdir '$LOCK' 2&gt;/dev/null || true&quot; EXIT
if [ -f .secrets/linear.env ]; then
  set -a
  source .secrets/linear.env
  set +a
fi
git config --global user.name &quot;Ivan Kuznetsov&quot;
git config --global user.email &quot;kuznetsovivan496@gmail.com&quot;
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519
git config --global commit.gpgsign true
echo &quot;=== Git config set ===&quot;
sync_repo() {
  local repo_path=&quot;$1&quot;
  local remote_url=&quot;$2&quot;
  branch=&quot;main&quot;
  mkdir -p &quot;$repo_path&quot;
  cd &quot;$repo_path&quot;
  pwd
  if [ ! -d .git ]; then
    git init
    git remote add origin &quot;$remote_url&quot;
  fi
  git remote set-url origin &quot;$remote_url&quot;
  git fetch origin
  if git pull --rebase --autostash &gt;/dev/null 2&gt;&amp;1; then
    echo &quot;Pull success in $repo_path&quot;
  else
    git checkout -B $branch origin/$branch &gt;/dev/null 2&gt;&amp;1 || git reset --hard origin/$branch
    echo &quot;Reset to origin/$branch in $repo_path&quot;
  fi
  echo &quot;Status in $repo_path:&quot;
  git status --porcelain
  if [ -z &quot;$(git status --porcelain)&quot; ]; then
    echo &quot;CLEAN&quot;
  else
    echo &quot;DIRTY&quot;
  fi
  echo &quot;Recent commits:&quot;
  git log --oneline -3 || echo &quot;No commits&quot;
  echo &quot;Top files:&quot;
  ls -la | head -10
  echo &quot;Has Garmin auth? (grep):&quot;
  grep -r -i &quot;garmin.*connect\|auth\|oauth\|token&quot; src/ package.json README.md 2&gt;/dev/null || echo &quot;No obvious Garmin auth code found&quot;
  echo &quot;=== $repo_path DONE ===&quot;
  cd &quot;$WORKSPACE&quot;
}
sync_repo &quot;repos/garmin-health-sync&quot; &quot;https://github.com/MightComeback/garmin-health-sync.git&quot;
sync_repo &quot;repos/garmin-health/app&quot; &quot;https://github.com/MightComeback/garmin-health.git&quot;
echo &quot;All syncs complete. Lock released on exit.&quot;