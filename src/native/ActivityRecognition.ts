import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  EmitterSubscription,
} from 'react-native';

const { ActivityRecognitionModule } = NativeModules;

const isAvailable =
  Platform.OS === 'android' && ActivityRecognitionModule != null;

export type ActivityType = 'WALKING' | 'RUNNING' | 'STILL';
export type TransitionType = 'ENTER' | 'EXIT';

export interface ActivityTransitionEvent {
  activity: ActivityType;
  transition: TransitionType;
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

  onTransition(
    callback: (event: ActivityTransitionEvent) => void,
  ): EmitterSubscription | null {
    if (!emitter) return null;
    return emitter.addListener('onActivityTransition', callback);
  },
};
