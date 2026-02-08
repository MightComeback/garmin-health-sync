# Hakky tools

## hakky-status

Shows what Hakky is doing + what’s next, based on Obsidian dashboard.

Usage:
```bash
hakky-status
```

Config:
- Set vault path via env var:
```bash
HAKKY_VAULT=/Users/might/Primary hakky-status
```

---

## hakkyctl (minimal orchestrator)

Runs task scripts in parallel (separate Node processes), tracks status to disk, and can optionally append a run summary to Obsidian.

### Conventions

- Tasks are plain Node scripts in `tools/hakky/tasks/*.js`.
- Task name = file name without `.js` (e.g. `news-scan.js` → `news-scan`).
- Each task should:
  - write progress to stdout/stderr (captured into a per-task log file)
  - exit `0` on success, non-zero on failure
- Orchestrator writes:
  - `tools/hakky/runs/<runId>/run.json` (machine-readable status)
  - `tools/hakky/runs/<runId>/<task>.log` (combined stdout/stderr)

### Usage

List tasks:
```bash
tools/hakky/hakkyctl.js tasks
```

Run tasks (parallel, conservative default concurrency):
```bash
tools/hakky/hakkyctl.js run news-scan obsidian-mine codex-build
```

Show last run status:
```bash
tools/hakky/hakkyctl.js status --last
```

### Optional Obsidian run logging (append-only)

Set these env vars:
```bash
HAKKY_VAULT=/Users/might/Primary
HAKKY_OBSIDIAN_LOG=1
```
It will append a single line per run into: `Workspace/Hakky/Run Log.md`.

### Optional Trello logging (opt-in)

If you want one Trello card per run, set:
```bash
HAKKY_TRELLO=1
TRELLO_KEY=...
TRELLO_TOKEN=...
TRELLO_LIST_ID=...
```

### Safety defaults

- No network calls by default (placeholder tasks are no-ops).
- Obsidian updates are opt-in and append-only.
- Trello is opt-in and failure is non-fatal (warn-only).
