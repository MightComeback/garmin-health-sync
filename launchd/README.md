# Auto-start on macOS (LaunchAgent)

This directory contains a LaunchAgent plist for auto-starting the Garmin Health Sync service on macOS login.

## Installation

1. Copy the plist to your LaunchAgents directory:
```bash
cp launchd/com.garmin-health-sync.plist ~/Library/LaunchAgents/
```

2. Update the paths in the plist to match your system:
   - `WorkingDirectory` — path to this repo
   - `EnvironmentVariables` — add your GARMIN_USERNAME and GARMIN_PASSWORD

3. Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.garmin-health-sync.plist
```

4. Start it now:
```bash
launchctl start com.garmin-health-sync
```

## Verification

Check if it's running:
```bash
launchctl list | grep garmin-health
```

View logs:
```bash
tail -f sync.log
tail -f sync.error.log
```

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.garmin-health-sync.plist
rm ~/Library/LaunchAgents/com.garmin-health-sync.plist
```
