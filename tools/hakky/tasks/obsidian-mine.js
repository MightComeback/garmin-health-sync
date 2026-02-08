#!/usr/bin/env node
/**
 * Task: obsidian-mine
 *
 * Minimal placeholder: illustrates where to put Obsidian mining logic.
 */

const fs = require('fs');
const path = require('path');

function vaultPath() {
  return process.env.HAKKY_VAULT || '/Users/might/Primary';
}

(async function main() {
  const runId = process.env.HAKKY_RUN_ID || 'unknown';
  console.log(`[obsidian-mine] run=${runId} started`);

  // Safe check: just verify vault exists.
  const v = vaultPath();
  if (!fs.existsSync(v)) {
    console.log(`[obsidian-mine] vault not found: ${v}`);
    process.exit(0);
  }

  // Example: count markdown files under Workspace/Hakky (if exists)
  const hakkyDir = path.join(v, 'Workspace', 'Hakky');
  if (!fs.existsSync(hakkyDir)) {
    console.log('[obsidian-mine] Workspace/Hakky not found; nothing to mine');
    process.exit(0);
  }

  const files = fs.readdirSync(hakkyDir).filter(f => f.endsWith('.md'));
  console.log(`[obsidian-mine] found ${files.length} .md file(s) in Workspace/Hakky`);

  console.log('[obsidian-mine] done');
})().catch((err) => {
  console.error('[obsidian-mine] ERR:', err && err.stack ? err.stack : String(err));
  process.exit(1);
});
