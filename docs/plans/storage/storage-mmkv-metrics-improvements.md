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

| Namespace                    | Purpose                                                                                             |       |                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------- |
| `touchgrass_state`           | Synchronous counters for today's totals: distance, elapsed time, goal reached, auto-tracking flags. |       |                                                                 |
| `live:progress`              | Real-time progress for spinner & notification updates.                                              |       |                                                                 |
| `live:activePlanSnapshot`    | Snapshot of currently active plans (includes `has_active_plans`, blocked apps, goal info).          |       |                                                                 |
| `metrics:daily:YYYY-MM-DD`   | Immutable daily metrics.                                                                            |       |                                                                 |
| `metrics:index:daily`        | Index of available daily metric dates for fast range queries.                                       |       |                                                                 |
| `metrics:rolling:7d          | 30d                                                                                                 | 365d` | Precomputed aggregates for efficient summary queries over time. |
| `metrics:monthly:YYYY-MM`    | Monthly summaries for long-term retention and efficiency.                                           |       |                                                                 |
| `event:timestamp` (optional) | Append-only events: focus sessions, unlocks, blocked attempts, session start/end.                   |       |                                                                 |

**Considerations:**

* Multi-process mode ensures JS, foreground, and background services always see consistent data.
* Runtime snapshot keys are small, atomic, and quickly read/writable for high-frequency access.

---

### B. Runtime Snapshot Keys

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

## 3️⃣ Data Flow & Operational Details

1. **Session Start / Motion Detected:**

   * Native service initiates tracking, sets `live:progress.active = true`.
   * Updates runtime snapshot if needed.

2. **During Session:**

   * Native service updates:

     * `touchgrass_state` for fast counters
     * `live:progress` every few seconds
   * JS UI reads `live:progress` for spinner / notification updates.

3. **Session End / Goal Completion:**

   * Merge `live:progress` into `metrics:daily:YYYY-MM-DD`.
   * Update rolling aggregates.
   * Reset `live:progress` for next session.
   * Update `goal_reached_today` in runtime snapshot.

4. **Plan Changes:**

   * JS computes aggregated goals.
   * Updates runtime snapshot (`live:activePlanSnapshot`) including `has_active_plans`.
   * Native services instantly enforce blocking rules.

5. **Day Rollover / Midnight Handling:**

   * Finalize previous day's `metrics:daily`.
   * Reset `touchgrass_state` counters and `live:progress`.
   * Update `current_day` key for consistent reads.

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

* **Spinner:** reads `live:progress` every 1–2 seconds.
* **Notification:** background service reads `live:progress`.
* **Fast Checks:** `has_active_plans` prevents unnecessary plan iteration.
* **Goal Reached:**

  * Stops spinner animation
  * Updates runtime snapshot
  * Updates `touchgrass_state` counters

**Performance Notes:**

* Keep runtime snapshot small (<1KB).
* Debounce writes to avoid high-frequency MMKV disk writes.

---

## 6️⃣ Performance & Reliability Best Practices

* **Synchronous first:** Native services read MMKV directly; JS reads are secondary.
* **Batch updates:** Update MMKV every 2–5 seconds to reduce I/O.
* **Rolling aggregates:** Precompute `7d`, `30d` totals to reduce live summation.
* **Atomic updates:** Day rollover and goal completion should be atomic to prevent inconsistencies.
* **Snapshot versioning:** Optional `snapshotVersion` key for migration and schema validation.

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
* Live progress storage (`live:progress`)
* Runtime snapshot (`live:activePlanSnapshot` with `has_active_plans`)
* Background tracking & notifications
* Real-time spinner updates

**Phase 2: Historical metrics**

* Daily snapshots (`metrics:daily:YYYY-MM-DD`)
* Date index (`metrics:index:daily`)
* Rolling aggregates (`metrics:rolling`)

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

* **Live Progress:** `live:progress` → real-time spinner & notifications
* **Runtime Snapshot:** `live:activePlanSnapshot` → blocking decisions & fast evaluation, includes `has_active_plans`
* **Today’s Counters:** `touchgrass_state` → atomic counters for native reads
* **Daily Metrics:** `metrics:daily:YYYY-MM-DD` → immutable snapshots for historical insights
* **Rolling Aggregates & Monthly Summaries:** Precomputed for efficient queries
* **Optional Event Log:** Future analytics, ML readiness
* **Plan Changes:** JS computes aggregated goal and updates runtime snapshot
* **Day Rollover:** Reset live progress, finalize daily metrics
* **Best Practices:** Atomic updates, stable schema, native-first reads, memoized selectors, debounced writes

---

This expanded version contains **all actionable details, schemas, flow logic, edge cases, and performance considerations** so an LLM or developer can implement the **full TouchGrass data and runtime foundation** without ambiguity, **charting deferred for future work**.