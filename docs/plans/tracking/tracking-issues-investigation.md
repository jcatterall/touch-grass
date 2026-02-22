# Tracking Issues Investigation & Implementation Plan

## Summary of Issues

You've identified three related issues with motion tracking and UI state display:

1. **UI not reactive to tracking state changes** - Both notification and home screen don't reflect the current tracking state AS it changes
2. **Motion too sensitive** - Triggered by just walking around the house
3. **Idle detection uncertainty** - After motion was triggered, UI still shows tracking while stationary; unclear if idle is stopping tracking properly or if UI is out of sync

---

## Issue Analysis

### Issue #1: UI Reactivity Problem

**Root Cause Identified:**

The `useTracking` hook has a reactivity gap with motion state display. Here's what's happening:

1. **Motion state is only debug info**: The `debugMotionState` and `debugMotionActivity` values are stored in React state and update when MotionTracker events fire (`onMotionStarted`, `onMotionAutoPaused`, `onMotionResumed`, `onMotionStopped`)
2. **These states are NOT used in `isTracking`**: The `isTracking` flag is controlled by `onProgress` and `onTrackingStarted`/`onTrackingStopped` events from the native TrackingService, NOT by MotionTracker events
3. **Event timing mismatch**: There's a gap between when MotionEngine detects motion (MotionSessionController changes state) and when TrackingService actually starts and sends the first progress event

**Current Flow:**
```
MotionEngine (MOVING detected) 
  → MotionSessionController state = MOVING
    → [App is in background, so TrackingService notification updates]
    → MotionTrackingBridge tells TrackingService to start
      → TrackingService.onStartCommand()
        → TrackingController.ensureTracking()
          → GPS turns on
          → onStateChanged() fires
            → handleStateChange() sends progress event to JS
              → onProgress callback in useTracking fires
                → setIsTracking(true)
```

**Problem**: Between steps 1-2 and the final notification, there's a ~100-2000ms gap where the UI doesn't reflect the motion detection. The home screen and notification don't update until the TrackingService progress event arrives.

**Affected Components:**
- HomeScreen: Shows `isTracking` based on TrackingService state, not MotionTracker state
- Notification: Built from TrackingState in native code (correct, but not shown until service starts)

---

### Issue #2: Motion Too Sensitive

**Root Cause Identified:**

The `MovementConfidenceEngine` and sensor thresholds allow false positives:

**Current Sensitivity Configuration:**

```kotlin
// MotionConfig defaults:
val movementConfidenceThreshold: Float = 0.6f  // 60% confidence required
val varianceThreshold: Float = 0.3f             // Accelerometer variance threshold
val accelWindowSize: Int = 50                   // ~1 second of samples at 50Hz

// MovementConfidenceEngine weights:
Activity Recognition:    0.50 (50%)
Step Detection:          0.30 (30%)
Accelerometer Variance:  0.20 (20%)
Sustained Duration:      0.20 (20%)
```

**Why it's too sensitive:**

1. **Activity Recognition is weighted too heavily (50%)**: The Google Activity Recognition API can detect walking from just a few steps around the house
2. **Confidence threshold is too low (0.6)**: Only needs 60% confidence to transition from STILL → MOVING
3. **Step detection weight (30%)**: Step detector can trigger from arm movements, etc.
4. **Minimal acceleration variance required (0.3)**: Relatively low threshold

**Example false positive:**
- User walks 10 steps around the house
- Activity Recognition API detects "WALKING" (confidence 85%)
- Step detector fires a few times
- Confidence score = (0.85 × 0.50) + (recent_step × 0.30) + ... = ~0.65 ✓ > 0.6 threshold
- ✗ Motion detected, tracking starts when you weren't intending exercise

---

### Issue #3: Idle Detection & Tracking Stop Uncertainty

**Root Cause Identified:**

There are two separate mechanisms that should stop tracking, and they're not clearly synchronized:

1. **TrackingController's stationary buffer:**
   ```kotlin
   // In TrackingController.onMotion():
   ActivityType.STILL -> {
       if (snapshot.confirmed) {
           // End immediately
           finaliseSession()
           return
       }
       // Unconfirmed STILL → arm the buffer
       handler.postDelayed(stationaryBufferRunnable, 20_000L)  // 20 seconds
   }
   ```

2. **MotionSessionController's auto-pause + stop delay:**
   ```kotlin
   // In MotionSessionController:
   autoPauseDelay:      5_000L ms  (walking/running)
   stopDelay:           20_000L ms (after auto-pause)
   ```

**The Problem:**

- When user becomes idle, **MotionEngine detects STILL** and sends to TrackingController
- TrackingController has a **20-second stationary buffer** before calling `finaliseSession()`
- Meanwhile, **MotionSessionController ALSO has its own stop logic** with auto-pause (5s) + stop delay (20s)
- These are **separate state machines** that should be coordinated but aren't tightly integrated
- **UI sync issue**: Even if native side stops tracking, the JS layer might not have the latest state if:
  - The app was in background when tracking stopped
  - No progress event arrives to trigger `onTrackingStopped`
  - The `syncFromNativeService()` call hasn't run yet

**Specific Scenario (from your report):**
1. Walking around house → motion detected, tracking starts ✓
2. Go to bed → standing still, no movement for 20+ seconds
3. TrackingController's `finaliseSession()` should fire
4. Native TrackingService calls `onTrackingStoppedCallback()`
5. JS should receive `onTrackingStopped` event
6. useTracking hook updates: `setIsTracking(false)`

**But if you were in bed immediately after:**
- The progress event arrives with final distance/elapsed
- But the UI shows "tracking" because the state hasn't been updated
- OR the service stops but JS is unaware because no event was received

---

## Implementation Plan for Claude

### Phase 1: Fix UI Reactivity (HIGH PRIORITY)

**Goal**: Make the UI instantly reflect motion detection and tracking state changes

#### 1.1 Update useTracking Hook
- **Add a derived `debugMotionDetected` state** that's based on MotionTracker events
- **Update home screen to show motion state separately from tracking state** (for debugging)
- **Subscribe to MotionTracker state changes** to update the displayed motion activity type in real-time
- **Ensure motion state is always up-to-date** with the latest MotionTracker event

**Key changes:**
- When `onMotionStarted` fires, immediately update a local state to show motion is detected
- This provides instant feedback even before TrackingService progress event arrives
- Add a computed flag: `const isMotionDetected = debugMotionState === 'MOVING'`

#### 1.2 Update HomeScreen Display
- Show **motion detection state separately** from `isTracking`
- Display: "Motion detected" → "Acquiring GPS" → "Tracking" progression
- Use MotionTracker state for instant feedback on motion detection
- Use TrackingService state for confirmed tracking with location data

#### 1.3 Update Native Notification
- The notification is already responsive (built from TrackingState on every change)
- Verify throttling is not hiding state changes: `NOTIFICATION_THROTTLE_MS` (currently 2-5s)
- **Reduce throttle** if needed to show immediate motion detection on notification

---

### Phase 2: Reduce Motion Sensitivity (HIGH PRIORITY)

**Goal**: Prevent false positives from normal movement around the house

#### 2.1 Increase Movement Confidence Threshold
- **Change `movementConfidenceThreshold` from 0.6 to 0.75** (require 75% confidence, not 60%)
- This reduces false positives while still catching actual walks

#### 2.2 Adjust Confidence Scoring Weights
- **Increase Activity Recognition weight** from 0.50 to 0.65 (be more selective about API results)
- **Reduce or remove Sustained Duration bonus** in early detection (first 2-3 seconds are unreliable)
- Alternative: **Require Activity Recognition + Step Detection** together to trigger (not just AR alone)

#### 2.3 Increase Accelerometer Variance Threshold
- **Change `varianceThreshold` from 0.3 to 0.5** (require more actual motion acceleration)
- This prevents small arm movements or walking slowly from triggering

#### 2.4 Require Consistent Motion Over Time
- **Increase minimum duration before motion is "confirmed"** from 10s to 15-20s
- This allows Activity Recognition to settle on the actual activity type before starting GPS

#### 2.5 Add a Hysteresis/Debounce Period
- **Add `minMotionDurationBeforeTracking: Long = 5_000L`** to MotionConfig
- Only transition STILL → MOVING if movement has been sustained for 5+ seconds
- Prevents flickering on brief movements

**Expected Result**: Walking slowly around the house won't trigger, but a 10-second sustained walk will

---

### Phase 3: Clarify Idle Detection & Improve Synchronization (MEDIUM PRIORITY)

**Goal**: Ensure idle detection reliably stops tracking and JS is always in sync

#### 3.1 Unify Stop Logic
- **Consolidate MotionSessionController and TrackingController stop logic**
- Have MotionSessionController emit a single "STOP" intent when idle is confirmed
- TrackingController receives and processes this single signal (no conflicting delays)

#### 3.2 Improve Stop Event Propagation
- **Ensure `onTrackingStopped` ALWAYS fires** when native service stops
- Add explicit callback from TrackingService.finaliseSession()
- Verify the native RN bridge sends the event even if in background

#### 3.3 Add Background State Sync on Foreground
- **Enhance `syncFromNativeService()` to be more robust:**
  - Call on app foreground resume (already done ✓)
  - Always checks `Tracking.getIsAutoTracking()` to detect running sessions
  - Also call periodically (every 5-10 seconds) as a safety net
  - Handle case where service stopped but event wasn't received

#### 3.4 Debug Visibility
- **Add timestamp to tracking state transitions** in native code
- **Log when `onTrackingStopped` is supposed to fire** (for debugging)
- **Show stationary buffer countdown** in debug panel (e.g., "stopping in 12 seconds...")

---

## Recommended Prompt for Claude

```
I have three related motion tracking issues in my React Native app:

1. **UI Reactivity**: The home screen and notification don't instantly reflect 
   motion detection and tracking state changes. There's a delay between when 
   the motion engine detects movement and when the UI updates.

2. **Motion Too Sensitive**: Walking around the house triggers motion detection 
   when it shouldn't. I only want tracking to start during intentional exercise.

3. **Idle Detection Uncertainty**: After motion was detected, I went to bed 
   (completely still), but the UI still showed tracking. I'm not sure if the 
   idle detection actually stopped the service, or if the UI is just out of sync.

Please implement the following fixes:

**Phase 1: Fix UI Reactivity**
- Update useTracking hook to show motion detection state separately from 
  isTracking (using MotionTracker events for instant feedback)
- Modify HomeScreen to display motion detection immediately without waiting 
  for TrackingService progress event
- Ensure notification updates instantly (reduce throttle if needed)

**Phase 2: Reduce Motion Sensitivity** 
- Increase movementConfidenceThreshold from 0.6 to 0.75
- Adjust MovementConfidenceEngine weights to require Activity Recognition 
  confidence to be higher
- Increase varianceThreshold from 0.3 to 0.5
- Add a minimum sustained motion duration (5 seconds) before 
  starting tracking

**Phase 3: Clarify Idle Detection**
- Add visibility into the stop logic: log when idle detection 
  triggers and countdowns
- Enhance syncFromNativeService() to poll periodically as a safety net
- Ensure onTrackingStopped always fires and JS receives the event

Focus on making the UI responsive in real-time and preventing false positives 
from casual movement.
```

---

## Additional Notes for Investigation

### Files to Check/Modify:
1. **src/hooks/useTracking.ts** - Add motion detection state display, enhance sync
2. **src/screens/main/HomeScreen.tsx** - Display motion + tracking state separately
3. **android/.../motion/MotionConfig.kt** - Adjust thresholds
4. **android/.../motion/MovementConfidenceEngine.kt** - Adjust weights
5. **android/.../motion/MotionSessionController.kt** - Add debounce logic
6. **android/.../tracking/TrackingController.kt** - Improve stop event handling

### Metrics to Validate:
- Motion detection takes <500ms to show in UI
- Walking 5+ steps at normal pace triggers tracking
- Walking 1-2 steps around the house does NOT trigger
- Idle for 20 seconds reliably stops tracking
- Going from tracking → idle takes <25 seconds to update UI

### Testing Scenarios:
1. Enable background tracking
2. Walk slowly around house for 3 steps → should NOT trigger
3. Walk at normal pace for 10+ steps → should trigger
4. Stand still for 25+ seconds after triggering → should stop
5. Return to foreground at any point → UI should sync with service state

---

## Verification Steps (for LLM Implementation Review)

These steps verify that the implementation changes are correct before manual testing.

### Phase 1 Verification: UI Reactivity Code Changes

#### V1.1: Motion State Hook Updates
**Verify in src/hooks/useTracking.ts:**
- [ ] Motion state subscriptions (`onMotionStarted`, `onMotionAutoPaused`, `onMotionResumed`, `onMotionStopped`) already exist
- [ ] Debug state variables exist: `debugMotionState`, `debugMotionActivity`, `debugMotionServiceRunning`
- [ ] `setDebugMotionState('MOVING')` is called immediately in `onMotionStarted` callback (not waiting for TrackingService event)
- [ ] Motion state updates are not dependent on `isTracking` flag—they are independent state
- [ ] All motion subscriptions are properly cleaned up in effect cleanup functions

#### V1.2: HomeScreen Display Updates
**Verify in src/screens/main/HomeScreen.tsx:**
- [ ] HomeScreen receives `debugInfo` from useTracking hook
- [ ] Debug panel displays `debugInfo.motionState` and `debugInfo.motionActivity` separately from `isTracking`
- [ ] Status text can differentiate between: "Watching for movement" → "Motion detected" → "Tracking"
- [ ] Motion detection state is visible even when `isTracking` is still false

#### V1.3: Notification Responsiveness
**Verify in android/.../tracking/TrackingService.kt:**
- [ ] `NOTIFICATION_THROTTLE_MS` constant is checked (should be 2-5 seconds)
- [ ] Notification is updated on every state change via `refreshNotification()` method
- [ ] Goal reached notifications bypass throttle (allow immediate update)

---

### Phase 2 Verification: Motion Sensitivity Changes

#### V2.1: Confidence Threshold Update
**Verify in android/.../motion/MotionConfig.kt:**
- [ ] `movementConfidenceThreshold` is changed from `0.6f` to `0.75f`
- [ ] Comment added explaining the new threshold requirement (75% confidence)

#### V2.2: Variance Threshold Update
**Verify in android/.../motion/MotionConfig.kt:**
- [ ] `varianceThreshold` is changed from `0.3f` to `0.5f`
- [ ] This requires more significant acceleration motion before confidence score increases

#### V2.3: Accelerometer Window Size (Optional but Recommended)
**Verify in android/.../motion/MotionConfig.kt:**
- [ ] `accelWindowSize` remains at 50 samples (~1 second at 50Hz) ✓
- [ ] `accelWindowSizePaused` adjusted if needed for battery optimization

#### V2.4: Confidence Scoring Weights
**Verify in android/.../motion/MovementConfidenceEngine.kt:**
- [ ] Check the weight constants at top of file:
  ```kotlin
  WEIGHT_ACTIVITY = 0.50f (or increased to 0.65f if requested)
  WEIGHT_STEP = 0.30f
  WEIGHT_VARIANCE = 0.20f
  WEIGHT_DURATION = 0.20f
  ```
- [ ] If Activity Recognition weight increased, verify the calculation logic is updated
- [ ] Verify `calculate()` function sums weights correctly (should cap at 1.0)

#### V2.5: Minimum Motion Duration
**Verify in android/.../motion/MotionSessionController.kt:**
- [ ] Check if `minMotionDurationBeforeTracking` config is added (recommended: 5000ms)
- [ ] Verify `onMovementDetected()` checks elapsed time before transitioning STILL → MOVING
- [ ] Confirm debounce prevents flickering on brief movements

---

### Phase 3 Verification: Idle Detection & Event Synchronization

#### V3.1: Stop Logic in TrackingController
**Verify in android/.../tracking/TrackingController.kt:**
- [ ] `onMotion(snapshot: ActivitySnapshot)` handles `ActivityType.STILL` case:
  ```kotlin
  if (snapshot.confirmed) {
      finaliseSession()  // Immediate stop
  } else {
      handler.postDelayed(stationaryBufferRunnable, 20_000L)  // 20s buffer
  }
  ```
- [ ] `stationaryBufferRunnable` calls `finaliseSession()` after 20 seconds
- [ ] Confirm the delay constant matches expected timeout (20 seconds max)

#### V3.2: Stop Event Propagation
**Verify in android/.../tracking/TrackingService.kt:**
- [ ] `handleStateChange()` callback is invoked on every state transition
- [ ] When state transitions to IDLE, `onTrackingStoppedCallback()` is invoked
- [ ] Verify callback is not null before invoking: `onTrackingStoppedCallback?.invoke()`
- [ ] Log statement exists: `"onTrackingStopped callback invoked"` or similar

#### V3.3: JS Side onTrackingStopped Listener
**Verify in src/hooks/useTracking.ts:**
- [ ] `Tracking.onTrackingStopped()` subscription exists and is set up in useEffect
- [ ] Inside the listener callback:
  ```typescript
  trackingStarted.current = false
  setIsTracking(false)
  setTrackingMode('idle')
  setDailyBaseline({...fromMMKV})  // Load saved session
  setSessionProgress({...reset})
  ```
- [ ] Cleanup function properly removes subscription: `sub?.remove()`

#### V3.4: Background Sync Enhancement
**Verify in src/hooks/useTracking.ts:**
- [ ] `syncFromNativeService()` function checks `Tracking.getIsAutoTracking()`
- [ ] Called on mount (already implemented ✓)
- [ ] Called on app foreground resume via `AppState.addEventListener('change')` (already implemented ✓)
- [ ] (Optional) Periodic sync timer added: `setInterval(() => syncFromNativeService(), 5000)` for safety net
- [ ] Proper cleanup of intervals and event listeners

#### V3.5: Daily Baseline Loading
**Verify in src/hooks/useTracking.ts:**
- [ ] When `onTrackingStopped` fires, `fastStorage.getTodayDistance()` is called to load session data
- [ ] This data is correctly placed in `dailyBaseline`, not `sessionProgress`
- [ ] `sessionProgress` is reset to zeros after loading baseline
- [ ] Comments explain the distinction (accumulated vs. current session)

#### V3.6: State Consistency
**Verify across both layers:**
- [ ] `isTracking` flag reflects native service state (via onProgress or onTrackingStarted/Stopped)
- [ ] `dailyBaseline` accumulates completed sessions (loaded from MMKV)
- [ ] `sessionProgress` tracks active session only (cleared when stopped)
- [ ] `progress` = dailyBaseline + sessionProgress (computed correctly in useMemo)
- [ ] No double-counting of distance/elapsed

---

### Implementation Checklist

**Phase 1 (UI Reactivity):**
- [ ] Motion state is displayed independently of isTracking
- [ ] Debug panel shows debugMotionState, debugMotionActivity, nativeServiceRunning
- [ ] HomeScreen uses this state to show status progression
- [ ] Motion subscriptions fire immediately, not waiting for TrackingService

**Phase 2 (Sensitivity):**
- [ ] movementConfidenceThreshold = 0.75f
- [ ] varianceThreshold = 0.5f
- [ ] (Optional) minMotionDurationBeforeTracking = 5000ms added
- [ ] MovementConfidenceEngine weights reviewed and updated if needed
- [ ] No other threshold changes accidentally made

**Phase 3 (Idle Detection):**
- [ ] Stationary buffer is 20 seconds (confirmed in code)
- [ ] onTrackingStopped event handler is implemented and cleanup is correct
- [ ] syncFromNativeService() is robust and called at appropriate times
- [ ] dailyBaseline and sessionProgress are used correctly (no mixing)
- [ ] MMKV persistence verified in finaliseSession() path

---

### Code Review Checkpoints

1. **No Syntax Errors**: All files compile and build successfully
2. **Event Subscriptions**: All `addListener()` calls have corresponding cleanup in effect return functions
3. **Null Safety**: All optional callbacks checked before invoking (`.invoke()` or `?.invoke()`)
4. **State Isolation**: Motion state and tracking state are independent (not entangled)
5. **Timing Consistency**: All delays/timeouts are constants in MotionConfig or TrackingConstants
6. **Logging**: Key transitions logged: motion detected, tracking started, idle detected, tracking stopped
7. **No Hardcoded Values**: All thresholds/timeouts come from MotionConfig, not hardcoded
