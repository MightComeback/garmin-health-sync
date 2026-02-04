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

- `GARMIN_USERNAME` - Your Garmin Connect email
- `GARMIN_PASSWORD` - Your Garmin Connect password
- `GARMIN_DB_PATH` - SQLite database path (default: ./garmin.sqlite)
- `GARMIN_SYNC_PORT` - API port (default: 17890)
