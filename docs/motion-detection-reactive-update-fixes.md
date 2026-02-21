# Motion Detection: Reactive Updates & STILL State Handling Fixes

## Problem Summary

You're experiencing two related issues in the current motion detection implementation:

1. **Tracking doesn't stop when STILL is detected** — Even when the Activity Recognition API detects `STILL` (high confidence), the tracking session continues running. It only stops after a long timeout (25 seconds total).

### Issue #2: Motion Debug Info Not Updating Reactively

**The Problem:**

In [useTracking.ts](../../src/hooks/useTracking.ts#L567-L618), the motion state subscriptions are set up correctly:

```typescript
motionStartedSub.current = MotionTracker.onMotionStarted(
  (event: MotionEvent) => {
    setDebugMotionState('MOVING');
    setDebugMotionActivity(event.activityType);
    // ... also sets isTracking
  },
);

motionStoppedSub.current = MotionTracker.onMotionStopped(
  (event: MotionEvent) => {
    setDebugMotionState('STOPPED');
    setDebugMotionActivity(event.activityType);
  },
);
```

However, there is **no subscription to the `STILL` activity event**.

**The Issue:**
- When the Activity Recognition API detects STILL with high confidence, [MotionEngine.kt](../../android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt#L274-L279) calls `MotionSessionController.onInactivityDetected()`.
- This does NOT emit any event to [MotionEventEmitter](../../android/app/src/main/java/com/touchgrass/motion/MotionEventEmitter.kt).
- Because no event is emitted, `useTracking.ts` has no signal to update `debugMotionState`.
- **Result:** The debug panel shows stale data; it continues displaying `STOPPED` (or whatever it last was) while the motion service detects STILL.

**Example Timeline:**
1. User walks → `MotionStarted` event fires → debug shows `MOVING` ✅
2. User stops walking → Activity Recognition detects `STILL` → `onInactivityDetected()` called → **NO event emitted** → debug still shows `MOVING` ❌
3. 5 seconds pass → inactivity timer fires → transitions to `AUTO_PAUSED` → NO event fired yet ❌
4. 20 seconds later → stop timer fires → `MotionStopped` event fires → debug updates to `STOPPED` ✅

---

## Solution Mapping

### Fix #1: Immediately Stop Tracking When STILL is Detected with High Confidence

**Files to Modify:**
- [android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt](../../android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt)
- [android/app/src/main/java/com/touchgrass/motion/MotionSessionController.kt](../../android/app/src/main/java/com/touchgrass/motion/MotionSessionController.kt)

**Proposed Change:**

When a STILL activity is detected with confidence ≥ 70%, the system should **immediately** transition to STOPPED, bypassing AUTO_PAUSED and the 20-second delay.

In `MotionEngine.onActivityTransitionDetected()`:

```kotlin
DetectedActivity.STILL -> {
    if (isEntering) {
        // Activity Recognition has confirmed stillness with high confidence.
        // Immediately stop the session — no debounce needed for STILL.
        MotionSessionController.forceStop("still_detected")
    }
}
```

In `MotionSessionController`, the `forceStop()` logic already exists and works correctly — it immediately emits `MotionStopped` and transitions to `STOPPED`. This will propagate to `Tracking.ts` via `MotionTrackingBridge`, which will call `stopTracking()`.

**Why This Works:**
- STILL detection is direct activity-based confirmation, not inactivity-based polling.
- No false positives: STILL requires ≥70% confidence from Google's Activity Recognition.
- Deterministic: no timers, no edge cases.
- Battery efficient: stops GPS immediately instead of keeping it running for 25 more seconds.

---

### Fix #2: Emit Events When STILL is Detected (for Debug Reactivity)

**Files to Modify:**
- [android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt](../../android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt)
- [android/app/src/main/java/com/touchgrass/motion/MotionEventEmitter.kt](../../android/app/src/main/java/com/touchgrass/motion/MotionEventEmitter.kt) (may need to add new event)
- [src/tracking/MotionTracker.ts](../../src/tracking/MotionTracker.ts) (may need to add new event listener)

**Proposed Change:**

Option A (Recommended): Emit `MotionStopped` immediately when STILL is detected.
- This is the simplest and aligns with the architecture: STILL detection = end of motion session.
- The debug info will update reactively because `useTracking` is already subscribed to `onMotionStopped`.
- No need for a new event type or new subscription.

Option B: Emit a new `StillDetected` or `InactivityDetected` event for UI awareness.
- Could be useful for showing a "You've stopped moving" message to the user.
- Requires adding a new listener in `useTracking`.
- More granular but more complex.

**Recommended Implementation:**

Modify `MotionEngine.onActivityTransitionDetected()` to emit the stop event immediately:

```kotlin
DetectedActivity.STILL -> {
    if (isEntering) {
        // Immediately stop the motion session
        MotionSessionController.forceStop("still_detected")
    }
}
```

When `MotionSessionController.forceStop()` is called, it already calls:

```kotlin
private fun transitionTo(newState: MotionState, ...) {
    // ...
    MotionState.STOPPED -> {
        MotionEventEmitter.emitStopped(activityType, reason ?: "inactivity")
        MotionTrackingBridge.onMotionStopped(activityType, reason ?: "inactivity")
    }
}
```

This emits the `MotionStopped` event, which `useTracking` is already subscribed to via `MotionTracker.onMotionStopped()`.

---

## Implementation Checklist

- [ ] **Modify `MotionEngine.onActivityTransitionDetected()`** to call `MotionSessionController.forceStop("still_detected")` immediately when `DetectedActivity.STILL` is detected with high confidence.
  
- [ ] **Verify `MotionSessionController.forceStop()`** correctly emits `MotionStopped` event and triggers `MotionTrackingBridge.onMotionStopped()`.

- [ ] **Verify `useTracking.ts`** is already subscribed to `MotionTracker.onMotionStopped()` and will update `debugMotionState` to `'STOPPED'` when the event fires.

- [ ] **Test Scenario 1 (Tracking Stops on STILL):**
  - Start background tracking.
  - Walk for 5+ seconds (triggers `MOVING`).
  - Stop walking completely.
  - Activity Recognition API should detect STILL within 1–2 seconds.
  - Verify: Tracking should stop almost immediately (not wait 25 seconds).
  - Check: `Tracking.getProgress()` should return distance accumulated, not continue accumulating.

- [ ] **Test Scenario 2 (Debug Updates Reactively):**
  - Start background tracking with debug panel visible.
  - Walk (debug should show `MOVING` ✅).
  - Stop walking (debug should update to `STOPPED` within 1–2 seconds).
  - Verify: No stale state in debug panel.

- [ ] **Add Debug Logging:**
  - Log when STILL activity is received with confidence level.
  - Log the transition from MOVING/AUTO_PAUSED → STOPPED with reason.
  - Helps diagnose why the issue occurred in the first place.

---

## Why These Issues Occurred

1. **STILL Not Stopping Immediately:**
   - The original logic treated STILL as just another "inactivity signal" that triggers a timer.
   - Activity Recognition's STILL is actually a high-confidence, direct signal — more reliable than GPS-based inactivity detection.
   - The architecture doc says to use STILL as the primary signal for session closure, but the implementation was using it as a secondary trigger for a timer.

2. **Debug Not Updating:**
   - `onInactivityDetected()` doesn't emit any event; it only checks if enough time has passed to transition to AUTO_PAUSED.
   - The subscription to `onMotionStopped()` in `useTracking` is correct, but it only fires 25 seconds after STILL is first detected (not immediately).
   - There's no event that fires when STILL is detected; only when STOPPED finally happens.

---

## Expected Outcomes After Fix

✅ **Tracking stops in <2 seconds when user stands still** (not 25 seconds).
✅ **Debug motion state updates reactively** as STILL is detected.
✅ **Battery usage improves** (GPS turns off sooner).
✅ **User experience improves** (app feels more responsive).
✅ **Matches the documented architecture** (STILL as primary signal).
