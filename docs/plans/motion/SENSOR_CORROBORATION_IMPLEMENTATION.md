# Sensor Corroboration Implementation: Complete

## What Was Changed

**File:** [android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt](android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt)

**Method:** `onActivityTransitionDetected()`

### Before (Trusts Activity Recognition API Alone)
```kotlin
DetectedActivity.WALKING -> {
    if (isEntering) {
        val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = isStepRecent())
        MotionSessionController.onMovementDetected(conf, "walking")  // Always process
    }
}
```

### After (Requires Sensor Corroboration)
```kotlin
DetectedActivity.WALKING -> {
    if (isEntering) {
        val hasStep = isStepRecent()
        val variance = computeVariance()
        val hasVariance = variance >= config.varianceThreshold
        
        if (hasStep || hasVariance) {
            // Sensor corroboration confirmed
            val conf = computeConfidence(activityRecognitionActive = true, stepDetectedRecently = hasStep)
            Log.d(TAG, "WALKING ENTER with sensor corroboration (step=$hasStep, variance=$variance)")
            MotionSessionController.onMovementDetected(conf, "walking")
        } else {
            // Activity Recognition alone — reject
            Log.d(TAG, "WALKING ENTER but no sensor corroboration — ignoring")
        }
    }
}
```

## Changes Applied To:
- ✅ **DetectedActivity.WALKING** - Requires step OR variance
- ✅ **DetectedActivity.RUNNING** - Requires step OR variance  
- ✅ **DetectedActivity.ON_BICYCLE** - Requires variance (no steps while cycling)
- ✅ **DetectedActivity.IN_VEHICLE** - Unchanged (force stop, no sensors needed)
- ✅ **DetectedActivity.STILL** - Unchanged (direct inactivity detection)

## Expected Behavior Changes

### ❌ False Positives Eliminated:
```
Scenario: Sitting at desk typing
  Activity Recognition: "WALKING" detected (arm movement)
  Step Detector: No steps (you're not walking)
  Variance: 0.25 (< 0.6 threshold)
  
  OLD BEHAVIOR: Tracks anyway (false positive)
  NEW BEHAVIOR: "WALKING but no sensor corroboration — ignoring" (correct!)
```

### ✅ True Positives Still Work:
```
Scenario: Actually walking
  Activity Recognition: "WALKING" detected
  Step Detector: Fires every 0.5-1 second
  Variance: 1.2 (> 0.6 threshold)
  
  NEW BEHAVIOR: "WALKING with sensor corroboration (step=true, variance=1.2)"
                 → Confidence: 0.50 + 0.30 + 0.20 = 1.0 → Tracking starts ✓
```

## Rebuild Instructions

```powershell
# 1. Clean build artifacts
npm run clean

# 2. Rebuild APK
npm run build:apk

# 3. Deploy to device
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Or if using gradlew directly:
```powershell
cd android
./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

## Testing the Fix

### Test 1: Desk Movement Should NOT Trigger (Critical)
1. Enable background tracking
2. Keep phone on desk
3. Type at keyboard for 30+ seconds
4. Wave hands around phone
5. Check Logcat: `"WALKING ENTER but no sensor corroboration"`
6. ✅ **Expected:** `isTracking` remains `false`
7. ✅ **Logcat:** Multiple "no sensor corroboration" messages

### Test 2: Actual Walking SHOULD Trigger
1. Put phone in pocket/hand
2. Walk at normal pace for 10+ seconds
3. Check Logcat: `"WALKING ENTER with sensor corroboration"`
4. ✅ **Expected:** `isTracking` becomes `true` within 5-10 seconds
5. ✅ **Logcat:** "with sensor corroboration (step=true, variance=X.XX)"

### Test 3: Typing Then Walking
1. Start typing at desk for 5 seconds
2. Check `isTracking` = false (no corroboration)
3. Start walking
4. Check `isTracking` = true (with corroboration)
5. ✅ **Expected:** Clear transition when you start walking

## Logcat Patterns to Expect

### When Desk Typing:
```
D/MotionEngine: Activity transition: type=1, entering=true  // 1 = WALKING
D/MotionEngine: WALKING ENTER but no sensor corroboration (step=false, variance=0.25 < 0.6) — ignoring
```

### When Actually Walking:
```
D/MotionEngine: Activity transition: type=1, entering=true  // 1 = WALKING
D/MotionEngine: WALKING ENTER with sensor corroboration (step=true, variance=1.5)
D/MotionSession: Movement candidate started — waiting 5000ms to confirm
D/MotionSession: State: STILL → MOVING (type=walking)
```

### When Walking Stops:
```
D/MotionSession: Movement candidate reset (confidence too low: 0.45)
D/MotionSession: State: MOVING → AUTO_PAUSED (type=walking)
[After 20 seconds]
D/MotionSession: State: AUTO_PAUSED → STOPPED (type=walking, reason=inactivity)
```

## Files Modified
- ✅ [android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt](android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt)

## Files Documented
- ✅ [docs/motion-library-audit.md](docs/motion-library-audit.md) - Updated with implementation details
- ✅ [docs/tracking-issues-investigation.md](docs/tracking-issues-investigation.md) - Original investigation plan

## Next Steps

1. **Build and test** the APK with the sensor corroboration logic
2. **Monitor logcat** during normal phone use to see how many AR events are rejected
3. **Test scenarios:**
   - Desk work (typing, scrolling, etc.) — should NOT trigger
   - Walking slowly around house — might or might not trigger (depends on variance)
   - Actual exercise (brisk walking, running) — SHOULD trigger
4. **Fine-tune** variance threshold if needed (currently 0.6)

## Rollback Instructions (if needed)

If this change causes issues, revert to the previous version:

```powershell
git checkout android/app/src/main/java/com/touchgrass/motion/MotionEngine.kt
npm run build:apk
```

---

**Status:** ✅ Implemented and ready to test
