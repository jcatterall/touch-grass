# Plan: Integrating Tracking Service with MMKV Storage

**Date:** February 20, 2026  
**Status:** Integration Planning  
**Scope:** Synchronizing activity tracking persistence across TrackingService and existing MMKV storage layer

---

## 📋 Overview

The new activity tracking service (motion-driven, activity-aware, GPS-based) must persist all session data (distance, elapsed time, goals) to MMKV to enable recovery and display when the app terminates and reopens. This plan integrates the TrackingService with the existing `fastStorage` MMKV layer **with minimal disruption to storage.ts and useTracking.ts**.

**Key Principle:** Make MMKV the single source of truth for today's accumulated totals. The TrackingService updates MMKV on every progress tick; the JS layer reads from MMKV for display and recovery.

---

## 🎯 Goals

1. ✅ **Persist daily totals** (distance, elapsed, goals) across app restart
2. ✅ **Enable crash recovery** within ~1 hour without UI code changes
3. ✅ **Maintain existing fastStorage API** — no breaking changes to `useTracking.ts`
4. ✅ **Minimize storage.ts changes** — add only session-state helpers
5. ✅ **Decouple JS from persistence details** — TrackingService owns MMKV writes
6. ✅ **Support offline tracking** — all data available without connectivity

---

## 📦 Current State Analysis

### Existing MMKV Usage (storage.ts)
```typescript
// fastStorage exports (read-only from JS)
_mmkv.getNumber('today_distance_meters')      // Double
_mmkv.getNumber('today_elapsed_seconds')      // Long
_mmkv.getBoolean('today_goals_reached')       // Boolean
_mmkv.getBoolean('is_auto_tracking')          // Boolean

// Goal metadata (written by JS, read by TrackingService)
_mmkv.set('goal_type', type)                  // 'distance' | 'time' | 'none'
_mmkv.set('goal_value', value)                // number
_mmkv.set('goal_unit', unit)                  // string
```

### Existing Tracking.ts Export (Native Bridge)
```typescript
// Events emitted to JS
onProgress(callback)      // { distanceMeters, elapsedSeconds, goalReached }
onGoalReached(callback)
onTrackingStarted(callback)
onTrackingStopped(callback)

// Query methods
getProgress()             // Current session state
getUnsavedSession()       // Last session before close
getDailyTotalNative()     // Today's Room totals (if using Room)
getIsAutoTracking()       // From MMKV is_auto_tracking flag
```

### Existing useTracking.ts Pattern (JS State)
```typescript
// Session state held in JS (React state)
const [dailyBaseline, setDailyBaseline] = useState(...)  // Ended sessions
const [sessionProgress, setSessionProgress] = useState()  // Current session
const [allGoalsReached, setAllGoalsReached] = useState()

// On progress event from native:
// - Update sessionProgress
// - Check if allGoalsReached
// - Update daily totals on tracking stop

// On app reopen:
// - Call getProgress() to recover session state
// - Call getDailyTotalNative() if available
```

---

## 🏗️ Integration Strategy

### Phase 1: Extend MMKV Schema (Minimal)

**File:** `src/storage/index.ts`

Add **session state keys** to MMKV for crash recovery only. These are **ephemeral** (cleared on session stop, or ignored if > 1 hour old).

```typescript
// Existing daily totals (unchanged)
'today_distance_meters'       // Double — today's accumulated distance
'today_elapsed_seconds'       // Long — today's accumulated time
'today_goals_reached'         // Boolean
'is_auto_tracking'            // Boolean

// NEW: Session state (ephemeral, for crash recovery)
'session_active'              // Boolean — is a session currently running?
'session_start_time_ms'       // Long — when did this session start?
'session_distance_meters'     // Double — distance in current session
'session_elapsed_seconds'     // Long — elapsed in current session
'session_last_update_ms'      // Long — last time we updated session state
'current_day'                 // String (YYYY-MM-DD) — to detect day rollover
```

**Addition to fastStorage (read-only):**
```typescript
export const fastStorage = {
  // ... existing methods ...
  
  // Session state queries (read-only for JS)
  getSessionActive: (): boolean => _mmkv.getBoolean('session_active') ?? false,
  getSessionStartTimeMs: (): number => _mmkv.getNumber('session_start_time_ms') ?? 0,
  getSessionDistance: (): number => _mmkv.getNumber('session_distance_meters') ?? 0,
  getSessionElapsed: (): number => _mmkv.getNumber('session_elapsed_seconds') ?? 0,
  getSessionLastUpdateMs: (): number => _mmkv.getNumber('session_last_update_ms') ?? 0,
};
```

**Rationale:**
- Session keys are optional; JS reads them only at app startup for recovery
- TrackingService (native) owns all writes to session keys
- JS layer can safely ignore session keys if not needed
- Minimal storage footprint: 5 additional MMKV entries

---

### Phase 2: Extend TrackingService to Write MMKV

**File:** `android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt`

The TrackingService updates MMKV on every state change. This ensures JS can read live totals anytime.

#### 2a. On Session Start

```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
  // ... existing logic ...

  if (shouldStartNewSession) {
    // Write session init to MMKV
    MMKVStore.setSessionActive(true)
    MMKVStore.setSessionStartTime(System.currentTimeMillis())
    MMKVStore.setSessionDistance(0.0)
    MMKVStore.setSessionElapsed(0)
    MMKVStore.setSessionLastUpdate(System.currentTimeMillis())
    MMKVStore.setCurrentDay(getTodayDate()) // YYYY-MM-DD
    
    Log.d(TAG, "Session started, writing to MMKV")
  }
  
  return START_STICKY
}
```

#### 2b. On Progress Update (Every Location or Elapsed Tick)

```kotlin
// In handleStateChange() or handleLocationUpdate():
override fun handleStateChange(state: TrackingState) {
  // ... existing distance/elapsed accumulation ...

  // Write current session state to MMKV (non-blocking)
  MMKVStore.setSessionDistance(state.sessionDistanceMeters)
  MMKVStore.setSessionElapsed(state.sessionElapsedSeconds)
  MMKVStore.setSessionLastUpdate(System.currentTimeMillis())

  // Also write today's totals (accumulated across all sessions)
  // IMPORTANT: TrackingService maintains this, not JS
  MMKVStore.setTodayDistance(state.todayDistanceMeters)
  MMKVStore.setTodayElapsed(state.todayElapsedSeconds)
  MMKVStore.setGoalsReached(state.allGoalsReached)

  // Emit to JS (unchanged)
  emitProgressToJS(state)
}
```

#### 2c. On Session Stop

```kotlin
override fun stopTracking() {
  // ... existing cleanup ...

  // Flush final totals to MMKV
  MMKVStore.setTodayDistance(state.todayDistanceMeters)
  MMKVStore.setTodayElapsed(state.todayElapsedSeconds)
  MMKVStore.setGoalsReached(state.allGoalsReached)

  // Clear session ephemeral state
  MMKVStore.clearSessionState() // clears session_active, session_distance, etc.

  Log.d(TAG, "Session stopped, final totals persisted to MMKV")
}
```

#### 2d. On Day Boundary Rollover (Midnight)

```kotlin
// Check in handleStateChange() or via a scheduled task:
fun checkDayRollover() {
  val storedDay = MMKVStore.getCurrentDay()
  val todayDate = getTodayDate() // "YYYY-MM-DD"
  
  if (storedDay != todayDate) {
    Log.i(TAG, "Day boundary crossed: $storedDay -> $todayDate")
    // Reset daily counters
    MMKVStore.setTodayDistance(0.0)
    MMKVStore.setTodayElapsed(0)
    MMKVStore.setGoalsReached(false)
    MMKVStore.setCurrentDay(todayDate)
  }
}
```

**Rationale:**
- MMKV writes are synchronous and blazingly fast (mmap-backed)
- Writing on every progress update ensures JS always sees fresh data
- Session state persists for crash recovery; cleared on clean stop
- Daily totals survive app termination and can be read immediately on restart

---

### Phase 3: Add Helpers to MMKVStore (Kotlin Side)

**File:** `android/app/src/main/java/com/touchgrass/storage/MMKVStore.kt`

Add wrapper methods to encapsulate MMKV session-state keys. This keeps TrackingService code clean and centralizes persistence logic.

```kotlin
object MMKVStore {

  private const val KEY_SESSION_ACTIVE = "session_active"
  private const val KEY_SESSION_START_TIME_MS = "session_start_time_ms"
  private const val KEY_SESSION_DISTANCE_METERS = "session_distance_meters"
  private const val KEY_SESSION_ELAPSED_SECONDS = "session_elapsed_seconds"
  private const val KEY_SESSION_LAST_UPDATE_MS = "session_last_update_ms"
  private const val KEY_CURRENT_DAY = "current_day"

  // Existing daily totals (unchanged)
  // - today_distance_meters
  // - today_elapsed_seconds
  // - today_goals_reached
  // - is_auto_tracking
  // - goal_type, goal_value, goal_unit

  // Session state: write
  fun setSessionActive(active: Boolean) {
    _store.putBoolean(KEY_SESSION_ACTIVE, active)
  }

  fun setSessionStartTime(timeMs: Long) {
    _store.putLong(KEY_SESSION_START_TIME_MS, timeMs)
  }

  fun setSessionDistance(meters: Double) {
    _store.putDouble(KEY_SESSION_DISTANCE_METERS, meters)
  }

  fun setSessionElapsed(seconds: Long) {
    _store.putLong(KEY_SESSION_ELAPSED_SECONDS, seconds)
  }

  fun setSessionLastUpdate(timeMs: Long) {
    _store.putLong(KEY_SESSION_LAST_UPDATE_MS, timeMs)
  }

  fun setCurrentDay(dateStr: String) { // "YYYY-MM-DD"
    _store.putString(KEY_CURRENT_DAY, dateStr)
  }

  // Session state: read
  fun isSessionActive(): Boolean {
    return _store.getBoolean(KEY_SESSION_ACTIVE, false)
  }

  fun getSessionStartTime(): Long {
    return _store.getLong(KEY_SESSION_START_TIME_MS, 0L)
  }

  fun getSessionDistance(): Double {
    return _store.getDouble(KEY_SESSION_DISTANCE_METERS, 0.0)
  }

  fun getSessionElapsed(): Long {
    return _store.getLong(KEY_SESSION_ELAPSED_SECONDS, 0L)
  }

  fun getSessionLastUpdate(): Long {
    return _store.getLong(KEY_SESSION_LAST_UPDATE_MS, 0L)
  }

  fun getCurrentDay(): String {
    return _store.getString(KEY_CURRENT_DAY, "")
  }

  // Helpers
  fun clearSessionState() {
    _store.putBoolean(KEY_SESSION_ACTIVE, false)
    _store.putLong(KEY_SESSION_START_TIME_MS, 0L)
    _store.putDouble(KEY_SESSION_DISTANCE_METERS, 0.0)
    _store.putLong(KEY_SESSION_ELAPSED_SECONDS, 0L)
    _store.putLong(KEY_SESSION_LAST_UPDATE_MS, 0L)
  }

  fun shouldResumeSession(): Boolean {
    if (!isSessionActive()) return false
    val startTime = getSessionStartTime()
    val elapsed = System.currentTimeMillis() - startTime
    // Resume only if crash happened within last 1 hour
    return elapsed < 3_600_000L // 1 hour
  }

  // Existing methods (unchanged)
  fun setTodayDistance(meters: Double) { /* ... */ }
  fun setTodayElapsed(seconds: Long) { /* ... */ }
  fun setGoalsReached(reached: Boolean) { /* ... */ }
  fun setAutoTracking(auto: Boolean) { /* ... */ }
  fun setGoal(type: String, value: Double, unit: String) { /* ... */ }
  // ... etc.
}
```

---

### Phase 4: Initialize TrackingService with Crash Recovery

**File:** `android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt`

On service creation, check if MMKV indicates an active session and attempt to resume it.

```kotlin
override fun onCreate() {
  super.onCreate()

  // Check for crash recovery
  if (MMKVStore.shouldResumeSession()) {
    val sessionDistance = MMKVStore.getSessionDistance()
    val sessionElapsed = MMKVStore.getSessionElapsed()
    val startTimeMs = MMKVStore.getSessionStartTime()
    val elapsedSinceStart = System.currentTimeMillis() - startTimeMs

    Log.i(TAG, "Recovering from crash: distance=$sessionDistance elapsed=$sessionElapsed")

    // Restore session state in TrackingController
    controller.resumeSession(
      distanceMeters = sessionDistance,
      elapsedSeconds = sessionElapsed,
      startTimeMs = startTimeMs
    )

    // Resume GPS and activity tracking
    startGpsTracking()
  }

  // Existing init logic...
}

private fun startGpsTracking() {
  // Resume GPS location updates
  // Resume activity detection subscription
  // Update notification to show resumed state
}
```

**Rationale:**
- Minimal change: single `shouldResumeSession()` check
- Preserves existing TrackingController interface
- Automatically resumes after unintended crash (within 1 hour)
- JS doesn't need to know about crash recovery

---

### Phase 4.5: Handle "No Active Plan for Today" State

**File:** `src/hooks/useTracking.ts`

When initializing or recovering tracking state, check if there are active plans for today. If no active plans exist, **do not resume or auto-start tracking**, even if a session was previously active.

```typescript
// In useTracking() initialization:
const [activePlans, setActivePlans] = useState<BlockingPlan[]>([]);

useEffect(() => {
  const loadActivePlans = async () => {
    const plans = await storage.getPlans();
    const active = findActivePlansForToday(plans);
    setActivePlans(active);
    
    // CRITICAL: If no active plans, don't resume tracking
    if (active.length === 0) {
      console.log('[useTracking] No active plans for today, skipping recovery');
      // Don't call recoverSessionIfNeeded() if no plans
      return;
    }
    
    // Only attempt recovery if we have active plans
    recoverSessionIfNeeded();
  };
  
  loadActivePlans();
}, []);

// Update goals whenever active plans change
useEffect(() => {
  const goals = aggregateGoals(activePlans);
  setGoals(goals);
  
  // Sync goal metadata to MMKV for native tracking
  if (goals.hasDistanceGoal || goals.hasTimeGoal) {
    fastStorage.setGoal(
      goals.hasDistanceGoal ? 'distance' : goals.hasTimeGoal ? 'time' : 'none',
      goals.hasDistanceGoal ? goals.totalDistanceMeters : goals.totalTimeSeconds,
      goals.hasDistanceGoal ? 'meters' : 'seconds'
    );
  }
}, [activePlans]);

function recoverSessionIfNeeded() {
  // Only recover if:
  // 1. A session is currently active in MMKV
  // 2. We have active plans for today
  // 3. Crash happened within last 1 hour
  
  if (fastStorage.getSessionActive() && activePlans.length > 0) {
    const sessionDistance = fastStorage.getSessionDistance();
    const sessionElapsed = fastStorage.getSessionElapsed();
    
    if (sessionDistance > 0 || sessionElapsed > 0) {
      console.log('[Recovery] Restoring session state (plans active)', {
        distance: sessionDistance,
        elapsed: sessionElapsed,
        plansCount: activePlans.length,
      });
      
      setSessionProgress({
        distanceMeters: sessionDistance,
        elapsedSeconds: sessionElapsed,
        goalReached: false,
      });
    }
  } else if (!activePlans.length) {
    console.log('[Recovery] Session existed but no active plans, clearing');
    // Clear any residual session state since there are no active plans
    setSessionProgress({ distanceMeters: 0, elapsedSeconds: 0, goalReached: false });
  }
}
```

**Rationale:**
- Plans are the source of truth for tracking eligibility
- Users may have disabled all plans overnight; don't auto-resume tracking
- Prevents tracking when user has explicitly paused/disabled all plans
- Sync goal metadata to MMKV so native service has correct targets

---

### Phase 5: JS Layer (Minimal Changes)

**File:** `src/storage/index.ts`

Add read-only accessors for session state. TrackingService owns all writes.

```typescript
// Add to fastStorage export
export const fastStorage = {
  // ... existing methods (UNCHANGED) ...
  getTodayDistance: (): number => _mmkv.getNumber('today_distance_meters') ?? 0,
  getTodayElapsed: (): number => _mmkv.getNumber('today_elapsed_seconds') ?? 0,
  getGoalsReached: (): boolean => _mmkv.getBoolean('today_goals_reached') ?? false,
  isAutoTracking: (): boolean => _mmkv.getBoolean('is_auto_tracking') ?? false,
  setGoal(type, value, unit) { /* ... */ },

  // NEW: Session recovery (read-only)
  getSessionActive: (): boolean => _mmkv.getBoolean('session_active') ?? false,
  getSessionDistance: (): number => _mmkv.getNumber('session_distance_meters') ?? 0,
  getSessionElapsed: (): number => _mmkv.getNumber('session_elapsed_seconds') ?? 0,
};
```

**File:** `src/hooks/useTracking.ts`

**MINIMAL changes** — add optional recovery logic on app startup and compute total daily progress.

```typescript
// In useTracking() initialization, add one-time recovery:
useEffect(() => {
  // If app just restarted and a session was active, recover it
  const recoverSessionIfNeeded = async () => {
    if (fastStorage.getSessionActive()) {
      const sessionDistance = fastStorage.getSessionDistance();
      const sessionElapsed = fastStorage.getSessionElapsed();
      
      if (sessionDistance > 0 || sessionElapsed > 0) {
        console.log('[Recovery] Restoring session state', {
          distance: sessionDistance,
          elapsed: sessionElapsed,
        });
        
        // Emit event so useTracking can update UI
        setSessionProgress({
          distanceMeters: sessionDistance,
          elapsedSeconds: sessionElapsed,
          goalReached: false, // Will be updated on next progress event
        });
      }
    }
  };

  recoverSessionIfNeeded();
}, []);

// IMPORTANT: HomeScreen and Notification Totals Display
// Display the TOTAL daily activity: accumulated sessions + current session
// This ensures users see the full day's progress at all times
function getTotalDailyProgress(sessionProgress: TrackingProgress): TrackingProgress {
  const accumulatedFromMMKV = {
    distanceMeters: fastStorage.getTodayDistance(),
    elapsedSeconds: fastStorage.getTodayElapsed(),
  };
  
  return {
    distanceMeters: accumulatedFromMMKV.distanceMeters + (isTracking ? sessionProgress.distanceMeters : 0),
    elapsedSeconds: accumulatedFromMMKV.elapsedSeconds + (isTracking ? sessionProgress.elapsedSeconds : 0),
    goalReached: fastStorage.getGoalsReached() || sessionProgress.goalReached,
  };
}
```

**Display Logic:**
- **HomeScreen Progress Totals:** Use `getTotalDailyProgress()` to show distance + elapsed from all sessions today
- **Notification Progress:** Update notification with `getTotalDailyProgress()` on each progress event
- **Goal Status:** Display goal as reached if either MMKV indicates it OR current session reached it
- **At Session Stop:** MMKV is updated with final totals, so next display read automatically reflects completed session

**Rationale:**
- `useTracking.ts` already has the pattern for progress updates
- Recovery happens silently at startup; no breaking changes
- JS continues to subscribe to native events for live updates
- If session is resumed by TrackingService, JS receives fresh progress events
- **Daily totals always reflect complete day's activity:** both finished sessions (in MMKV) and active session (in memory)

---

### Phase 6: Data Sync Verification (Optional)

**File:** `src/storage/index.ts`

Add a debug helper to verify MMKV data matches native expectations.

```typescript
/**
 * Verify MMKV keys are in sync with native layer.
 * Call this in dev/debug to ensure persistence is working.
 */
export const verifyMMKVSync = () => {
  const daily = {
    distance: _mmkv.getNumber('today_distance_meters') ?? 0,
    elapsed: _mmkv.getNumber('today_elapsed_seconds') ?? 0,
    goalsReached: _mmkv.getBoolean('today_goals_reached') ?? false,
  };

  const session = {
    active: _mmkv.getBoolean('session_active') ?? false,
    distance: _mmkv.getNumber('session_distance_meters') ?? 0,
    elapsed: _mmkv.getNumber('session_elapsed_seconds') ?? 0,
    startTimeMs: _mmkv.getNumber('session_start_time_ms') ?? 0,
  };

  const goal = {
    type: _mmkv.getString('goal_type') ?? 'none',
    value: _mmkv.getNumber('goal_value') ?? 0,
    unit: _mmkv.getString('goal_unit') ?? '',
  };

  console.log('[MMKV Sync Check]', {
    daily,
    session,
    goal,
    timestamp: new Date().toISOString(),
  });

  return { daily, session, goal };
};
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Native (Android)                              │
├─────────────────────────────────────────────────────────────────────┤
│  TrackingService                                                    │
│    ↓ onLocationUpdate()                                             │
│    ↓ onActivityUpdate()                                             │
│    ↓ handleStateChange()                                            │
│       ↓ [accumulate distance/elapsed]                              │
│       ↓ MMKVStore.setSessionDistance(...)  ◄─ Crash recovery       │
│       ↓ MMKVStore.setSessionElapsed(...)   │ breadcrumbs           │
│       ↓ MMKVStore.setSessionLastUpdate(..) │                       │
│       ↓ MMKVStore.setTodayDistance(...)    │                       │
│       ↓ MMKVStore.setTodayElapsed(...)     ◄─ Today's totals       │
│       ↓ MMKVStore.setGoalsReached(...)     │ (app restart safe)    │
│       ↓ emit(onTrackingProgress)           ────────┐               │
│    ↓ onSessionStop()                               │               │
│       ↓ [flush final totals to MMKV]              │               │
│       ↓ MMKVStore.clearSessionState()             │               │
│       ↓ emit(onTrackingStopped)                   │               │
└────────────────────────────────────────────────────┼───────────────┘
                                                    │
┌────────────────────────────────────────────────────┼───────────────┐
│                        JS (React Native)           │               │
├────────────────────────────────────────────────────┼───────────────┤
│  MMKV (fastStorage)  ◄──────────────────────────────┘               │
│    today_distance_meters (read on startup & display)               │
│    today_elapsed_seconds                                           │
│    today_goals_reached                                             │
│    session_distance_meters (optional, for recovery)                │
│    session_elapsed_seconds                                         │
│    session_active                                                  │
│       ↑ (written by native only)                                   │
│                                                                    │
│  useTracking.ts                                                    │
│    ↓ subscribe(Tracking.onProgress)                               │
│    ↓ [update sessionProgress state]                               │
│    ↓ [compute allGoalsReached]                                    │
│    ↓ [render Home screen]                                         │
│                                                                    │
│  On app reopen:                                                    │
│    ↓ fastStorage.getSessionActive()  [for crash recovery]         │
│    ↓ if true: restore sessionProgress                             │
│    ↓ subscribe to live events                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Principles

### 1. **MMKV + Session Progress = Total Daily Display**
   - **MMKV holds:** Accumulated distance/elapsed from all *completed* sessions today
   - **Session progress holds:** Distance/elapsed from *current active* session only
   - **Display to user:** Sum both → `getTotalDailyProgress()` = MMKV totals + active session progress
   - **HomeScreen & Notifications:** Always show total daily activity from this formula
   - **Example:** If user completed 5km this morning, then starts a new session and tracks 2km:
     - MMKV has: `today_distance_meters = 5000`
     - Session progress has: `distanceMeters = 2000`
     - HomeScreen displays: `5000 + 2000 = 7000` meters
   - **On session stop:** TrackingService updates MMKV, so next display automatically reflects new total

### 2. **MMKV is the Single Source of Truth for Daily Totals**
   - TrackingService writes to MMKV on every progress tick
   - JS reads from MMKV for accumulated totals (via `fastStorage.getTodayDistance()`, etc.)
   - MMKV persists across app termination
   - No double-sync between JS and native

### 2. **Session Ephemeral State is Optional for JS**
   - Session keys (`session_distance_meters`, `session_active`, etc.) are for crash recovery only
   - JS doesn't need to understand them; TrackingService handles recovery
   - If JS wants to display "resume after crash", it can read session keys, but it's not required

### 3. **Minimal Changes to JS Layer**
   - `fastStorage` API is unchanged (existing reads are still valid)
   - Add new read-only helpers for session state (if needed for UI)
   - `useTracking.ts` adds optional recovery logic on mount (one useEffect)
   - No breaking changes to existing components or screens

### 4. **TrackingService Owns All Persistence**
   - Native code is responsible for reading/writing MMKV
   - JS never writes to session keys or daily totals
   - Clear separation of concerns

### 5. **Crash Recovery is Automatic (But Plan-Aware)**
   - No JS changes required for basic crash recovery
   - TrackingService detects unfinished session at onCreate()
   - **Only resumes if active plans exist for today**
   - Resumes GPS and activity tracking automatically
   - UI updates via live progress events (unchanged)
   - If all plans are disabled, recovery is suppressed

---

## 🚫 "No Active Plan for Today" Behavior
### Plan-Aware Tracking
**Critical Rule:** Plans are the source of truth for tracking eligibility. If no active plans exist for today, tracking should **not** start, resume, or continue.

### When Plans Change
```typescript
// plans deleted, disabled, or duration expired
activePlans = findActivePlansForToday(plans)  // Returns empty array

// Behavior:
// 1. Display "No active plans for today" on HomeScreen
// 2. Hide progress card
// 3. Disable manual tracking start
// 4. Do NOT resume any background session
// 5. Store the state so it's respected on app restart
```

### Scenario: User Disables All Plans Overnight
1. User has tracking enabled; session was active at 11 PM
2. User disables all blocking plans or sets them inactive
3. App crashes at 11:30 PM; session was saved to MMKV
4. App restarts at 8 AM next day
5. **Behavior:**
   - `findActivePlansForToday()` returns empty array (no active plans today)
   - `recoverSessionIfNeeded()` checks `activePlans.length === 0`
   - Recovery is **skipped** because plans were disabled
   - Session state is cleared or ignored
   - User sees "No active plans for today"
   - No background service starts

### Scenario: Plans are Re-enabled During Active Session
1. User has active plans and is tracking
2. User manually disables all plans while tracking is active
3. **Behavior:**
   - `stopTracking()` is called automatically (or user manually stops)
   - MMKV is updated with final totals
   - Notification disappears
   - Session state is cleared
   - HomeScreen shows "No active plans"

### Implementation Validation
- [ ] Check `activePlans.length > 0` before calling `recoverSessionIfNeeded()`
- [ ] Check `activePlans.length > 0` before allowing `startManual()`
- [ ] Check `activePlans.length > 0` before emitting "tracking available" events
- [ ] Log when tracking is suppressed due to no active plans
- [ ] Test: Create plan → enable tracking → disable plan → verify tracking stops/doesn't resume

---
## � Display Requirements
### "No Active Plan for Today" State
When there are **no active blocking plans for today**, the HomeScreen should:
- Display a placeholder or disabled state for the progress card
- **Disable manual tracking start** (`startManual()` should return early or show a message)
- **Not auto-start or resume tracking** even if a session was previously active
- Show message: "No active plans for today" or similar helpful text
- Allow user to create/enable a plan to start tracking

**Implementation:**
```typescript
// In HomeScreen render:
if (activePlans.length === 0) {
  return (
    <View>
      <Text>No active plans for today</Text>
      <Text>Create or enable a plan to start tracking</Text>
      // Optionally show button to navigate to plans screen
    </View>
  );
}

// Otherwise show normal progress card with getTotalDailyProgress()
```
### HomeScreen Progress Card
The HomeScreen should display the **total activity for today**, combining:
- **Accumulated completed sessions:** Read from MMKV (`fastStorage.getTodayDistance()`, `fastStorage.getTodayElapsed()`)
- **Current session progress:** From active tracking state in `useTracking.ts`

```typescript
// Example implementation:
const totalDistance = fastStorage.getTodayDistance() + (isTracking ? sessionProgress.distanceMeters : 0);
const totalElapsed = fastStorage.getTodayElapsed() + (isTracking ? sessionProgress.elapsedSeconds : 0);
const goalReached = fastStorage.getGoalsReached() || sessionProgress.goalReached;

// Render HomeScreen with totalDistance, totalElapsed, goalReached
```

### Notification Progress
The foreground notification (shown while tracking) should display the **same total daily progress**:
- Update on each progress event
- Include accumulated + current session
- Show goal reached status if either source indicates completion

### Visual Behavior
- **Before first session:** Show 0 / 0
- **During first session:** Show accumulated (0) + session progress
- **Between sessions:** Show accumulated total
- **During second+ session:** Show accumulated (from morning) + new session progress
- **After all sessions end:** Show accumulated total for the day

---
## 🔄 Reactive Progress Updates

### Real-Time Synchronization Flow

Progress updates must flow reactively from the native TrackingService → MMKV → JS UI on **every location fix or elapsed tick**. Both the notification and HomeScreen must display the **same total daily progress** at all times.

```
Native TrackingService (Location/Elapsed Update)
  ↓
  MMKVStore.setTodayDistance(accumulated)
  MMKVStore.setTodayElapsed(accumulated)
  MMKVStore.setSessionDistance(current)
  MMKVStore.setSessionElapsed(current)
  ↓
  emit(onTrackingProgress, {distanceMeters, elapsedSeconds, goalReached})
  ↓
  ┌─────────────────────────────────────────┐
  │ Notification Updates (Native Layer)     │
  ├─────────────────────────────────────────┤
  │ Display: accum + session = total daily  │
  │ Update frequency: ~1-2 Hz or throttled  │
  └─────────────────────────────────────────┘
  ↓
  JS (React Native Event Emitter)
  ↓
  useTracking.ts receives onTrackingProgress
  ↓
  setSessionProgress({distanceMeters, elapsedSeconds, goalReached})
  ↓
  getTotalDailyProgress() recalculates
  ↓
  ┌─────────────────────────────────────────┐
  │ HomeScreen Updates (JS Layer)           │
  ├─────────────────────────────────────────┤
  │ Display: getTotalDailyProgress()        │
  │ Update frequency: ~1-2 Hz or throttled  │
  └─────────────────────────────────────────┘
```

### Notification Progress Updates (Native)

The foreground notification must update **on every progress event** to show total daily activity:

```kotlin
// In TrackingService.handleStateChange():
override fun handleStateChange(state: TrackingState) {
  // ... accumulation logic ...

  // Write all totals to MMKV
  MMKVStore.setSessionDistance(state.sessionDistanceMeters)
  MMKVStore.setSessionElapsed(state.sessionElapsedSeconds)
  MMKVStore.setTodayDistance(state.todayDistanceMeters)
  MMKVStore.setTodayElapsed(state.todayElapsedSeconds)
  MMKVStore.setGoalsReached(state.allGoalsReached)

  // Calculate total daily progress for notification
  val totalDistance = state.todayDistanceMeters + state.sessionDistanceMeters
  val totalElapsed = state.todayElapsedSeconds + state.sessionElapsedSeconds
  val goalReached = state.allGoalsReached

  // Update notification with total daily progress
  val notification = NotificationHelper.buildProgressNotification(
    title = "Touch Grass",
    body = "Today: ${formatDistance(totalDistance)} • ${formatElapsed(totalElapsed)}",
    progress = calculateProgress(goalReached, totalDistance, totalElapsed),
    goalReached = goalReached
  )
  notificationManager.notify(NOTIFICATION_ID, notification)

  // Emit to JS with current session state
  emitProgressToJS(
    distanceMeters = state.sessionDistanceMeters,
    elapsedSeconds = state.sessionElapsedSeconds,
    goalReached = goalReached
  )
}
```

**Rationale:**
- Notification shows **accumulated + current session** total daily progress
- Notification updates reactively on every location/elapsed change
- User sees live total daily activity in the notification
- No delay between MMKV write and notification display

### HomeScreen Progress Updates (JS)

The HomeScreen must reactively display total daily progress from `getTotalDailyProgress()`:

```typescript
// In src/screens/HomeScreen.tsx or similar:
export function HomeScreen() {
  const tracking = useTracking(); // from useTracking hook
  
  // Reactive: Updates whenever sessionProgress or activePlans change
  const totalProgress = getTotalDailyProgress(tracking.sessionProgress);
  
  // Reactive: Updates whenever activePlans change
  if (tracking.activePlans.length === 0) {
    return <NoActivePlansPlaceholder />;
  }

  return (
    <ProgressCard>
      <Distance>{formatDistance(totalProgress.distanceMeters)}</Distance>
      <Elapsed>{formatElapsed(totalProgress.elapsedSeconds)}</Elapsed>
      <GoalStatus>
        {totalProgress.goalReached ? "Goal Reached! 🎉" : "Goal in progress..."}
      </GoalStatus>
      <GoalDisplay>
        Distance goal: {tracking.goals.hasDistanceGoal ? formatDistance(tracking.goals.totalDistanceMeters) : "—"}
        Time goal: {tracking.goals.hasTimeGoal ? formatElapsed(tracking.goals.totalTimeSeconds) : "—"}
      </GoalDisplay>
    </ProgressCard>
  );
}

// In useTracking.ts:
function getTotalDailyProgress(sessionProgress: TrackingProgress): TrackingProgress {
  const accumulatedFromMMKV = {
    distanceMeters: fastStorage.getTodayDistance(),
    elapsedSeconds: fastStorage.getTodayElapsed(),
  };
  
  return {
    distanceMeters: accumulatedFromMMKV.distanceMeters + (isTracking ? sessionProgress.distanceMeters : 0),
    elapsedSeconds: accumulatedFromMMKV.elapsedSeconds + (isTracking ? sessionProgress.elapsedSeconds : 0),
    goalReached: fastStorage.getGoalsReached() || sessionProgress.goalReached,
  };
}

// Subscribe to progress events and update reactively:
useEffect(() => {
  const subscription = Tracking.onProgress((progress) => {
    console.log('[Progress Update]', progress);
    // Update session progress (current tracking state)
    setSessionProgress(progress);
    // HomeScreen will re-render with new total via getTotalDailyProgress()
  });
  
  return () => subscription?.remove();
}, []);
```

**Rationale:**
- HomeScreen reads `getTotalDailyProgress()` which combines MMKV + session
- Updates reactively on every progress event from native
- Always shows **total daily activity** (not just current session)
- No manual state sync needed; MMKV updates happen native-side
- React's reactivity ensures UI follows data changes

### Update Frequency & Throttling

To avoid excessive re-renders and battery drain:

**Native (TrackingService):**
- Update MMKV and emit event on **every location fix** (~1-2 per second)
- Throttle **notification updates** to ~1 per 2-5 seconds (not on every fix)
- Use `notificationUpdatedThrottleMs` constant to batch updates

**JS (React/HomeScreen):**
- Update UI on **every progress event** from native (~1-2 per second)
- React batches re-renders automatically
- Use `useMemo()` or callback memoization if needed to prevent child re-renders

```kotlin
// Native throttling example:
private var lastNotificationUpdateMs = 0L
private const val NOTIFICATION_UPDATE_THROTTLE_MS = 2000L // Update every 2s max

override fun handleStateChange(state: TrackingState) {
  val now = System.currentTimeMillis()
  
  // Always update MMKV (fast, no throttle)
  MMKVStore.setSessionDistance(state.sessionDistanceMeters)
  MMKVStore.setSessionElapsed(state.sessionElapsedSeconds)
  MMKVStore.setTodayDistance(state.todayDistanceMeters)
  MMKVStore.setTodayElapsed(state.todayElapsedSeconds)
  
  // Always emit progress to JS (React batches updates)
  emitProgressToJS(state)
  
  // Throttle notification updates
  if (now - lastNotificationUpdateMs >= NOTIFICATION_UPDATE_THROTTLE_MS) {
    updateNotification(state)
    lastNotificationUpdateMs = now
  }
}

private fun updateNotification(state: TrackingState) {
  val totalDistance = state.todayDistanceMeters + state.sessionDistanceMeters
  val totalElapsed = state.todayElapsedSeconds + state.sessionElapsedSeconds
  
  val notification = NotificationHelper.buildProgressNotification(
    title = "Touch Grass",
    body = "Today: ${formatDistance(totalDistance)} • ${formatElapsed(totalElapsed)}",
    progress = calculateProgress(state.allGoalsReached, totalDistance, totalElapsed),
    goalReached = state.allGoalsReached
  )
  notificationManager.notify(NOTIFICATION_ID, notification)
}
```

### Consistency Guarantee

Both notification and HomeScreen show the **same data** because:
1. **Single source of truth:** MMKV holds accumulated totals
2. **Single event source:** TrackingService emits progress once per update
3. **Same calculation:** Both use `accumulated + session = total daily`
4. **Reactive propagation:** MMKV write → progress emit → notification + HomeScreen

**Visual consistency examples:**
- Notification shows: "Today: 5.2 km • 45:30" (MMKV 5km + session 0.2km + MMKV 40m + session 5:30)
- HomeScreen shows: "5.2 km" "45:30" (same calculation)
- Both update at the same time (native emit → JS receive)
- No race conditions (MMKV writes are atomic)

---
## �📋 Implementation Checklist

### Kotlin (Android)

- [ ] Add session state keys to `MMKVStore.kt`
  - `session_active`, `session_start_time_ms`, `session_distance_meters`, `session_elapsed_seconds`, `session_last_update_ms`, `current_day`
  
- [ ] Add helper methods to `MMKVStore.kt`
  - `setSessionActive()`, `getSessionActive()`
  - `setSessionStartTime()`, `getSessionStartTime()`
  - `setSessionDistance()`, `getSessionDistance()`
  - `setSessionElapsed()`, `getSessionElapsed()`
  - `setSessionLastUpdate()`, `getSessionLastUpdate()`
  - `setCurrentDay()`, `getCurrentDay()`
  - `clearSessionState()`, `shouldResumeSession()`

- [ ] Update `TrackingService.onStartCommand()`
  - Write session init to MMKV when starting new session
  - Call `checkDayRollover()` to detect midnight boundary

- [ ] Update `TrackingService.handleStateChange()` (or progress handler)
  - Write session distance/elapsed on each progress tick
  - Write today's totals to MMKV (daily accumulation)
  - Flush goal_reached flag
  - **Calculate total daily progress (accumulated + session)**
  - **Emit progress event to JS on every update**
  - **Update notification with total daily progress (throttled)**

- [ ] Update `TrackingService.stopTracking()`
  - Flush final daily totals to MMKV
  - Clear session ephemeral state

- [ ] Update `TrackingService.onCreate()`
  - Check `MMKVStore.shouldResumeSession()`
  - Restore session state if crash detected (< 1 hour)
  - Resume GPS and activity tracking

- [ ] Implement notification throttling
  - Add `NOTIFICATION_UPDATE_THROTTLE_MS` constant (~2-5 seconds)
  - Only update notification display every N milliseconds
  - MMKV and JS events still update on every fix

### TypeScript (React Native)

- [ ] Add session read methods to `fastStorage` in `src/storage/index.ts`
  - `getSessionActive()`, `getSessionDistance()`, `getSessionElapsed()`
  
- [ ] Add debug helper `verifyMMKVSync()` to `src/storage/index.ts`

- [ ] **Add plan-aware recovery to `useTracking.ts`**
  - Load active plans for today first
  - Only recover session state if active plans exist
  - Skip recovery if no active plans (even if session was active)
  - Log "no active plans" condition for debugging

- [ ] **Add goal sync to `useTracking.ts`**
  - When active plans change, update goals
  - Sync goal metadata to MMKV via `fastStorage.setGoal()`
  - Native service uses this to display correct progress targets

- [ ] Add optional recovery logic to `useTracking.ts` (one useEffect on mount)
  - Check `fastStorage.getSessionActive()` AND `activePlans.length > 0`
  - Restore `sessionProgress` if crash detected AND plans are active

- [ ] **Add `getTotalDailyProgress()` helper to `useTracking.ts`**
  - Combine MMKV accumulated totals + current session progress
  - Return total distance, elapsed, and goal status
  
- [ ] **Add reactive progress subscription in `useTracking.ts`**
  - Subscribe to `Tracking.onProgress()` event in useEffect
  - Update `sessionProgress` state on every event
  - HomeScreen will automatically re-render via getTotalDailyProgress()
  - Cleanup subscription on unmount

- [ ] **Update HomeScreen to handle "No Active Plan for Today"**
  - Check `activePlans.length === 0`
  - Display placeholder/disabled state if no plans
  - Only show progress card if plans exist
  - Disable manual start if no plans
  
- [ ] **Update HomeScreen to display total daily progress reactively**
  - Call `getTotalDailyProgress(sessionProgress)` in render
  - Display total distance from combined MMKV + session
  - Display total elapsed from combined MMKV + session
  - Display goal reached from either source
  - Component automatically re-renders when sessionProgress updates via progress event

- [ ] **Verify notification and HomeScreen consistency**
  - Both display same total (accumulated + session)
  - Both update at same time (on native progress emit)
  - Both reflect goal reached state correctly
  
- [ ] Test data flow: verify MMKV keys are updated on progress events

### Testing

- [ ] Verify daily totals persist after app termination
  - Start tracking → accumulate distance → kill app → reopen → check `fastStorage.getTodayDistance()`
  
- [ ] Verify crash recovery (within 1 hour)
  - Start tracking → kill app mid-session → reopen → verify session resumes
  
- [ ] Verify day boundary rollover
  - Track at 23:50 → continue past midnight → verify totals reset
  
- [ ] Verify goal reached state persists
  - Reach goal → kill app → reopen → verify goal state in UI
  
- [ ] Run `verifyMMKVSync()` debug helper to inspect MMKV state

---

## 🎯 Success Criteria

- ✅ Daily totals (distance, elapsed, goals) survive app restart
- ✅ Session recovery works for crashes within 1 hour
- ✅ No changes to existing `fastStorage` API
- ✅ No changes to existing `Tracking.ts` native bridge
- ✅ Minimal changes to `useTracking.ts` (one optional useEffect)
- ✅ MMKV is single source of truth for today's data
- ✅ TrackingService owns all persistence (no JS writes to MMKV)
- ✅ Day boundary rollover is handled automatically

---

## 📚 Related Documents

- [mmkv-persistence-plan.md](mmkv-persistence-plan.md) — Original MMKV design
- [tracking-service-architecture.md](tracking-service-architecture.md) — Service architecture and design
- [tracking-service-implementation.md](tracking-service-implementation.md) — Implementation skeleton

