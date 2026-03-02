# Metrics Charts Plan

## Scope
- Segmented control: Day / Week / Month
- Summary cards: include All Time
- Usage permission is optional. Core local metrics must work without usage permission.

## Core charting types
- Streaks
  - Weekly goal completion chart (rolling 7 days)
  - Per-day streak state: `hit` / `miss` / `neutral`
  - Goal achievement total streak (all time)
- Activity
  - Total activity for period: distance + elapsed time
  - Total blocked app attempts
  - Total notifications blocked
- Focus
  - Focus time (focusMinutes)
- Usage (permission-gated)
  - Top apps by screen time for day/week/month
  - Per-app detail view with usage trend, total usage, sessions, daily average, and notifications blocked

## Data readiness
Legend:
- ✅ Available now from local tracking/blocking
- 🟡 Requires new telemetry or historical aggregation
- 🔒 Requires usage permission

### Available without usage permission
- Distance (Day / Week / Month / All Time) ✅
- Elapsed time (Day / Week / Month / All Time) ✅
- Goals reached days (Day / Week / Month / All Time) ✅
- Current + longest goal streak (All Time) ✅
- Focus minutes (derived from local activity) ✅

### Requires additional local telemetry
- Blocked app attempts totals/series 🟡
- Historical notifications blocked totals/series beyond today 🟡

### Requires usage permission
- Top used apps and per-app usage analytics 🔒
- Per-app sessions, averages, and trend charts 🔒
- Any metric derived from UsageStats foreground usage data 🔒

## Storage key schema (local)
Canonical source of truth remains local DB/session history. MMKV metrics keys are derived projections for fast reads.

Streak source-of-truth and semantics:
- Canonical streak computation reads Room `daily_totals` rows.
- First install day is seeded as a completed streak day (`hit`) even without a daily row.
- `goalsReached=true` contributes to streak.
- `goalsReached=false` breaks streak.
- Missing day row is neutral (does not increment or break).
- MMKV `metrics:alltime` streak values are cache projections derived from Room.

- `metrics:daily:YYYY-MM-DD`
- `metrics:plans:daily:YYYY-MM-DD`
- `metrics:rolling:7d|30d|365d`
- `metrics:monthly:YYYY-MM`
- `metrics:alltime`
- `metrics:index:daily`
- `metrics:index:plans:daily`

### All-time payload (v1)
- `distanceMeters`
- `elapsedSeconds`
- `sessions`
- `goalsReachedDays`
- `currentGoalStreakDays`
- `longestGoalStreakDays`
- `focusMinutes` (nullable until explicit focus telemetry exists)
- `notificationsBlockedTotal` (nullable until historical aggregation is implemented)
- `blockedAttemptsTotal` (nullable until telemetry is implemented)
- `computedAtMs`
- `schemaVersion`

## Implementation phases

### Phase 1: Foundation (in progress)
- Add all-time projection write/read support
- Keep existing live day-progress path unchanged for home + notification
- Keep week semantics as rolling `7d` (no separate `metrics:weekly` key)

### Phase 2: Complete required local metrics
- Add blocked-app-attempt telemetry and daily aggregation
- Add historical notifications-blocked aggregation and rollups
- Expose unified periodized read contract for metrics screen

### Phase 3: Metrics UI wiring
- Wire Day/Week/Month segmented charts to unified read contract
- Wire All Time summary cards
- Keep usage section permission-gated with disabled-state UX when permission is missing

## Efficiency additions
- Incremental aggregation updates on session close
- Dirty period flags + lazy recompute when stale/missing
- Coalesced writes for bursty updates
- Bounded indexes for fast historical lookup
- Schema versioning + projection repair/backfill path

## Verification (release-blocking)

### Live day-progress non-regression
- Home and notification always show current day distance + elapsed progress from the live state path
- Progress remains reactive while tracking is active
- Foreground/background transitions do not freeze or reset progress

### 1Hz elapsed-time non-regression (manual + auto)
- Manual tracking: elapsed increments at ~1Hz while active
- Auto tracking: elapsed increments at ~1Hz while active
- 60-second run target: elapsed is `60 ± 1s`
- No double ticking, burst jumps, or ticking after stop/pause/close
- Notification elapsed/progress stays in sync with in-app elapsed

### Aggregation correctness
- Day/Week/Month/All Time totals match canonical recompute
- Rolling/window and month-boundary behavior is correct
- Streak values are correct across mixed goal/non-goal sequences
- Blocked attempts and notifications roll up correctly once telemetry is enabled

### Existing-flow regression checks
- Tracking start/stop/checkpoint/close flows remain stable
- Existing onboarding and permission-gated usage flows remain stable
- No regressions in current working notification and home data flows
