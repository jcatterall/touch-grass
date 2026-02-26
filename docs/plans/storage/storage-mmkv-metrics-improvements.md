# 🏗 Full Architectural Plan: TouchGrass (Updated, Charting Deferred, Expanded)

---

## 1️⃣ Core Principles

1. **Two layers of data:**

   * **Live state (volatile, real-time):**

     * Used for progress spinners, background notifications, and immediate blocking enforcement.
     * Optimized for synchronous, low-latency reads via MMKV.
   * **Immutable daily snapshots (historical, append-only):**

     * Store completed daily metrics for historical tracking, future insights, and analytics.
     * Write-once, read-many model ensures performance and safety.

2. **MMKV as primary storage:**

   * Synchronous reads/writes (via mmap) shared between JS and native layers.
   * Multi-process mode allows background services to access the same keys as JS.

3. **AsyncStorage deprecation:**

   * Only retain for onboarding and legacy migration (if necessary).
   * All runtime-critical or frequently-read state should migrate to MMKV.

4. **Pre-aggregate wherever possible:**

   * Avoid real-time computation across long time ranges.
   * Use rolling aggregates (`7d`, `30d`, `365d`) to serve dashboards or insights instantly.

5. **Time-bucketed keys:**

   * Daily: `metrics:daily:YYYY-MM-DD`
   * Rolling: `metrics:rolling:7d|30d|365d`
   * Monthly: `metrics:monthly:YYYY-MM`
   * Ensures quick lookups and simple future cloud syncing.

6. **Runtime snapshots:**

   * Store minimal, precomputed state of active plans, goals, and blocking status.
   * Used by services to make decisions instantly without iterating over plan objects.

7. **Event logs optional:**

   * Optional append-only logs for unlocks, focus sessions, blocked attempts, etc.
   * Can feed future analytics or ML without slowing live updates.

---

## 2️⃣ Storage Design

### A. MMKV Namespaces

> **Important (repo reality vs target design):** The namespaces below describe the **target key model**.
> The current TouchGrass repo uses **one MMKV container** (id `touchgrass_state`, multi-process) with **typed keys**, and uses **Room** as the durable store for historical session/daily totals.
> See **2.1 Current Implementation Mapping (repo-specific)** for the authoritative current mapping.

| Namespace / keyspace                 | Purpose |
| ----------------------------------- | ------- |
| `touchgrass_state`                  | Synchronous counters for today's totals: distance, elapsed time, goal reached, auto-tracking flags. |
| `live:*` (optional target keyspace) | Real-time progress & runtime snapshots for UI/notifications if you choose to store them as JSON blobs. |
| `metrics:daily:YYYY-MM-DD`          | Immutable daily metrics (target). |
| `metrics:index:daily`               | Index of available daily metric dates for fast range queries (target). |
| `metrics:rolling:7d|30d|365d`       | Precomputed aggregates for efficient summary queries (target). |
| `metrics:monthly:YYYY-MM`           | Monthly summaries for long-term retention and efficiency (target). |
| `event:*` (optional)                | Append-only events: focus sessions, unlocks, blocked attempts, session start/end (target). |

**Considerations:**

* Multi-process mode ensures JS, foreground, and background services always see consistent data.
* Runtime snapshot keys are small, atomic, and quickly read/writable for high-frequency access.

---

### B. Runtime Snapshot Keys

> **Target schema (not implemented as a single JSON blob in the current repo):**
> Current implementation uses typed MMKV keys (goal/plan/today totals) rather than a `live:activePlanSnapshot` object.

```ts
type ActivePlanSnapshot = {
  active_plan_ids: string[],           // IDs of currently active plans
  has_active_plans: boolean,           // True if at least one plan is active today
  blocked_apps: string[],              // Apps currently blocked
  blocking_active: boolean,            // Blocking currently enforced
  goal_type: 'distance' | 'time' | 'none',
  goal_value: number,                  // Aggregated from active plans
  goal_unit: string,
  goal_reached_today: boolean,
  blocking_until_timestamp?: number    // Optional, end of current blocking window
}
```

**Notes:**

* Native services read this snapshot synchronously.
* `has_active_plans` allows fast short-circuiting for UI or background checks without scanning all plans.
* Snapshot updated whenever plans change or a session starts/stops.
* Versioning field optional for future schema upgrades.

---

### C. Daily Metrics Schema

```ts
type DailyMetrics = {
  distanceMeters: number
  elapsedSeconds: number
  sessions: number                   // Number of tracking sessions per day
  focusMinutes: number               // Time spent in "active tracking" (optional business logic)
  blockedAttempts: number            // Number of times user tried to access blocked apps
  unlockEvents: number               // Number of manual unlocks or plan overrides
  goalsReached: boolean              // True if daily goal(s) were met
}
```

**Key:** `metrics:daily:YYYY-MM-DD`

**Additional Notes:**

* Immutable per day.
* Aggregated from `live:progress` at session end or day rollover.
* Serves as source for rolling aggregates or future cloud sync.

---

### D. Live Progress Schema

> **Target schema (not implemented in the current repo):**
> The current repo uses native session progress + MMKV typed key projection rather than a `live:progress` JSON object.

```ts
type LiveProgress = {
  date: string,
  distanceMeters: number,
  timeSeconds: number,
  goalDistanceMeters: number,
  goalTimeSeconds: number,
  goalType: 'distance' | 'time' | 'none',
  active: boolean,
  lastUpdated: number               // Epoch timestamp
}
```

**Key:** `live:progress`

**Use Cases:**

* Home screen spinner
* Foreground/background notifications
* Quick feedback to user for ongoing sessions

**Notes:**

* Reset at day rollover or goal completion.
* Debounced writes (2–5 seconds) for performance.

---

## 2.1 Current Implementation Mapping (repo-specific)

This section maps the architectural plan to the current TouchGrass implementation and highlights where behaviour differs from the idealized plan.

- **MMKV container (single id):** The app uses one MMKV instance with id `touchgrass_state` (Kotlin: `MMKV.mmkvWithID("touchgrass_state", MMKV.MULTI_PROCESS_MODE)`, JS: `new MMKV({ id: 'touchgrass_state', mode: Mode.MULTI_PROCESS })`).

- **Implemented MMKV keys (Kotlin ↔ JS `fastStorage`):**
   - `current_day` — YYYY-MM-DD (used for rollover)
   - `today_distance_meters` — Double
   - `today_elapsed_seconds` — Long
   - `today_goals_reached` — Boolean
   - `is_auto_tracking` — Boolean
   - `goal_type`, `goal_value`, `goal_unit` — aggregated goal metadata
   - `plan_day`, `plan_active_today` — plan-day snapshot used by notifications
   - `goal_distance_value`, `goal_distance_unit`, `goal_time_value`, `goal_time_unit` — typed goal keys used by native notification rendering
   - `idle_monitoring_enabled` — native/JS toggle used by background/idle monitoring
   - `blocked_count` — Int (number of blocked packages)

- **Where historical snapshots live today:** Daily/immutable snapshots remain in AsyncStorage under the `daily_activity` key (JS: `storage.saveDailyActivity`) rather than MMKV. Plans and onboarding data also remain in AsyncStorage (`blocking_plans`, `onboarding_complete`, etc.).

- **Where historical truth lives today (important):** Android persists session history and daily totals to **Room** (sessions + daily_totals). AsyncStorage `daily_activity` exists as a legacy format and a fallback read path in headless flows, but the current native-first implementation treats Room as the durable source of truth for completed totals.

- **Runtime snapshot model (current):** There is no single `live:activePlanSnapshot` JSON blob in MMKV. Instead the native side reads a small set of typed keys (`blocked_count`, `goal_*`, `is_auto_tracking`, today's totals) and the JS side emits `PLANS_CHANGED_EVENT` to coordinate plan changes. AppBlocker receives config over the native bridge.

- **Write frequency vs debounce:** The TrackingService currently writes MMKV on each location/fix (high-frequency, often 1–2Hz) to keep notifications and the UI realtime-synced. The plan's suggestion to debounce (2–5s) is a recommendation; current code intentionally uses an unthrottled fast-path because MMKV writes are C++ mmap-backed and low-overhead. The code also pre-encodes numeric keys on init to avoid decode errors.

- **JS initialization and double-count protection:** `useTracking` intentionally avoids reading `today_distance_meters` at init when a session may be active (to prevent double-counting). Instead it relies on `Tracking.getIsAutoTracking()` and `Tracking.getProgress()` to recover live session state, or reads MMKV after a session stops to obtain the completed baseline.

- **Rollover handling:** Rollover logic for daily counters exists on the Kotlin side (`MMKVStore.accumulateTodayDistance()` and `setTodayElapsed()` check `current_day` and reset keys when the stored date differs). JS relies on these values for baseline reads.

### 2.1.1 Sources of Truth & Writer Responsibilities

This section is the **operational contract** that prevents double reads/writes and keeps UI + notifications consistent.

- **Distance/time (today):** Canonical totals are maintained by the **native tracking pipeline**. MMKV stores a *projection* of those totals for fast multi-process reads.
- **Distance/time (history):** Canonical historical sessions/daily totals are stored in **Room** (Android). This is the preferred source for charting/metrics.
- **MMKV usage:** MMKV is used as a **fast, synchronous shared state** for:
   - Today's totals and flags (distance/time/goalReached/isAutoTracking)
   - Aggregated plan/goal metadata required by notifications
   - Fast blocker summary values (e.g., blocked app count)
- **JS responsibilities:** JS owns plan aggregation and writes *plan/goal metadata* keys. JS should not accumulate distance/time deltas; it may only perform **monotonic repair/hydration** when re-syncing.

### 2.1.2 MMKV Key Contract (Ownership & Types)

**Native-owned (authoritative writer; projected as absolute totals):**

- `current_day` (String `YYYY-MM-DD`) — day rollover gate
- `today_distance_meters` (Double)
- `today_elapsed_seconds` (Long)
- `today_goals_reached` (Boolean)
- `is_auto_tracking` (Boolean)

**JS-owned (plan + goal aggregation; consumed by native notifications):**

- `goal_type`, `goal_value`, `goal_unit` (strings/numbers)
- `goal_distance_value`, `goal_distance_unit`, `goal_time_value`, `goal_time_unit` (typed goal keys)
- `plan_day` (String `YYYY-MM-DD`), `plan_active_today` (Boolean)

**Mixed / integration keys (must remain safe + small):**

- `blocked_count` (Int) — written by native blocker/config code, derived from JS-provided list
- `idle_monitoring_enabled` (Boolean) — used to coordinate background/idle monitoring

> Best practice: treat MMKV as the *shared projection layer*. The moment a key becomes a “second accumulator,” double-writing bugs become likely.

### 2.1.3 Foreground 1Hz Tick Model (Non-persisted UI Tick)

To preserve the current Home screen behavior (1 Hz elapsed tick) **without introducing double writes**, the UI should follow this rule:

- When tracking is active and the app is in the foreground, **displayed elapsed time can tick at 1 Hz**, but that tick must be **derived from a native-provided anchor snapshot** (baseline + timestamp) rather than incrementing persisted totals.
- Persisted elapsed seconds in MMKV continues to be written by native tracking; JS should not attempt to “keep MMKV updated every second.”

### 2.1.4 No Double Reads / No Out-of-sync Presentation (Strategies)

These are the key best-practice strategies already present in the repo and should be preserved:

- **Avoid baseline reads during an active session:** if tracking is active, UI state should come from the native session state/anchor, not from re-reading today totals (prevents double-counting and flicker).
- **Monotonic merge (never decrease):** when syncing from MMKV/Room into UI, merge by taking the maximum distance/time observed and OR-ing goalReached.
- **Stop-grace + resync:** after a stop event, wait a short grace window before reading today totals to avoid races where native has not yet projected the final totals into MMKV.

### 2.1.5 No Double Writes (Single-accumulator Invariant)

The app must maintain a single-accumulator invariant for distance/time:

- **Only the native tracking pipeline accumulates distance/time deltas.**
- Any JS write-back into MMKV for today totals must be treated as **repair/hydration only**:
   - Never add deltas.
   - Never decrease totals.
   - Prefer max/OR merge semantics.

### 2.1.6 Room Persistence Model (Charting-friendly History)

Current Android implementation uses Room as the durable history layer:

- **Sessions table:** per-session records (start/end/mode/distance/elapsed), enabling accurate per-day reconstruction.
- **Daily totals table:** per-day aggregates (distance/time/goalsReached and related metadata).

This aligns naturally with charting requirements (daily/weekly/monthly ranges) without requiring MMKV `metrics:*` keys yet.

### 2.1.7 Charting Readiness (Metrics Mapping + Gaps)

The charting plan (`charting-implementation.md`) assumes time-bucketed `metrics:*` keys in MMKV. The current repo instead has:

- **Today (fast UI/notification):** MMKV typed keys in `touchgrass_state`
- **History (metrics/charting):** Room daily totals + sessions

Mapping charting metrics → current storage:

- `distanceMeters` → Room daily totals (authoritative); MMKV `today_distance_meters` (today only)
- `elapsedSeconds` → Room daily totals (authoritative); MMKV `today_elapsed_seconds` (today only)
- `goalsReached` → Room daily totals + MMKV `today_goals_reached`
- `sessions` → Room sessions table exists; ensure daily session counting is reliable (either compute from sessions by date, or store an incremented `sessionCount` in daily totals)

Metrics that are **not stored yet** (required by the charting plan, but charting is deferred):

- `focusMinutes` — can be derived from tracked time only if “focus == active tracking time”; otherwise needs a dedicated field or event model
- `blockedAttempts` — needs an event/counter persisted by the blocker layer
- `unlockEvents` — needs an event/counter definition and persistence

Recommended future-safe storage structure (no charting implementation required now):

- Treat Room as the canonical history layer and add fields (or a companion table) for: `focusSeconds`, `blockedAttempts`, `unlockEvents`.
- If you later want MMKV `metrics:*` for cross-platform parity or cloud sync, generate it as **derived snapshots** from Room (write-once per day), not as a second live accumulator.

Notes / Implications:

- The current implementation already matches the plan's core requirement: a native-first, synchronous MMKV fast-path for today's totals and flags. However, the plan's multi-namespace proposal (e.g., `metrics:daily:YYYY-MM-DD`, `live:progress` as separate namespace files) is not present — the app uses one MMKV id and typed keys plus AsyncStorage for historical lists.

- If you want to migrate daily snapshots and rolling aggregates into MMKV (to match the time-bucketed key design), add a migration step that writes `metrics:daily:YYYY-MM-DD` entries into MMKV or a secondary MMKV file, and keep `touchgrass_state` for fast counters and flags.

- Because the app intentionally writes high-frequency MMKV updates from the native TrackingService, the plan should record that unthrottled writes are acceptable in this implementation but note performance testing and a configurable throttle should be kept as an option.


## 3️⃣ Data Flow & Operational Details

1. **Session Start / Motion Detected:**

   * Native service initiates tracking and begins updating canonical session state.
   * Native projects absolute totals into MMKV (`today_distance_meters`, `today_elapsed_seconds`, flags) for fast reads.

2. **During Session:**

   * Native updates MMKV frequently (fast-path) to keep UI + notifications in sync.
   * JS UI uses native progress/anchor state for real-time display and uses MMKV primarily as a baseline projection.

3. **Session End / Goal Completion:**

   * Native finalizes session persistence to Room and projects the final totals into MMKV.
   * JS performs a post-stop resync (after a short grace window) and merges monotonic totals.

4. **Plan Changes:**

   * JS computes aggregated goals/plans and writes goal/plan keys into MMKV (`goal_*`, `plan_*`).
   * Native notification rendering reads these typed keys synchronously.

5. **Day Rollover / Midnight Handling:**

   * Native compares `current_day` and resets MMKV daily counters when day changes.
   * Historical attribution should remain canonical in Room (and can later generate `metrics:daily:*` snapshots if desired).

**Edge Cases Covered:**

* Cross-midnight plans
* Timezone & DST changes
* Plan edits mid-day
* Multiple overlapping plans
* App killed / device reboot

---

## 4️⃣ Scheduling & Blocking Logic

**Key Rules:**

* Evaluate schedules using local device time.
* Union overlapping plan windows; permanent plans override time-limited ones.
* Aggregate multiple plan criteria for goal calculation.
* Store weekday numbers explicitly to avoid locale misinterpretation.
* Day rollover triggers atomic reset of live progress and metrics.
* `blocking_until_timestamp` used for temporary or time-bound windows.

---

## 5️⃣ Real-Time UI Considerations

* **Spinner:** uses native progress/anchor state for foreground animation; uses MMKV as a baseline projection.
* **Notification:** reads today's totals + typed goal/plan keys from MMKV in multi-process mode.
* **Fast Checks:** prefer boolean/typed keys (e.g., `plan_active_today`) over scanning plan objects.
* **Goal Reached:**

  * Stops spinner animation
   * Native sets `today_goals_reached` in MMKV and persists the completed session/daily totals to Room
   * Notifications read the updated flags/totals synchronously from MMKV

**Performance Notes:**

* If you implement a runtime snapshot blob later, keep it small (<1KB).
* Debounce writes only if performance testing indicates it is necessary; current repo intentionally uses a native fast-path update strategy.

---

## 6️⃣ Performance & Reliability Best Practices

* **Synchronous first:** Native services read MMKV directly; JS reads are secondary.
* **Batch updates (optional):** Update MMKV every 2–5 seconds only if needed; the current implementation uses high-frequency updates for realtime UI/notifications.
* **Rolling aggregates:** Precompute `7d`, `30d` totals to reduce live summation.
* **Atomic updates:** Day rollover and goal completion should be atomic to prevent inconsistencies.
* **Snapshot versioning:** Optional `snapshotVersion` key for migration and schema validation.

### 6.1 Compatibility / Non-regression Requirements

These are explicit non-regression requirements based on current behavior:

1. **Home screen elapsed time ticks at 1 Hz while foreground**

   - The UI may tick displayed elapsed time at 1 Hz, but it must be derived from a native anchor snapshot (baseline + timestamp) and must not become a second writer/accumulator.

2. **Single-accumulator invariant for distance/time**

   - Only native tracking accumulates distance/time deltas.
   - Any JS write-back is hydration-only and must be monotonic (max/OR), never additive.

3. **No out-of-sync presentation**

   - Avoid baseline reads during an active session.
   - Use stop-grace + post-stop resync to avoid race conditions.

---

## 7️⃣ Future-Proofing

* **Cloud sync:** Sync daily snapshots and events. Rolling aggregates can be rebuilt offline.
* **Event logs:** Append-only structure allows advanced analytics or ML without affecting live state.
* **Retention strategy:**

  * Daily snapshots: 90 days
  * Rolling aggregates: 365 days
  * Monthly summaries: indefinitely
* **Schema stability:** Fixed keys for daily snapshots reduce migration complexity.

---

## 8️⃣ Implementation Order (Phase-Based)

**Phase 1: Core functionality**

* MMKV setup and multi-process configuration
* Typed MMKV key projection for today totals + flags (`touchgrass_state`)
* Foreground 1 Hz elapsed tick derived from native anchor (UI-only; no per-second persistence writes)
* Background tracking & notifications
* Real-time spinner updates

**Phase 2: Historical metrics**

* Room-backed daily totals + session history as canonical charting source
* (Optional, target) Derived daily snapshots (`metrics:daily:YYYY-MM-DD`) for portability/cloud sync
* (Optional, target) Date index + rolling aggregates (`metrics:index:daily`, `metrics:rolling:*`)

**Phase 3: Future extensions**

* Cloud sync
* Optional event log (`event:timestamp`)
* Gamification / ML predictions

---

## 9️⃣ Developer Best Practices

* Keep storage logic decoupled from UI components.
* Use memoized selectors for derived metrics.
* Handle all edge cases:

  * Midnight rollover
  * DST/timezone changes
  * Mid-day plan edits
  * Multiple overlapping plans
  * App killed or rebooted
* Foreground service for reliable background updates.
* Debounce high-frequency writes and avoid large synchronous loops.
* Version runtime snapshot to detect schema mismatches between JS & native.

---

## 🔑 Summary

* **Source of truth:** Native tracking pipeline (today) + Room (history)
* **Today’s fast projection:** `touchgrass_state` MMKV typed keys → realtime UI baselines & notifications
* **Plan/goal sync:** JS computes aggregated goal/plan keys → native reads synchronously for notifications
* **Daily Metrics (future keyspace):** `metrics:daily:YYYY-MM-DD` → optional derived snapshots for portability/cloud sync
* **Rolling Aggregates & Monthly Summaries:** Precomputed for efficient queries
* **Optional Event Log:** Future analytics, ML readiness
* **Plan Changes:** JS writes typed goal/plan keys; avoids making distance/time a JS accumulator
* **Day Rollover:** Native resets MMKV day counters using `current_day`; Room remains canonical for history
* **Best Practices:** Monotonic merges, stop-grace resync, native-first reads, preserve 1Hz foreground tick

---

This expanded version contains **all actionable details, schemas, flow logic, edge cases, and performance considerations** so an LLM or developer can implement the **full TouchGrass data and runtime foundation** without ambiguity, **charting deferred for future work**.