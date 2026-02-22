# Debug Display: Before & After

## BEFORE

```
DEBUG
isTracking: true | mode: moving
goalsReached: false
motion: MOVING | service: true | gps: true
activity: walking
```

**Problems:**
- Compact and unclear
- Mixing different concerns (motion state, service state, GPS state)
- Hard to read at a glance
- No clear distinction between current activity type and motion state machine state

---

## AFTER

```
DEBUG
isTracking: true | mode: moving
goalsReached: false
Current motion: WALKING
Step detected: true
GPS: true
```

**Improvements:**
- ✅ Clear section headers make it easy to scan
- ✅ Shows the **actual activity** being detected (WALKING, RUNNING, STILL, etc.)
- ✅ Shows **step detection status** for sensor corroboration debugging
- ✅ Shows **GPS active status** so you can see when location tracking begins
- ✅ One piece of information per line (better UX)
- ✅ All values are **reactive** — updates every ~500ms as motion is detected
- ✅ Perfect for diagnosing false positives/negatives

---

## What Each Field Means

### Current motion: WALKING | RUNNING | ON_BICYCLE | IN_VEHICLE | STILL

The activity type that the Activity Recognition API is currently reporting.

**Debug Use Cases:**
- Is walking being detected correctly? → Check if this shows "WALKING"
- Why didn't tracking stop? → Check if this shows "STILL" when you stopped walking
- Is the vehicle detection working? → Check if this shows "IN_VEHICLE" when in a car

---

### Step detected: true | false

Whether a step has been detected by the accelerometer's step sensor **within the last 2 seconds**.

**Debug Use Cases:**
- Are the sensors detecting movement? → Should be `true` while walking
- Why is false motion being detected? → Should be `false` if you're just vibrating the phone
- Is sensor corroboration working? → Should require both Activity Recognition AND step detection

---

### GPS: true | false

Whether the GPS/location tracking is currently active. This is `true` when the motion state machine is in the `MOVING` state.

**Debug Use Cases:**
- Has tracking actually started? → Should be `true` when tracking begins
- Is tracking continuing? → Should remain `true` while moving
- Did tracking stop correctly? → Should change to `false` when motion stops
- Battery usage concern? → Watch this to see if GPS is staying on too long

---

## Implementation Details

These values are polled from the native motion engine every **~500ms** and emitted as events to React Native. The JavaScript layer subscribes to these events and updates the debug display reactively.

**Why ~500ms?**
- Fast enough for real-time feedback while walking/running
- Slow enough to not overwhelm the event system
- Configurable if needed via `STATE_UPDATE_INTERVAL_MS` in MotionModule.kt

---

## Real-World Example

**Scenario:** Walk for 5 seconds, stop, wait 3 seconds

```
t=0s
Current motion: STILL
Step detected: false
GPS: false

t=1-5s (walking)
Current motion: WALKING  ← Updates as you walk
Step detected: true      ← Toggles as you step
GPS: true                ← Turns on after 1st walking detection

t=5s (stop walking)
Current motion: WALKING  ← Lags slightly while still processing
Step detected: false     ← Stops ~1-2s after last step

t=6-8s (stationary)
Current motion: STILL    ← May transition to AUTO_PAUSED first
Step detected: false
GPS: true                ← Still active (depends on stop logic)

t=9s+ (stopped for 3s)
Current motion: STILL
Step detected: false
GPS: false               ← Should turn off eventually
```

This shows exactly how the system is detecting (or not detecting) your movement, making it easy to spot issues.
