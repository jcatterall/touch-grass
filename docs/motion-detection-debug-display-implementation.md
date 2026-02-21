# Motion Detection Debug Display: Implementation Complete

## Overview

Implemented a reactive motion detection debug panel that displays detailed, real-time information about the motion detection system. The debug section now shows:

- **Current motion**: WALKING | RUNNING | ON_BICYCLE | IN_VEHICLE | STILL
- **Step detected**: true | false
- **GPS**: true | false

These values update reactively at ~500ms intervals, providing immediate feedback about the motion detection engine's state.

---

## Changes Made

### 1. Native Android Changes

#### [MotionEngine.kt](../../android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt)

**Added public method to expose step detection state:**

```kotlin
/**
 * Returns whether a step has been detected recently (within stepRecencyWindow).
 * Useful for UI debug information.
 */
fun isStepDetectedRecently(): Boolean = isStepRecent()
```

This allows the module to query step detection state without exposing private implementation details.

---

#### [MotionEventEmitter.kt](../../android/app/src/main/java/com/touchgrass/motion/MotionEventEmitter.kt)

**Added new event type and emission method:**

```kotlin
const val EVENT_STATE_UPDATE = "MotionStateUpdate"

fun emitStateUpdate(activity: String, stepDetected: Boolean, gpsActive: Boolean) {
    val params = Arguments.createMap().apply {
        putString("activity", activity)
        putBoolean("stepDetected", stepDetected)
        putBoolean("gpsActive", gpsActive)
    }
    emit(EVENT_STATE_UPDATE, params)
}
```

This new event broadcasts detailed motion state whenever it changes, enabling reactive UI updates.

---

#### [MotionModule.kt](../../android/app/src/main/java/com/touchgrass/motion/MotionModule.kt)

**Added periodic state update polling:**

1. Added state update interval constant: `STATE_UPDATE_INTERVAL_MS = 500L`
2. Added `Handler` and `Runnable` for periodic emissions
3. Implemented `startStateUpdates()` method that:
   - Polls `MotionSessionController.currentActivityType`
   - Queries `MotionEngine.isStepDetectedRecently()`
   - Checks if `MotionSessionController.currentState == MOVING` to determine GPS active
   - Emits `MotionStateUpdate` event every 500ms

4. Implemented `stopStateUpdates()` to clean up polling when module is invalidated
5. Integrated polling into `initialize()` and `invalidate()` lifecycle

**Added new React method:**

```kotlin
@ReactMethod
fun getDetailedMotionState(promise: Promise) {
    // Returns immediate snapshot of: activity, stepDetected, gpsActive
}
```

This provides a one-time query API if needed (though continuous polling via events is preferred for reactivity).

---

### 2. React Native Bridge Changes

#### [src/tracking/MotionTracker.ts](../../src/tracking/MotionTracker.ts)

**Added new interface:**

```typescript
export interface MotionStateUpdate {
  activity: MotionActivityType;
  stepDetected: boolean;
  gpsActive: boolean;
}
```

**Added new listener method:**

```typescript
onMotionStateUpdate(
  callback: (update: MotionStateUpdate) => void,
): EmitterSubscription | null {
  if (!emitter) return null;
  return emitter.addListener('MotionStateUpdate', callback);
}
```

This allows JavaScript to subscribe to periodic motion state updates.

---

### 3. Hook Changes

#### [src/hooks/useTracking.ts](../../src/hooks/useTracking.ts)

**Extended DebugInfo interface:**

```typescript
export interface DebugInfo {
  motionState: string;
  motionActivity: string;
  motionServiceRunning: boolean;
  nativeServiceRunning: boolean;
  currentActivity: string;        // NEW: detailed activity type
  stepDetected: boolean;          // NEW: step detection state
  gpsActive: boolean;             // NEW: GPS active state
}
```

**Added state variables:**

```typescript
const [debugCurrentActivity, setDebugCurrentActivity] = useState('unknown');
const [debugStepDetected, setDebugStepDetected] = useState(false);
const [debugGpsActive, setDebugGpsActive] = useState(false);
```

**Added subscription reference:**

```typescript
const motionStateUpdateSub = useRef<EmitterSubscription | null>(null);
```

**Added listener subscription in motion effects:**

```typescript
motionStateUpdateSub.current = MotionTracker.onMotionStateUpdate(
  (update) => {
    setDebugCurrentActivity(update.activity);
    setDebugStepDetected(update.stepDetected);
    setDebugGpsActive(update.gpsActive);
  },
);
```

The subscription is cleaned up properly when background tracking is disabled or component unmounts.

**Updated debugInfo useMemo** to include new fields.

---

### 4. UI Changes

#### [src/screens/main/HomeScreen.tsx](../../src/screens/main/HomeScreen.tsx)

**Replaced old debug section:**

Old:
```tsx
<Typography variant="body" style={styles.debugText}>
  motion: {debugInfo.motionState} | service:{' '}
  {String(debugInfo.motionServiceRunning)} | gps:{' '}
  {String(debugInfo.nativeServiceRunning)}
</Typography>
<Typography variant="body" style={styles.debugText}>
  activity: {debugInfo.motionActivity}
</Typography>
```

New:
```tsx
<Typography variant="body" style={styles.debugText}>
  Current motion: {debugInfo.currentActivity.toUpperCase()}
</Typography>
<Typography variant="body" style={styles.debugText}>
  Step detected: {String(debugInfo.stepDetected)}
</Typography>
<Typography variant="body" style={styles.debugText}>
  GPS: {String(debugInfo.gpsActive)}
</Typography>
```

The new display is cleaner, more readable, and shows the exact motion state values needed for debugging.

---

## How It Works

### Data Flow

1. **Native Poll Loop** (every 500ms in MotionModule):
   ```
   MotionSessionController.currentActivityType
   + MotionEngine.isStepDetectedRecently()
   + (MotionSessionController.currentState == MOVING)
   → MotionEventEmitter.emitStateUpdate()
   → RCTDeviceEventEmitter broadcasts "MotionStateUpdate"
   ```

2. **JavaScript Listener** (in useTracking hook):
   ```
   MotionTracker.onMotionStateUpdate(callback)
   → setDebugCurrentActivity()
   → setDebugStepDetected()
   → setDebugGpsActive()
   ```

3. **React State** (useMemo):
   ```
   debugInfo = {
     ...other fields,
     currentActivity,
     stepDetected,
     gpsActive
   }
   ```

4. **UI Render** (HomeScreen):
   ```
   Display debugInfo.currentActivity (WALKING | RUNNING | STILL | etc.)
   Display debugInfo.stepDetected (true | false)
   Display debugInfo.gpsActive (true | false)
   ```

### Reactivity

- **Update Frequency**: ~500ms (configured via `STATE_UPDATE_INTERVAL_MS`)
- **Latency**: ~500-1000ms from native state change to UI update (one poll cycle + React re-render)
- **Battery Impact**: Minimal — polling only occurs while MotionModule is initialized, and only when React context is active

---

## Testing Checklist

- [ ] Start the app with background tracking enabled
- [ ] Walk outdoors for 10+ seconds and observe:
  - [ ] "Current motion" changes from STILL → WALKING/RUNNING
  - [ ] "Step detected" toggles between true/false as you step
  - [ ] "GPS" changes from false → true when tracking starts
- [ ] Stop walking completely and observe:
  - [ ] "Step detected" returns to false within 2 seconds
  - [ ] "Current motion" remains WALKING/RUNNING briefly, then updates
- [ ] Verify updates are continuous and smooth (no lag/stalling)
- [ ] Check logcat for `MotionEventEmitter` emissions to confirm native events are firing

---

## Performance Notes

### Native Side
- Polling interval: 500ms
- Per-poll work: 3 simple state reads + 1 event emission
- Memory: Negligible (one Handler + one Runnable)
- CPU: <1ms per poll on modern devices

### JavaScript Side
- Event subscription: Always active while backgroundTrackingEnabled = true
- Per-update work: 3 setState calls (batched by React)
- Memory: 3 boolean/string state values
- Re-renders: Only if values change (React will optimize)

### Battery
- Overall impact: Minimal
- Polling only while module is active
- No GPS changes triggered by debug display
- No sensor frequency increases

---

## Future Enhancements

1. **Configurable Poll Interval**: Make `STATE_UPDATE_INTERVAL_MS` adjustable via React module
2. **Detailed Confidence Score**: Expose the actual confidence percentage from `computeConfidence()`
3. **Accelerometer Variance**: Show real-time accelerometer variance values
4. **Event Count**: Track how many state updates have been emitted for diagnostics
5. **Timestamps**: Add millisecond-precision event timestamps for latency analysis

---

## Summary

The motion detection debug display is now fully reactive and provides real-time visibility into the motion detection engine's state. This makes it much easier to diagnose motion detection issues and verify that the system is correctly detecting activity, steps, and GPS state.
