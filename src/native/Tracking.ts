import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  EmitterSubscription,
} from 'react-native';

const { TrackingModule } = NativeModules;

const isAvailable = Platform.OS === 'android' && TrackingModule != null;

export interface TrackingProgress {
  distanceMeters: number;
  elapsedSeconds: number;
  goalReached: boolean;
}

const emitter = isAvailable ? new NativeEventEmitter(TrackingModule) : null;

export const Tracking = {
  isAvailable,

  async startTracking(
    goalType: 'distance' | 'time',
    goalValue: number,
    goalUnit: string,
  ): Promise<boolean> {
    if (!isAvailable) {
      console.warn(
        'TrackingModule is not available. Did you rebuild the Android app?',
      );
      return false;
    }
    return TrackingModule.startTracking(goalType, goalValue, goalUnit);
  },

  async stopTracking(): Promise<boolean> {
    if (!isAvailable) {
      return false;
    }
    return TrackingModule.stopTracking();
  },

  async getProgress(): Promise<TrackingProgress> {
    if (!isAvailable) {
      return { distanceMeters: 0, elapsedSeconds: 0, goalReached: false };
    }
    return TrackingModule.getProgress();
  },

  onProgress(
    callback: (progress: TrackingProgress) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onTrackingProgress', callback);
  },

  onGoalReached(callback: () => void): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onGoalReached', callback);
  },

  onTrackingStarted(callback: () => void): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onTrackingStarted', callback);
  },

  async getUnsavedSession(): Promise<{
    date: string;
    distanceMeters: number;
    elapsedSeconds: number;
    goalsReached: boolean;
  } | null> {
    if (!isAvailable) return null;
    return TrackingModule.getUnsavedSession();
  },
};