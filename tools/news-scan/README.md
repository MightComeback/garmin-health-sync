# Software news scan

Purpose: support an hourly scan focused on X/Twitter + actionable clawdbot/moltbot + agent tooling, and produce a single Telegram-ready sentence when something is relevant.

## Relevance filter (CLI)

Reads JSON array from stdin:

```json
[
  {"title":"...","url":"https://...","snippet":"..."}
]
```

Outputs JSON:

```json
{
  "relevant": true,
  "picked": {"title":"...","url":"...","snippet":"...","score":6,"reasons":["+3:release"]},
  "sentence": "Title (source.com) — https://..."
}
```

Run:

```bash
node tools/news-scan/relevance-filter.js < items.json
```

State:
- Dedup store: `memory/software-news-seen.json`

