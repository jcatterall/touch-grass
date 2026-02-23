# **1. Architecture Overview**

We want **a robust, efficient, deterministic motion tracking system** that can:

* Start tracking when user is walking, running, or cycling
* Stop tracking when user stops moving or enters a vehicle
* Avoid false triggers when idle or micro-moving
* Work in foreground, background, and terminated states (via passive listener + foreground service)
* Keep the frontend UI reactive with consistent live updates

---

## **Modules**

| Module                            | Responsibility                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MotionEngine (Kotlin service)** | Collects sensor data: step detector, accelerometer, gyroscope, GPS speed; receives Activity Recognition events; computes deterministic movement confidence; emits events to MotionSessionController |
| **MotionSessionController**       | Central single source of truth for motion state; handles state machine logic: POTENTIAL_MOVEMENT → MOVING → POTENTIAL_STOP → IDLE; triggers start/stop tracking; broadcasts events to React Native  |
| **React Native Frontend**         | Subscribes to events from MotionSessionController via Native EventEmitter; updates HomeScreen, notification, debug info in real-time; never queries raw sensors directly                            |

---

# **2. Deterministic Motion State Machine**

```text
UNKNOWN → IDLE → POTENTIAL_MOVEMENT → MOVING → POTENTIAL_STOP → IDLE
```

**States & Transitions:**

| State              | Entry Trigger                                         | Exit Condition                                                  | Notes                                                  |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| IDLE               | System start, confirmed stop                          | Step detected OR activity ENTER OR variance spike               | Low-power mode, sensors reduced                        |
| POTENTIAL_MOVEMENT | Step detected OR activity ENTER OR variance spike     | Confirmed movement after 3–5 sec → MOVING                       | Debounce false triggers (micro-movement)               |
| MOVING             | Confirmed movement                                    | Stop detected signals → POTENTIAL_STOP                          | Full sensors active, foreground service started        |
| POTENTIAL_STOP     | Step absence + low variance + no activity transitions | Confirm stop after 8–15 sec → IDLE OR movement resumes → MOVING | Debounce short stops (traffic lights, sitting briefly) |
| UNKNOWN            | App start before sensors initialize                   | First sensor signal                                             | System initializes sensors and Activity Recognition    |

---

# **3. Signal Fusion**

### Start Detection (Movement)

* **Step detector** → triggers POTENTIAL_MOVEMENT
* **Activity Recognition ENTER** → triggers POTENTIAL_MOVEMENT
* **Accelerometer variance spike** → supports confirmation
* Debounce: **3–5 seconds** for confirmed movement

### Stop Detection (Idle)

Stop confirmed only if **all stop conditions** are met:

1. **No steps** for `STEP_STOP_TIMEOUT_MS` (~10 sec)
2. **Low accelerometer variance** < `VARIANCE_STOP_THRESHOLD` (~0.12)
3. **No movement transitions** from Activity Recognition
4. Optional: GPS speed < 0.3 m/s
5. Stop confirmation window: `STOP_CONFIRM_WINDOW_MS` (~8–15 sec)

> STILL events are **optional confirmation only**, not triggers

---

# **4. Timers & Debouncing**

| Purpose                          | Duration | Notes                                                |
| -------------------------------- | -------- | ---------------------------------------------------- |
| Movement confirmation window     | 3–5 sec  | Prevents false starts from micro-movement            |
| Stop confirmation window         | 8–15 sec | Prevents false stops at traffic lights, benches      |
| Activity transition grace period | 5 sec    | Allows EXIT transitions to propagate before stopping |

---

# **5. Event-Driven Architecture & Background Support**

* **Foreground Service:** Active tracking (MOVING)
* **Passive Listener:** IDLE or POTENTIAL_STOP, low-power accelerometer + Activity Recognition
* **ActivityTransitionReceiver (PendingIntent):** Reacts to movement transitions
* **GPS only when MOVING:** Avoid unnecessary background location updates

---

# **6. Data Flow**

```text
Sensors + Activity Recognition → MotionEngine → MotionSessionController → React Native EventEmitter → HomeScreen & Notification
```

* MotionEngine computes deterministic confidence from:

  * Step detector events
  * Accelerometer variance
  * Gyroscope (optional filtering for orientation)
  * Activity Recognition transitions
  * Optional GPS speed
* MotionSessionController manages the **single source of truth** for:

  * `currentState` (IDLE, MOVING, POTENTIAL_STOP)
  * `currentActivityType` (walking, running, cycling, vehicle)
  * Distance and movement timestamps
* Frontend subscribes to state changes for live updates

---

# **7. Thresholds for Urban Walking (Tuned)**

| Signal                       | Threshold / Timing | Notes                                  |
| ---------------------------- | ------------------ | -------------------------------------- |
| Step absence                 | 10 sec             | ignores short pauses at traffic lights |
| Accelerometer variance       | < 0.12             | detects stationary phone reliably      |
| Stop confirmation window     | 8–15 sec           | debounce micro-pauses                  |
| Movement confirmation window | 3–5 sec            | ensures true start of movement         |
| Activity transition grace    | 5 sec              | allow EXIT transitions to complete     |
| GPS speed                    | < 0.3 m/s          | optional validation for stop detection |

---

# **8. Kotlin Implementation Patterns**

### 8.1 Activity Transition Handling

```kotlin
fun onActivityTransitionDetected(type: Int, isEntering: Boolean) {
    when(type) {
        DetectedActivity.WALKING -> {
            if (isEntering) MotionSessionController.onMovementDetected(confidence = computeConfidence(), type = "walking")
            else MotionSessionController.onMovementEnded("walking_exit")
        }
        DetectedActivity.RUNNING -> {
            if (isEntering) MotionSessionController.onMovementDetected(confidence = computeConfidence(), type = "running")
            else MotionSessionController.onMovementEnded("running_exit")
        }
        DetectedActivity.ON_BICYCLE -> {
            if (isEntering) MotionSessionController.onMovementDetected(confidence = computeConfidence(), type = "cycling")
            else MotionSessionController.onMovementEnded("cycling_exit")
        }
        DetectedActivity.IN_VEHICLE -> {
            if (isEntering) MotionSessionController.forceStop("vehicle_detected")
        }
    }
}
```

---

### 8.2 Step Absence Helper

```kotlin
fun hasStepsStopped(): Boolean =
    System.currentTimeMillis() - MotionEngine.lastStepTime > STEP_STOP_TIMEOUT_MS
```

---

### 8.3 Accelerometer Stability Helper

```kotlin
fun isDeviceStable(): Boolean =
    computeVariance() < VARIANCE_STOP_THRESHOLD
```

---

### 8.4 Potential Stop Evaluation

```kotlin
private fun evaluatePotentialStop() {
    if (!hasStepsStopped()) return
    if (!isDeviceStable()) return
    if (System.currentTimeMillis() - lastMovementSignalTime < TRANSITION_GRACE_MS) return

    MotionSessionController.onPotentialStopDetected()
}
```

---

### 8.5 Confirm Stop

```kotlin
private var potentialStopStart: Long = 0

fun onPotentialStopDetected() {
    if (state != MotionState.MOVING) return

    if (potentialStopStart == 0L) potentialStopStart = System.currentTimeMillis()

    if (System.currentTimeMillis() - potentialStopStart > STOP_CONFIRM_WINDOW_MS) {
        confirmStop()
    }
}

fun confirmStop() {
    potentialStopStart = 0
    transitionTo(MotionState.IDLE)
    stopTracking()
}
```

---

### 8.6 Cancel Stop If Movement Resumes

```kotlin
fun onMovementDetected(...) {
    potentialStopStart = 0
    if (state == MotionState.POTENTIAL_STOP) {
        transitionTo(MotionState.MOVING)
    }
}
```

---

### 8.7 Event Emission for React Native

```kotlin
fun emitMotionStateChange() {
    val params = mapOf(
        "state" to currentState.name,
        "activityType" to currentActivityType,
        "distanceMeters" to distanceMeters
    )
    reactContext
        .getJSModule(RCTDeviceEventEmitter::class.java)
        .emit("MotionStateChanged", params)
}
```

---

# **9. Debug Logging (Optional but Recommended)**

```kotlin
Log.d("MotionDebug", """
stepsRecent=${MotionEngine.isStepDetectedRecently()}
variance=${computeVariance()}
lastMovement=${System.currentTimeMillis() - lastMovementSignalTime}
state=$state
""")
```

---

# **10. React Native Integration**

* Subscribe to `MotionStateChanged` event
* Update HomeScreen state and notifications
* Ensure both reflect `MotionSessionController` state

---

# **11. Testing Recommendations**

1. **Phone idle on desk** → should remain IDLE, no tracking
2. **Urban walking** → tracking starts after 3–5 sec
3. **Stop on bench / traffic light** → tracking stops after 8–15 sec
4. **Enter vehicle** → stops tracking immediately
5. **Short stepless pause (<5 sec)** → should not stop
6. **Frontend consistency** → HomeScreen and notification match

---

# **12. Advantages**

* Deterministic: no ML, no adaptive thresholds
* Battery efficient: sensors minimized when IDLE
* Reliable stop detection: ignores STILL delays
* Accurate start/stop detection for urban walking
* Background and terminated-safe

---

This plan provides **all the details an LLM needs** to implement:

* State machine logic
* Signal fusion strategy
* Timing/debounce parameters
* Kotlin helper methods
* Event emission to React Native
* Testing & tuning guidelines