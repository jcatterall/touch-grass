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

export type MotionState = 'STILL' | 'MOVING' | 'AUTO_PAUSED' | 'STOPPED';

export type MotionActivityType =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'in_vehicle'
  | 'still'
  | 'unknown';

export interface MotionEvent {
  activityType: MotionActivityType;
  reason?: string;
}

export interface MotionStateUpdate {
  activity: MotionActivityType;
  stepDetected: boolean;
  gpsActive: boolean;
}

export interface MotionConfig {
  autoPauseDelayWalkRun?: number;
  autoPauseDelayCycling?: number;
  stopDelay?: number;
  movementConfidenceThreshold?: number;
  varianceThreshold?: number;
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
   * Resolves when the service has started.
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
    if (!isAvailable) return { state: 'STILL', activityType: 'unknown' };
    return MotionModule.getState();
  },

  /**
   * Fires when movement above threshold is detected for the first time.
   * Payload: { activityType: 'walking' | 'running' | 'cycling' }
   */
  onMotionStarted(
    callback: (event: MotionEvent) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('MotionStarted', callback);
  },

  /**
   * Fires when brief inactivity is detected (e.g. traffic light pause).
   */
  onMotionAutoPaused(
    callback: (event: MotionEvent) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('MotionAutoPaused', callback);
  },

  /**
   * Fires when movement resumes after an auto-pause.
   */
  onMotionResumed(
    callback: (event: MotionEvent) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('MotionResumed', callback);
  },

  /**
   * Fires when the motion session ends.
   * Payload: { activityType, reason: 'vehicle_detected' | 'inactivity_timeout' | 'manual' }
   */
  onMotionStopped(
    callback: (event: MotionEvent) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('MotionStopped', callback);
  },

  /**
   * Fires periodically (every ~500ms) with current detailed motion state.
   * Provides reactive updates for UI debug info without waiting for state transitions.
   * Payload: { activity: string, stepDetected: boolean, gpsActive: boolean }
   */
  onMotionStateUpdate(
    callback: (update: MotionStateUpdate) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('MotionStateUpdate', callback);
  },
};
