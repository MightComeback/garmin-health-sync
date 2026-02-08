#!/bin/bash
cd /Users/might/clawd/repos/mig-15
mkdir .hakky-lock-mig15 2>/dev/null || exit 0
set -a
source /Users/might/clawd/.secrets/linear.env
set +a
hakky-linear-issue-state MIG-15