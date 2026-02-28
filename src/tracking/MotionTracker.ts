import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  PermissionsAndroid,
  type EmitterSubscription,
} from 'react-native';

const { MotionModule } = NativeModules;

const isAvailable = Platform.OS === 'android' && MotionModule != null;

if (Platform.OS === 'android' && !MotionModule) {
  console.error(
    '[MotionTracker] MotionModule is not available. ' +
      'Did you add MotionPackage() to MainApplication.getPackages()?',
  );
}

/** States from the deterministic motion state machine. */
export type MotionState =
  | 'UNKNOWN'
  | 'IDLE'
  | 'POTENTIAL_MOVEMENT'
  | 'MOVING'
  | 'POTENTIAL_STOP';

export type MotionActivityType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'in_vehicle'
  | 'still'
  | 'unknown';

/**
 * Payload for the unified MotionStateChanged event.
 * Emitted on every state machine transition.
 */
export interface MotionStateChangedEvent {
  state: MotionState;
  activityType: MotionActivityType;
  confidence: number;
  distanceMeters: number;
  timestamp: number;
  // Optional: native hint that TrackingService was signalled for this transition
  trackingSignalled?: boolean;
  // Optional: why tracking was not signalled while moving
  trackingBlockedReason?: string | null;
  // Optional: last known real activity (preserved across IDLE) for re-trigger heuristics
  lastKnownActivity?: MotionActivityType;
}

/**
 * Payload for the periodic MotionStateUpdate debug event.
 * Emitted every ~500ms with live sensor readings.
 */
export interface MotionStateUpdate {
  activity: MotionActivityType;
  stepDetected: boolean;
  gpsActive: boolean;
  variance: number;
  cadence: number;
}

export interface MotionConfig {
  /** Duration movement must be sustained before POTENTIAL_MOVEMENT → MOVING (ms). Default: 4000 */
  movementConfirmWindowMs?: number;
  /** Minimum confidence score [0–1] for a signal to count as movement. Default: 0.30 */
  movementConfidenceThreshold?: number;
  /** Step absence duration before stop evaluation begins (ms). Default: 7000 */
  stepStopTimeoutMs?: number;
  /** Accelerometer variance below which device is considered stationary. Default: 0.12 */
  varianceStopThreshold?: number;
  /** Duration POTENTIAL_STOP must hold before stop confirmed (ms). Default: 9000 */
  stopConfirmWindowMs?: number;
  /** Grace period after last movement signal before stop conditions are evaluated (ms). Default: 3500 */
  transitionGraceMs?: number;
  /** Extended step absence timeout for cycling (ms). Default: 20000 */
  stepStopTimeoutCyclingMs?: number;
  /** Accelerometer variance threshold for start detection. Default: 0.18 */
  varianceStartThreshold?: number;
  /** Debounce duration (ms) variance must stay above varianceStartThreshold. Default: 500 */
  varianceStartDebounceMs?: number;
  /** Number of distinct signal types required within corroborationWindowMs to start tracking. Default: 2 */
  corroborationMinSignals?: number;
  /** Time window (ms) for corroboration signal counting. Default: 3000 */
  corroborationWindowMs?: number;
  /** Minimum cadence (steps/sec) before confirming MOVING. Default: 0.8 */
  cadenceConfirmMinStepsSec?: number;
  /** Rolling window (ms) for cadence calculation. Default: 5000 */
  cadenceMeasureWindowMs?: number;
  /** Variance below which stationary lock candidate begins. Default: 0.08 */
  stationaryLockVariance?: number;
  /** Duration (ms) of ultra-low variance + zero cadence to engage stationary lock. Default: 30000 */
  stationaryLockDurationMs?: number;
  /** Variance must spike above this to release stationary lock. Default: 0.35 */
  stationaryUnlockVariance?: number;
  /** Cadence (steps/sec) below which cadence is considered dropped. Default: 0.3 */
  cadenceDropThreshold?: number;
  /** Duration (ms) cadence must stay dropped to trigger early POTENTIAL_STOP. Default: 5000 */
  cadenceDropDurationMs?: number;
  /** Variance above which micro-movement guard fires during POTENTIAL_STOP. Default: 0.20 */
  microMovementVarianceGuard?: number;
}

const emitter = isAvailable ? new NativeEventEmitter(MotionModule) : null;

/**
 * Requests Android permissions required by MotionTracker.
 * Must be called before startMonitoring().
 */
export async function requestMotionPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  const permissions: string[] = [];

  if (Platform.Version >= 29) {
    permissions.push(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
  }

  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  if (permissions.length === 0) return true;

  const results = await PermissionsAndroid.requestMultiple(
    permissions as Array<
      (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]
    >,
  );

  return Object.values(results).every(
    r => r === PermissionsAndroid.RESULTS.GRANTED,
  );
}

export const MotionTracker = {
  isAvailable,

  /**
   * Starts motion monitoring. Requests permissions automatically.
   * Resolves when the foreground service has started.
   */
  async startMonitoring(config?: MotionConfig): Promise<void> {
    if (!isAvailable) {
      console.warn('[MotionTracker] MotionModule not available');
      return;
    }
    const granted = await requestMotionPermissions();
    if (!granted) throw new Error('Required permissions not granted');
    return MotionModule.startMonitoring(config ?? null);
  },

  /**
   * Stops motion monitoring and the background service.
   */
  async stopMonitoring(): Promise<void> {
    if (!isAvailable) return;
    return MotionModule.stopMonitoring();
  },

  /**
   * Returns whether the motion monitoring service is currently active.
   */
  async isMonitoring(): Promise<boolean> {
    if (!isAvailable) return false;
    return MotionModule.isMonitoring();
  },

  /**
   * Returns the current motion state and activity type.
   */
  async getState(): Promise<{
    state: MotionState;
    activityType: MotionActivityType;
  }> {
    if (!isAvailable) return { state: 'IDLE', activityType: 'unknown' };
    return MotionModule.getState();
  },

  /**
   * Subscribes to the unified MotionStateChanged event.
   * Emitted on every state machine transition with full payload.
   * This is the single source of truth for motion state in React Native.
   *
   * States:
   *   UNKNOWN            → app just started, sensors initializing
   *   IDLE               → not moving, low-power passive listening
   *   POTENTIAL_MOVEMENT → movement candidate detected, waiting to confirm (~4s)
   *   MOVING             → confirmed movement, GPS active, foreground service on
   *   POTENTIAL_STOP     → stop conditions met, waiting to confirm stop (~10s)
   */
  onMotionStateChanged(
    callback: (event: MotionStateChangedEvent) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('MotionStateChanged', callback);
  },

  /**
   * Subscribes to periodic debug state updates (~500ms).
   * Includes live sensor readings: step detection, GPS active, variance.
   */
  onMotionStateUpdate(
    callback: (update: MotionStateUpdate) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('MotionStateUpdate', callback);
  },
};
