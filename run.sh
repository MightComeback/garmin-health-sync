#!/usr/bin/env bash
set -a
source /Users/might/clawd/.secrets/linear.env
set +a

# Clear old logs
rm -f sync.error.log sync.log

# Build and start
bun run build && bun run start
