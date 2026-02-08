#!/usr/bin/env node
/**
 * Task: codex-build
 *
 * Minimal placeholder: intended to build/update a local "codex" (summaries, index, etc.).
 */

(async function main() {
  const runId = process.env.HAKKY_RUN_ID || 'unknown';
  console.log(`[codex-build] run=${runId} started`);

  // Safety: no filesystem writes by default.
  console.log('[codex-build] nothing to do (placeholder)');

  console.log('[codex-build] done');
})().catch((err) => {
  console.error('[codex-build] ERR:', err && err.stack ? err.stack : String(err));
  process.exit(1);
});
