# Plan: Re-adding Data Persistence to Tracking Service via MMKVStore

**Date:** February 20, 2026  
**Status:** Planning Phase  
**Scope:** Minimal viable persistence — MMKV-only, crash recovery only

---

## 📋 Overview

The new tracking service architecture handles real-time progress (distance, elapsed time, goal status) but lacks persistence for:
- **Daily totals** (survive app restart)
- **Crash recovery** (resume mid-session if app dies)

This plan outlines a **minimal** integration of MMKVStore to persist session data and enable basic recovery.

---

## 🎯 Goals

1. **Persist daily totals** across app restarts
2. **Recover basic session state** if service crashes (within ~1 hour)
3. **Offline tracking** (works without connectivity)
4. **Sync to JS** via existing `fastStorage` API
5. **No Room DB, no analytics** — keep it simple

---

## 🏗️ Current State

### What MMKVStore Does Today
- ✅ Stores aggregated goals (type, value, unit) written by JS
- ✅ Tracks daily distance/elapsed totals (updated from TrackingService)
- ✅ Stores auto-tracking flag (`is_auto_tracking`)
- ✅ Syncs day boundaries (rolls over counters at midnight)

### What's Missing
- ❌ Persistence of session state if app crashes mid-session
- ❌ Crash recovery (rebuild current session)

---

## 📦 Data Model & Persistence Strategy

### Single Approach: Session State in MMKV Only
**Location:** MMKV (ephemeral + rollover safe)  
**Keys:**
```
// Daily totals (existing, verify)
current_day               → "yyyy-MM-dd"
today_distance_meters     → Double
today_elapsed_seconds     → Long
today_goals_reached       → Boolean

// Session state (new, cleared on session end)
session_active            → Boolean
session_start_time_ms     → Long
session_distance_meters   → Double
session_elapsed_seconds   → Long
session_last_update_ms    → Long (for recovery timeout check)
```

**Behavior:**
- On session start: Set `session_active=true`, `session_start_time_ms=now`, `session_distance=0`, `session_elapsed=0`
- During session: Update `session_distance_meters` and `session_elapsed_seconds` on each location/elapsed tick
- On session stop: Clear session keys (or leave them for recovery check)
- On app startup: Check if `session_active=true` AND `now - session_start_time_ms < 1_hour` → auto-resume

---

## 🔄 Integration Points

### Phase 1: Enhance MMKVStore (Kotlin)
**File:** `android/app/src/main/java/com/touchgrass/MMKVStore.kt`

Add session helpers:
```kotlin
// Session state writers
fun setSessionActive(active: Boolean)
fun setSessionStartTime(timeMs: Long)
fun setSessionDistance(meters: Double)
fun setSessionElapsed(seconds: Long)
fun setSessionLastUpdate(timeMs: Long)

// Session state readers
fun isSessionActive(): Boolean
fun getSessionStartTime(): Long
fun getSessionDistance(): Double
fun getSessionElapsed(): Long
fun getSessionLastUpdate(): Long

// Helpers
fun clearSessionState()
fun shouldResumeSession(): Boolean {
  // Returns true if session_active && (now - session_start_time_ms < 1 hour)
}
```

---

### Phase 2: Update TrackingService (Kotlin)
**File:** `android/app/src/main/java/com/touchgrass/tracking/TrackingService.kt`

**Changes:**

1. **onCreate():**
   ```kotlin
   if (MMKVStore.shouldResumeSession()) {
     // Auto-recover session state
     val distance = MMKVStore.getSessionDistance()
     val elapsed = MMKVStore.getSessionElapsed()
     Log.d(TAG, "Resuming session: distance=$distance elapsed=$elapsed")
     // Pass to controller to restore state
     controller.resumeSession(distance, elapsed)
   }
   ```

2. **onStartCommand() — manual start:**
   ```kotlin
   MMKVStore.setSessionActive(true)
   MMKVStore.setSessionStartTime(System.currentTimeMillis())
   MMKVStore.setSessionDistance(0.0)
   MMKVStore.setSessionElapsed(0)
   ```

3. **handleStateChange():**
   ```kotlin
   // After distance/elapsed updated:
   MMKVStore.setSessionDistance(newState.distanceMeters)
   MMKVStore.setSessionElapsed(newState.elapsedSeconds)
   MMKVStore.setSessionLastUpdate(System.currentTimeMillis())
   ```

4. **stopTracking():**
   ```kotlin
   MMKVStore.clearSessionState()
   ```

---

### Phase 3: Update TrackingController (Kotlin)
**File:** `android/app/src/main/java/com/touchgrass/tracking/TrackingController.kt`

**Changes:**

1. **Add resume method:**
   ```kotlin
   fun resumeSession(distanceMeters: Double, elapsedSeconds: Long) {
     // Restore state from MMKV and resume tracking
     _state.value = _state.value.copy(
       distanceMeters = distanceMeters,
       elapsedSeconds = elapsedSeconds,
       mode = TrackingMode.TRACKING_AUTO
     )
     gps.start()
   }
   ```

2. **In onLocationUpdate():**
   ```kotlin
   // Already updates _state, which is read by TrackingService.handleStateChange()
   // No additional changes needed
   ```

---

### Phase 4: Update JS Bridge (TypeScript)
**File:** `src/storage/index.ts` + `src/hooks/useTracking.ts`

**Add data sync verification:**
```typescript
// Verify MMKV keys are syncing from native layer
export const verifyMMKVSync = () => {
  const distance = _mmkv.getNumber('today_distance_meters') ?? 0;
  const elapsed = _mmkv.getNumber('today_elapsed_seconds') ?? 0;
  const autoTracking = _mmkv.getBoolean('is_auto_tracking') ?? false;
  
  console.log('[MMKV Sync Check]', {
    distance,
    elapsed,
    autoTracking,
    timestamp: new Date().toISOString(),
  });
  
  return { distance, elapsed, autoTracking };
};
```

**Update `useTracking` hook:**
- On progress event: immediately read `fastStorage.getTodayDistance()` and `fastStorage.getTodayElapsed()`
- Display these in home screen UI (not just session state)
- Verify MMKV data matches native progress events
- Add console logs for debugging data flow

---

### Phase 5: Add Room Database Layer (Optional, for historical data)
**File:** `android/app/src/main/java/com/touchgrass/db/SessionDao.kt` (new)

**Purpose:** Durable storage of completed sessions for analytics, weekly/monthly summaries.

**Define:**
```kotlin
@Entity
data class SessionEntity(
  @PrimaryKey(autoGenerate = true) val id: Long = 0,
  val date: String,
  val startTimeMs: Long,
  val endTimeMs: Long,
  val durationSeconds: Long,
  val distanceMeters: Double,
  val activityType: String,
  val goalType: String,
  val goalValue: Double,
  val goalReached: Boolean
)

@Dao
interface SessionDao {
  @Insert suspend fun insertSession(session: SessionEntity)
  @Query("SELECT * FROM sessions WHERE date = :date") suspend fun getSessionsByDate(date: String): List<SessionEntity>
  @Query("SELECT * FROM sessions WHERE date BETWEEN :startDate AND :endDate") suspend fun getSessionsInRange(startDate: String, endDate: String): List<SessionEntity>
}
```

---

## 🛣️ Implementation Roadmap

### **Phase 1: MMKV Helpers** (~1 hour)
- [ ] Add session key constants and getters/setters to MMKVStore
- [ ] Implement `shouldResumeSession()` logic

### **Phase 2: TrackingService Integration** (~2 hours)
- [ ] Add recovery check in onCreate()
- [ ] Sync session state in handleStateChange()
- [ ] Clear session on stopTracking()

### **Phase 3: TrackingController Resume** (~1 hour)
- [ ] Add `resumeSession()` method
- [ ] Wire it into TrackingService recovery flow

### **Phase 4: Testing** (~2 hours)
- [ ] Verify daily totals persist across restarts
- [ ] Test crash recovery: kill app → reopen → session resumes
- [ ] Test timeout: session older than 1 hour is not resumed

**Total: ~6 hours**

---

## 🚀 Benefits

| Feature | Benefit |
|---------|---------|
| Daily totals in MMKV | Survive app restart, fast sync to JS |
| Session state in MMKV | Crash recovery within 1 hour, no data loss |
| Offline tracking | Already works |
| Simple implementation | ~6 hours, no Room DB needed |

---

## ⚠️ Edge Cases & Considerations

1. **Data Sync & Freshness**
   - Problem: Session distance in native layer must sync to MMKV so JS reads latest data
   - Solution: Every distance/elapsed update → immediate MMKV write (synchronous, no overhead)
   - Verification: `verifyMMKVSync()` called periodically from useTracking hook to log state
   - Console logs to detect mismatches between native events and MMKV values

2. **Daily Aggregation Strategy**
   - Home screen shows **daily total** from MMKV: `today_distance_meters + today_elapsed_seconds`
   - This includes all sessions completed **today** (midnight roll-over safe)
   - Notification also reads from MMKV for accuracy
   - No need to aggregate multiple sessions — MMKV already holds the daily sum
   - **Optimization:** Single MMKV read per update instead of querying Room or AsyncStorage

3. **Midnight Rollover**
   - Session may start before midnight and end after
   - Solution: Let daily totals roll over naturally; session is per-activity-chunk
   - Defer splitting session across days to future iteration

4. **Recovery Timeout (1 hour)**
   - If session older than 1 hour, discard and start fresh
   - Rationale: Reasonable assumption that user didn't intend to resume after 1+ hours

5. **No Session Archival**
   - Session data is cleared on stop — not saved to Room/AsyncStorage
   - Rationale: Keep simple for now; historical analytics is a future enhancement
   - Benefit: Faster development, smaller code footprint

---

## 📝 Implementation Notes

- Keep it synchronous — all MMKV reads/writes are fast (C++ mmap)
- No async flows needed for session persistence
- Recovery happens in onCreate() before service is fully ready
- Session state is **not** exposed to JS layer (keep internal to native)
- **Data flow:** Native distance/elapsed → MMKV write → JS reads via fastStorage → UI update
- **Verification:** Add debug logs at each step to catch sync failures
- **Home screen optimization:** Single MMKV read for daily total (no aggregation needed)

---

## ✅ Success Criteria

- [ ] Daily totals persist across app restarts
- [ ] Crash recovery: kill app mid-session → reopen → session resumes with correct distance/elapsed
- [ ] Timeout: session older than 1 hour is not resumed
- [ ] **Data reaches JS:** MMKV values match native layer at all times
- [ ] **Home screen shows total daily distance/time** (from MMKV, single read)
- [ ] **Notification shows current session progress** (from TrackingService state)
- [ ] **Verification logs:** Console shows MMKV sync checks passing
- [ ] No data loss during normal operation
- [ ] Goal reached flag persists in daily totals

---

## 🔄 Data Flow & UI Layer

### Home Screen Display (Daily Total)
```
TrackingService.handleStateChange()
  ↓
MMKVStore.setSessionDistance(newState.distanceMeters)
  ↓
useTracking hook polls or listens to onProgress event
  ↓
fastStorage.getTodayDistance() ← reads MMKV
  ↓
Home screen component displays total daily distance
```

**Optimization:** Single synchronous MMKV read per update. No Room queries, no AsyncStorage bridge. Total distance is already aggregated in MMKV by TrackingService.

### Notification Display (Current Session + Daily Context)
```
TrackingService.handleStateChange()
  ↓
MMKVStore.setSessionDistance() + MMKVStore.setSessionElapsed()
  ↓
NotificationHelper.build(state) reads from:
  - TrackingState.distanceMeters (session-only or full daily?)
  - TrackingState.elapsedSeconds
  - Goal from MMKV
  ↓
Foreground notification updates with current progress
```

**Decision:** Notification should show **daily total** (distanceMeters in TrackingState should be daily total at all times, not session-only). This means:
- On session start: `_state.distanceMeters = today_distance_meters` (from MMKV)
- On location update: `_state.distanceMeters += delta`
- Result: TrackingState always holds today's total, not session-only

### Verification Checkpoints
Add debug logging to catch mismatches:

```typescript
// useTracking hook — on each progress event
const onProgress = (progress: TrackingProgress) => {
  const dailyFromMMKV = fastStorage.getTodayDistance();
  const dailyFromEvent = progress.distanceMeters;
  
  if (Math.abs(dailyFromMMKV - dailyFromEvent) > 0.1) {
    console.warn('[SYNC MISMATCH]', {
      fromMMKV: dailyFromMMKV,
      fromEvent: dailyFromEvent,
      delta: dailyFromEvent - dailyFromMMKV,
    });
  }
};
```

**Also add periodic verification:**
```typescript
// Every 30 seconds, log current state
useEffect(() => {
  const interval = setInterval(() => {
    console.log('[DATA SYNC CHECK]', verifyMMKVSync());
  }, 30_000);
  return () => clearInterval(interval);
}, []);
```
