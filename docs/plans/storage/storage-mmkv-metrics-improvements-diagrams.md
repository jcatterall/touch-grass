# 🏗 Full Architectural Plan: TouchGrass (Updated with Diagrams, Charting Deferred)

---

## 1️⃣ Core Principles

*(Same as previous, unchanged)*

* Two layers of data: **live state** and **immutable daily snapshots**
* MMKV as primary storage, AsyncStorage deprecated
* Pre-aggregate data, time-bucketed keys, runtime snapshots
* Event logs optional, future-proofing, and performance considerations

---

## 2️⃣ Storage Design with Diagrams

### A. MMKV Namespaces Overview

```
+-------------------------------------------+
| MMKV Namespaces                           |
+-------------------+-----------------------+
| touchgrass_state  | Today’s totals        |
|                   | - today_distance_m   |
|                   | - today_elapsed_sec  |
|                   | - goal_reached_today |
|                   | - is_auto_tracking  |
+-------------------+-----------------------+
| live:progress     | Real-time progress    |
|                   | - date               |
|                   | - distanceMeters     |
|                   | - timeSeconds        |
|                   | - goal info          |
+-------------------+-----------------------+
| live:activePlanSn | Runtime snapshot      |
| apshot            | - active_plan_ids    |
|                   | - has_active_plans   |
|                   | - blocked_apps       |
|                   | - blocking_active    |
|                   | - goal_type/value    |
+-------------------+-----------------------+
| metrics:daily:*   | Daily aggregates      |
|                   | - distanceMeters     |
|                   | - elapsedSeconds     |
|                   | - sessions           |
|                   | - focusMinutes       |
|                   | - blockedAttempts    |
|                   | - unlockEvents       |
|                   | - goalsReached       |
+-------------------+-----------------------+
| metrics:index:daily| Index of dates        |
+-------------------+-----------------------+
| metrics:rolling:* | Rolling aggregates    |
+-------------------+-----------------------+
| metrics:monthly:* | Monthly summaries     |
+-------------------+-----------------------+
| event:*           | Optional event logs   |
+-------------------+-----------------------+
```

**Notes:**

* `live:activePlanSnapshot` includes `has_active_plans` for fast evaluation.
* Rolling and monthly aggregates precompute sums to avoid repeated calculation.

---

## 2.1 Current Implementation Mapping (repo-specific)

This section maps the diagrammed architecture to the current TouchGrass repository and highlights practical differences.

- **Single MMKV file:** The app uses one MMKV instance with id `touchgrass_state` (Kotlin: `MMKV.mmkvWithID("touchgrass_state", MMKV.MULTI_PROCESS_MODE)`, JS: `new MMKV({ id: 'touchgrass_state', mode: Mode.MULTI_PROCESS })`). Namespaced MMKV files are not currently used.

- **Key set implemented today:**
       - `current_day` — YYYY-MM-DD (Kotlin uses this for rollover)
       - `today_distance_meters` — Double
       - `today_elapsed_seconds` — Long
       - `today_goals_reached` — Boolean
       - `is_auto_tracking` — Boolean
       - `goal_type`, `goal_value`, `goal_unit` — aggregated goal metadata (written by JS `fastStorage.setGoal`)
       - `blocked_count` — Int (AppBlocker fast-path)

- **Historical storage:** Daily/immutable snapshots and plan lists are kept in AsyncStorage (`daily_activity`, `blocking_plans`, `onboarding_complete`) rather than MMKV. JS `storage.saveDailyActivity()` persists day-level lists to AsyncStorage today.

- **Runtime snapshot behaviour (current):** There is no single `live:activePlanSnapshot` JSON blob in MMKV. Instead, JS emits `PLANS_CHANGED_EVENT` and writes individual goal/blocked-count keys; native services read typed keys and receive blocker config via the native bridge when needed.

- **Write frequency tradeoff:** The TrackingService writes MMKV frequently (on each GPS fix) to keep notification and UI realtime; Kotlin pre-encodes numeric keys at init to avoid decode buffer issues. The diagram recommendation to debounce writes (2–5s) is optional — current code favors immediacy and assumes MMKV can handle the load.

- **JS double-count protection & restore flow:** `useTracking` avoids reading MMKV today's totals at boot when a session may be active. It uses `Tracking.getIsAutoTracking()` + `Tracking.getProgress()` to obtain live session state and reads MMKV for baseline only when not tracking or after stop events.

- **Day rollover:** Implemented in `MMKVStore.accumulateTodayDistance()` and `setTodayElapsed()` by comparing `current_day`; the native side resets typed counters when the stored day differs from today's date.

Implication: the diagrams remain a useful blueprint, but the repo uses a simpler, typed-key approach on a single MMKV id plus AsyncStorage for historical lists. Consider one of the following migration options if you want the diagram's namespaced key model implemented:

- Migrate daily snapshots into MMKV (`metrics:daily:YYYY-MM-DD`) via a one-off migration that writes to a new MMKV id or encodes date-keyed JSON strings.
- Keep `touchgrass_state` for fast counters and introduce a second MMKV id for `metrics` to avoid mixing high-frequency and historical keys.
- Add an optional configurable throttle for TrackingService MMKV writes and validate performance on target devices.


### B. Runtime Snapshot Diagram

```
live:activePlanSnapshot (MMKV)
+--------------------------------------------+
| active_plan_ids: ["plan1","plan2"]        |
| has_active_plans: true                     |
| blocked_apps: ["Facebook","TikTok"]       |
| blocking_active: true                      |
| goal_type: "distance"                      |
| goal_value: 5000                           |
| goal_unit: "m"                             |
| goal_reached_today: false                  |
| blocking_until_timestamp?: 1677542400     |
+--------------------------------------------+
```

**Purpose:**

* Quick synchronous reads for native services.
* Native services can check `has_active_plans` first, then decide whether to evaluate plan logic.

---

### C. Live Progress Diagram

```
live:progress (MMKV)
+--------------------------------------------+
| date: "2026-02-22"                        |
| distanceMeters: 1200                       |
| timeSeconds: 600                            |
| goalDistanceMeters: 1500                   |
| goalTimeSeconds: 900                        |
| goalType: "distance"                        |
| active: true                                |
| lastUpdated: 1677541800                     |
+--------------------------------------------+
```

**Use Cases:**

* Home screen spinner
* Background notifications
* Immediate user feedback

---

### D. Daily Metrics Diagram

```
metrics:daily:2026-02-22 (MMKV)
+--------------------------------------------+
| distanceMeters: 1200                       |
| elapsedSeconds: 600                         |
| sessions: 1                                 |
| focusMinutes: 10                            |
| blockedAttempts: 3                           |
| unlockEvents: 1                              |
| goalsReached: false                          |
+--------------------------------------------+
```

**Notes:**

* Immutable per day.
* Aggregated from `live:progress` at session end or day rollover.

---

## 3️⃣ Data Flow Diagram

```
+-----------------------+       +------------------+       +----------------------+
| Motion Detected /     | ----> | Native Service   | ----> | MMKV Live Storage    |
| Session Start         |       | Updates:         |       | - live:progress      |
|                       |       | - touchgrass_state|       | - live:activePlanSnap|
+-----------------------+       +------------------+       +----------------------+
                                               |
                                               v
                                        +-----------------+
                                        | Home UI Spinner  |
                                        | & Notifications  |
                                        | Reads live keys  |
                                        +-----------------+
                                               |
                                               v
                                        +-----------------+
                                        | Day End / Goal  |
                                        | Merge to metrics|
                                        | - metrics:daily |
                                        | - metrics:rolling|
                                        +-----------------+
```

**Notes:**

* Live updates occur every 1–2 seconds.
* Day rollover is atomic to prevent data corruption.
* Runtime snapshot ensures services enforce blocking without scanning full plan objects.

---

## 4️⃣ Scheduling & Blocking Logic

*(Same as prior plan, includes cross-midnight, DST, overlapping plans, union windows, plan edits mid-day, day rollover, `blocking_until_timestamp` usage.)*

---

## 5️⃣ Real-Time UI Considerations

*(Same as prior plan, emphasizing `has_active_plans` for fast evaluation.)*

---

## 6️⃣ Performance & Reliability Best Practices

* Native-first MMKV reads
* Debounce writes (2–5 sec)
* Precompute rolling aggregates
* Atomic updates at day rollover
* Snapshot versioning for JS/native sync
* Avoid AsyncStorage for runtime-critical data

---

## 7️⃣ Future-Proofing

* Cloud sync (daily snapshots & events)
* Optional append-only event logs
* Retention: 90-day daily, 365-day rolling, monthly indefinite
* Fixed schemas for stability

---

## 8️⃣ Implementation Order

**Phase 1:** Core functionality

* MMKV setup
* Live progress storage
* Runtime snapshot (with `has_active_plans`)
* Background tracking & notifications
* Real-time spinner

**Phase 2:** Historical metrics

* Daily snapshots
* Date index
* Rolling aggregates

**Phase 3:** Future extensions

* Cloud sync
* Optional event log
* Gamification / ML

---

## 9️⃣ Developer Best Practices

* Decouple storage from UI
* Precompute rolling metrics
* Test all edge cases (midnight rollover, DST, plan edits, overlapping plans, app killed/rebooted)
* Foreground service for reliable background updates
* Debounce high-frequency writes, avoid heavy synchronous loops
* Version runtime snapshot for schema detection

---

## 🔑 Summary

* **Live Progress:** `live:progress` → spinner & notifications
* **Runtime Snapshot:** `live:activePlanSnapshot` → fast blocking decisions, `has_active_plans`
* **Today’s Counters:** `touchgrass_state` → atomic counters
* **Daily Metrics:** `metrics:daily:YYYY-MM-DD` → immutable snapshots
* **Rolling & Monthly Aggregates:** Precomputed for efficient queries
* **Optional Event Log:** For future analytics
* **Plan Changes:** JS updates aggregated goals & snapshot
* **Day Rollover:** Reset live progress, finalize metrics

---