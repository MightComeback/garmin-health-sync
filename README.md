# garmin-health-sync

Local-first Garmin Connect sync service for the Expo app.

## Goals
- Pull Garmin Connect health + activity data into a local SQLite DB.
- Expose a small local HTTP API for the Expo app to read.
- No cloud required.

## Run
```bash
bun run dev
```

## CLI Commands

The sync service includes a CLI for manual operations:

```bash
# Check service status and recent sync history
bun run status

# Trigger manual sync
bun run sync

# List recent activities
bun run cli activities

# Show daily metrics
bun run cli daily
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `GARMIN_USERNAME` | Your Garmin Connect email | *required* |
| `GARMIN_PASSWORD` | Your Garmin Connect password | *required* |
| `GARMIN_DB_PATH` | SQLite database path | `./garmin.sqlite` |
| `GARMIN_SYNC_PORT` | API server port | `17890` |
| `GARMIN_SYNC_URL` | Sync service URL (for CLI) | `http://127.0.0.1:17890` |

## Auto-start on macOS

See [`launchd/README.md`](launchd/README.md) for LaunchAgent setup to auto-start the sync service on login.
