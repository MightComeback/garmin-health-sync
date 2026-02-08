# MEMORY.md - long-term context (curated)

## Preferences / operating mode
- Wants an executive GTD assistant: proactive, direct, accountability-first (no filler).
- Default rule: **act first, then report** (when safe). Don't ask permission for routine/internal steps.
- **No hand-holding:** execute tasks to a world-class bar, then come back with confidence + evidence.
- Hold Ivan accountable to learning/consistent execution (within reason).
- Accountability style: if a required check-in (PLAN/DONE/MISS) is missing, **spam/nag until it's answered** and refuse topic pivots; accept `OVERRIDE` for truly urgent.
- If a choice is required, pick a reasonable default and proceed; only ask when blocked.

## Autonomy boundaries
- Allowed autonomy for most actions.
- **Do not**: (1) spend money (2) make breaking changes to accounts.

## Tooling philosophy (important)
- Prefer **micro-tools with single responsibility** and clean composability.
- Enforce **separation of concerns**: one tool extracts/normalizes data; another tool transforms it into actions/outputs.
  - Example: "Fathom → extract" (video+transcript from link) is tool #1; "transcript → next actions" is tool #2.
- Naming should reflect responsibility: the extractor should not be called "fathom2action".

## Fathom → Gemini pipeline (current project expectation)
- Outcome: extractor should download the meeting **video file** and optionally **split into ~5-minute segments** suitable for feeding into Gemini.
- Don't ask for design choices when the outcome implies a clear default; only ask when blocked (e.g., auth).

## Product principle (absolute)
- Always aim for **world-class UX** in everything we build.
  - Onboarding
  - Usage ergonomics
  - Progress indicators (progress bars)
  - Docs coverage
  - Persistence/reliability

## Productivity systems
- Calendar integration is important (Google Calendar). Explicit preference: "write it to your memory — no workarounds."
- Uses reminders/cron + hourly activity logging.
- When cron blockers are identified (e.g., missing credentials), record them in memory immediately.

## Git Identity Management (critical)
- **Problem**: Isolated cron agents and repos were committing with wrong identity
- **Root cause**: Cron sessions don't inherit repo local git config
- **Solution**: Set **global** git config as the single source of truth:
  ```bash
  git config --global user.name "Ivan Kuznetsov"
  git config --global user.email "kuznetsovivan496@gmail.com"
  git config --global gpg.format ssh
  git config --global user.signingkey ~/.ssh/id_ed25519
  git config --global commit.gpgsign true
  ```
- **Enforcement**: All cron jobs must include explicit git config commands before committing
- **Verification**: `git log --pretty=format:'%an <%ae> %G? %s'` to verify signing status
- **Fixing history**: Use `git filter-branch` + `git rebase --root --exec "git commit --amend --no-edit -S"` for bulk rewrites

## Active Projects (2026-02-04)

### MIG-23: OpenWhisper
- **Repo**: https://github.com/MightComeback/openwhspr
- **Type**: Native macOS dictation app (Swift/SwiftUI)
- **Goal**: Replace SuperWhisper/AquaVoice/WhisperFlow
- **Key Features**: Global shortcut, Whisper.cpp, live transcription, dictionary, fast
- **Status**: Initialized, cron job pending (gateway issue)

### MIG-15: Mollet Mascot
- **Repo**: https://github.com/MightComeback/molt-mascot
- **Type**: Desktop lobster mascot plugin
- **Status**: Continuous loop running
- **Cron**: 7cc213b6-237a-4a3d-9662-7bb28c830036

### MIG-14: Fathom Link → Actionable Bug Report
- **Repo**: https://github.com/MightComeback/video-extract
- **Type**: CLI tool for extracting actionable bug reports from Fathom links
- **Status**: Completed, loop disabled
- **Cron**: db41a92a-ea86-44c0-af12-e658bba46e9d (disabled)

### Garmin Health
- **App**: https://github.com/MightComeback/garmin-health
- **Sync**: https://github.com/MightComeback/garmin-health-sync
- **Type**: Garmin health data syncing + Expo app
- **Status**: Fully functional, public, continuous loop running
- **Cron**: 957a3e25-f2b9-4034-a5d1-49dbdbf07f8e

## Cron Job Architecture
- **Session isolation**: Cron jobs use isolated sessions for independent operations
- **Fail-safe**: Cron jobs must include git config setup in payload before any commit
- **Idempotency**: Use concurrency guards (`.hakky-lock-*`) to prevent parallel execution
- **Visibility**: For long-running agentTurn tasks, specify `thinking=low` and `timeoutSeconds`
- **Gateway dependency**: Cron tool depends on gateway WebSocket connection; timeouts indicate gateway issues
- **Next actions**: If gateway fails, fix gateway connectivity before updating cron jobs
