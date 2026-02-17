import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  EmitterSubscription,
} from 'react-native';

const { ActivityRecognitionModule } = NativeModules;

const isAvailable =
  Platform.OS === 'android' && ActivityRecognitionModule != null;

export type ActivityType = 'WALKING' | 'RUNNING' | 'CYCLING' | 'STILL';

export interface ActivityDetectedEvent {
  activity: ActivityType;
  confidence: number;
}

const emitter = isAvailable
  ? new NativeEventEmitter(ActivityRecognitionModule)
  : null;

export const ActivityRecognition = {
  isAvailable,

  async start(): Promise<boolean> {
    if (!isAvailable) {
      console.warn(
        'ActivityRecognitionModule is not available. Did you rebuild the Android app?',
      );
      return false;
    }
    return ActivityRecognitionModule.start();
  },

  async stop(): Promise<boolean> {
    if (!isAvailable) {
      return false;
    }
    return ActivityRecognitionModule.stop();
  },

  /**
   * For debug builds, allows triggering a fake activity update to test the receiver logic.
   */
  async triggerTest(activityType: ActivityType): Promise<boolean> {
    if (__DEV__ && isAvailable) {
      console.log(`Triggering test activity: ${activityType}`);
      return ActivityRecognitionModule.triggerTest(activityType);
    }
    console.warn('triggerTest is only available in debug builds on Android.');
    return false;
  },

  onActivityDetected(
    callback: (event: ActivityDetectedEvent) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onActivityDetected', callback);
  },
};