#!/usr/bin/env bash
set -euo pipefail
cd /Users/might/clawd/repos/fathom2action

mkdir .hakky-lock 2>/dev/null || exit 0
trap 'rmdir .hakky-lock 2>/dev/null || true' EXIT

set -a
source /Users/might/clawd/.secrets/linear.env
set +a

state_json=$(hakky-linear-issue-state MIG-14 || true)
if [ -z "$state_json" ]; then
  echo "ALERT: Could not read Linear issue state for MIG-14; check LINEAR_API_KEY and hakky-linear-issue-state tool."
  exit 0
fi
state_type=$(printf '%s' "$state_json" | sed -n 's/.*"type"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
if [ "$state_type" = "completed" ] || [ "$state_type" = "canceled" ]; then
  echo "__DISABLE__"
  exit 0
fi

git remote set-url origin https://github.com/MightComeback/video-extract.git

git fetch origin
if ! git pull --rebase --autostash; then
  echo "ALERT: git pull --rebase failed; resolve conflicts in /Users/might/clawd/repos/fathom2action."
  exit 0
fi

# Remove accidental TS additions (repo is JS + node:test)
rm -rf src/lib || true
rm -f test/normalize-url.test.ts || true

# Patch normalizeUrlLike to strip tracking params broadly (provider parity)
perl -0777 -i -pe 'my $needle = "    const host = url.hostname.toLowerCase().replace(/^www\\./, \x27\x27);\n    const path = url.pathname || \x27/\x27;\n";
  if (index($_, $needle) >= 0) {
    my $ins = $needle . "\n    // Provider parity: strip common tracking parameters early, regardless of provider.\n    // We keep provider-specific params later (e.g. Vimeo h=..., Loom sid=..., time anchors).\n    const trackingPrefixes = [\"utm_\"];\n    const trackingKeys = new Set([\n      \"fbclid\",\n      \"gclid\",\n      \"mc_cid\",\n      \"mc_eid\",\n      \"igshid\",\n    ]);\n    for (const k of [...url.searchParams.keys()]) {\n      const lk = String(k || \"\").toLowerCase();\n      if (trackingKeys.has(lk) || trackingPrefixes.some(p => lk.startsWith(p))) {\n        url.searchParams.delete(k);\n      }\n    }\n";
    s/\Q$needle\E/$ins/;
  } else {
    die "needle not found";
  }' src/brief.js

cat > test/brief-normalize-url-tracking.test.js <<'EOF'
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrlLike } from "../src/brief.js";

describe("normalizeUrlLike - tracking params", () => {
  test("strips utm_* params for Vimeo URLs", () => {
    assert.equal(
      normalizeUrlLike("https://vimeo.com/12345?utm_source=x&utm_campaign=y"),
      "https://vimeo.com/12345",
    );
  });

  test("strips fbclid/gclid while preserving Vimeo unlisted hash", () => {
    assert.equal(
      normalizeUrlLike("https://vimeo.com/12345/abcdef?fbclid=x&gclid=y"),
      "https://vimeo.com/12345?h=abcdef",
    );
  });

  test("strips utm_* for YouTube watch URLs (preserves t)", () => {
    assert.equal(
      normalizeUrlLike(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=x&t=30s",
      ),
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    );
  });
});
EOF

bun install --silent
bun run test

if git diff --quiet && git diff --cached --quiet; then
  echo "NO_REPLY"
  exit 0
fi

git add -A

author_name="Ivan"
author_email=$(git config user.email || true)
if [ -z "$author_email" ]; then
  echo "ALERT: git user.email is not set; set it so commits can be authored as Ivan."
  exit 0
fi

msg="MIG-14: strip tracking params in URL normalization + tests"

git commit -S --author="$author_name <$author_email>" -m "$msg"

git push origin HEAD

sha=$(git rev-parse HEAD)
url=$(gh api repos/MightComeback/video-extract/commits/$sha --jq .html_url 2>/dev/null || true)
if [ -z "$url" ]; then
  echo "ALERT: Commit pushed but could not fetch GitHub URL; ensure gh auth is set (gh auth status)."
  exit 0
fi

hakky-linear-comment MIG-14 "Strip common tracking params during URL normalization (provider parity) + add tests — $url" || {
  echo "ALERT: Commit pushed ($url) but Linear comment failed; check LINEAR_API_KEY / hakky-linear-comment."
  exit 0
}

echo "NO_REPLY"
