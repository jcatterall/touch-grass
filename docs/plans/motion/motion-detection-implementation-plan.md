# Motion Detection System: Implementation Plan

This document outlines the implementation strategy for improving the motion detection system, based on the provided solution plan. It maps the plan's objectives to the existing codebase, identifying the specific files and modules that require modification.

## Codebase Context

The motion and tracking system is divided into two main parts, each with a JavaScript bridge and a native Android module:

1.  **Motion Detection (`MotionModule` / `MotionTracker.ts`):**
    *   **Native `MotionModule` (Java/Kotlin):** Responsible for low-level sensor data processing, activity recognition, and applying deterministic rules to detect motion state (`STILL`, `MOVING`, etc.). This is where the bulk of the core logic changes will occur.
    *   **`src/tracking/MotionTracker.ts` (JS Bridge):** Exposes the native module's functionality and events to the React Native application. It provides the API for configuring and listening to motion state changes.

2.  **Tracking Orchestration (`TrackingModule` / `Tracking.ts`):**
    *   **Native `TrackingModule` (Java/Kotlin):** Manages the foreground service, location updates (GPS), distance calculation, and persisting data. It enters a `TRACKING` state when instructed.
    *   **`src/tracking/Tracking.ts` (JS Bridge):** The high-level state controller. It listens for events from `MotionTracker.ts` and uses them to start or stop the native `TrackingModule`.

---

## 🧭 PART 1 — Eliminate False Motion Detection

### ✅ 1. Apply Activity Confidence Thresholds

**Concept:** Ignore low-confidence activity classifications from the Android Activity Recognition API.

**Implementation Details:**

*   **File(s) to Modify:** Native `MotionModule` (Java/Kotlin).
*   **Proposed Change:** Inside the native `MotionModule`, whenever an `ActivityRecognitionResult` is received, inspect the confidence of each `DetectedActivity`. Before processing, apply the specified thresholds. If an activity's confidence is below its required threshold, it should be discarded and logged for debugging.

    ```java
    // Example logic in native MotionModule
    private void onDetectedActivities(List<DetectedActivity> activities) {
        for (DetectedActivity activity : activities) {
            int type = activity.getType();
            int confidence = activity.getConfidence();

            if (type == DetectedActivity.WALKING && confidence < 75) continue;
            if (type == DetectedActivity.RUNNING && confidence < 75) continue;
            if (type == DetectedActivity.ON_BICYCLE && confidence < 75) continue;
            if (type == DetectedActivity.STILL && confidence < 70) continue;
            if (type == DetectedActivity.IN_VEHICLE && confidence < 80) continue;

            // Process high-confidence activity...
        }
    }
    ```

### ✅ 2. Require Motion Stability Window (Debounce)

**Concept:** A state change (e.g., `idle` → `moving`) should only occur if the new state persists for a minimum duration.

**Implementation Details:**

*   **File(s) to Modify:** Native `MotionModule` (Java/Kotlin).
*   **Proposed Change:** Implement a debounce mechanism in the native `MotionModule`. When a potential state change is detected (e.g., the first high-confidence `WALKING` event arrives), start a timer. If the condition (continuous movement) persists for the entire window (6–10 seconds), finalize the state change and emit a `MotionStarted` event. If the condition is broken, cancel the timer. A similar, longer timer (12–20 seconds) should be used for the `moving` → `idle` transition.

### ✅ 3. Multi-Signal Movement Confirmation

**Concept:** Use multiple sensors to confirm a genuine state change, preventing reliance on a single signal.

**Implementation Details:**

*   **File(s) to Modify:** Native `MotionModule` (Java/Kotlin).
*   **Proposed Change:**
    *   **Confirming MOVING:** The native `MotionModule` must be expanded to consume data from GPS and the step counter sensor, in addition to the Activity Recognition API. A `MOVING` state is confirmed only when a high-confidence moving activity (`WALKING`, `RUNNING`, etc.) is present **AND** either GPS speed is > 0.8 m/s **OR** the step counter has incremented.
    *   **Confirming IDLE:** An `IDLE` state is confirmed only when the activity is `STILL`, GPS speed is < 0.3 m/s, **AND** a new accelerometer variance calculation shows minimal values.

### ✅ 4. Ignore Micro-Movement & Sensor Noise

**Concept:** Filter out minor movements that don't represent genuine travel.

**Implementation Details:**

*   **File(s) to Modify:** Native `MotionModule` (Java/Kotlin).
*   **Proposed Change:** This is a specific rule within the multi-signal confirmation logic. Even if an activity is classified as moving, the native `MotionModule` should ignore it and remain `IDLE` if GPS speed is very low (< 0.5 m/s) and total displacement from the starting point is minimal (< 10 meters).

---

## 🧭 PART 2 — Prevent Incorrect Tracking Starts

### ✅ Require Minimum Displacement & Confirmed Movement State

**Concept:** The app should not start recording a session until the user has meaningfully changed their location.

**Implementation Details:**

*   **File(s) to Modify:** Native `MotionModule` (Java/Kotlin) and `src/tracking/Tracking.ts`.
*   **Proposed Change:**
    1.  **Introduce `POTENTIAL_MOVEMENT` State (Native):** The native `MotionModule` should have an internal state machine. Upon the first sign of confirmed movement (per Part 1 rules), it enters a `POTENTIAL_MOVEMENT` state.
    2.  **Track Displacement (Native):** While in `POTENTIAL_MOVEMENT`, the module tracks displacement using the location sensor.
    3.  **Emit `MovementConfirmed` Event (Native):** Once displacement exceeds the 15–25 meter threshold, the native `MotionModule` transitions to `MOVEMENT_CONFIRMED` and emits a new event, e.g., `onMovementConfirmed`.
    4.  **Orchestration (JS):** The `src/tracking/Tracking.ts` module will listen for this new `onMovementConfirmed` event. Only upon receiving this event will it call `TrackingModule.startTracking()`. It should ignore the initial `onMotionStarted` event for the purpose of starting a recording, using it only for UI feedback if needed (e.g., showing a "Movement detected, starting soon..." message).

---

## 🧭 PART 3 — Vehicle Detection Must Stop Tracking

**Concept:** Entering a vehicle should immediately terminate a walking/running/biking session.

**Implementation Details:**

*   **File(s) to Modify:** Native `MotionModule` (Java/Kotlin).
*   **Proposed Change:** In the native `MotionModule`, create a high-priority rule. If the activity is `IN_VEHICLE` (with ≥ 80% confidence) and GPS speed exceeds 5 m/s, immediately override any other state. The module should forcefully transition to a `STOPPED` state and emit the `onMotionStopped` event with a `reason: 'vehicle_detected'`. `Tracking.ts` will listen for this and call `stopTracking()`.

---

## 🧭 PART 4 — Fix Frontend Showing Idle While Tracking

### ✅ Implement a Single Source of Truth & Emit Events

**Concept:** Centralize all state management and use an event-driven model to keep the UI in sync.

**Implementation Details:**

*   **File(s) to Modify:** `src/tracking/Tracking.ts`, `src/hooks/useTracking.ts`, and all UI components that display tracking data.
*   **Analysis:** The architecture already points to `Tracking.ts` being the `TrackingStateManager`. This plan formalizes its role.
*   **Proposed Change:**
    1.  **Enforce `Tracking.ts` as the Owner:** All tracking-related state (motion state, tracking status, distance, time) must be managed or proxied by the `Tracking.ts` object.
    2.  **Centralize Event Subscriptions:** The `useTracking.ts` hook should be the primary consumer of events from `Tracking.ts` and `MotionTracker.ts`. It will subscribe to events like `MotionStateChanged`, `TrackingStarted`, etc., and update a React state (e.g., via `useState` or a context provider).
    3.  **Refactor UI Components:** All UI components (e.g., on the HomeScreen) must be refactored to get their data *only* from the `useTracking.ts` hook. They must not call `Tracking.getProgress()` or `MotionTracker.getState()` directly.
    4.  **Add New Events:** The native modules should emit events for every significant state change (`ActivityChanged`, `MotionStateChanged`). `Tracking.ts` will expose these to the JS app.

### ✅ Periodic State Reconciliation

**Concept:** To prevent state drift, periodically re-broadcast the full state.

**Implementation Details:**

*   **File(s) to Modify:** Native `TrackingModule` (Java/Kotlin).
*   **Proposed Change:** The native `TrackingModule`, when active, should set up a periodic timer (e.g., every 30 seconds). Every time it fires, it should gather the complete current state (tracking status, distance, elapsed time, current motion state) and emit it as a single "full state" event (e.g., `onStateReconciliation`). The `useTracking.ts` hook will listen for this event and update its state accordingly.

---

##  pozostałe części (5-9)

The implementation for Parts 5 through 9 follows the same principles, applying changes to the native modules for logic and data calculation, and using the JS bridge and hooks to propagate that information consistently to the UI.

*   **Part 5 (Distance Mismatch):** Centralize distance calculation in the native `TrackingModule`. Ensure the notification and the UI both receive their value from the same `onTrackingProgress` event emitted by this module.
*   **Part 6 (Accuracy):** Implement consecutive confirmation logic in the native `MotionModule` before it changes state and emits an event.
*   **Part 7 (Debug Telemetry):** Add extensive logging within both native modules (`MotionModule` and `TrackingModule`) to log all decisions, sensor values, and state transitions, which can be viewed using `logcat`.
*   **Part 8 (Battery):** This is a core architectural principle for the native modules. Sensor listener registration should be tied to the state machine (e.g., high-frequency GPS only when in `MOVEMENT_CONFIRMED` or `TRACKING` state).
*   **Part 9 (Verification):** These are the test cases that must be passed after the implementation is complete.

---

By mapping the plan to the existing architecture, it's clear that the core deterministic logic will be built in the native Android modules, while the JavaScript/React Native layer will be responsible for orchestrating and reacting to the events these modules produce.
