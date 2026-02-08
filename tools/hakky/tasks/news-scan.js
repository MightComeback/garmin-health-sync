#!/usr/bin/env node
/**
 * Task: news-scan
 *
 * Minimal placeholder: emits a short, structured log entry.
 * Extend this script to actually scan sources.
 */

(async function main() {
  const runId = process.env.HAKKY_RUN_ID || 'unknown';
  console.log(`[news-scan] run=${runId} started`);

  // Safety: do nothing networky by default.
  // Implementers can add fetch/web_search/etc in the main agent, not here.

  console.log('[news-scan] nothing to do (placeholder)');
  console.log(`[news-scan] done`);
})().catch((err) => {
  console.error('[news-scan] ERR:', err && err.stack ? err.stack : String(err));
  process.exit(1);
});
