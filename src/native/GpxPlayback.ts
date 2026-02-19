import { NativeModules, Platform } from 'react-native';

const { GpxPlaybackModule } = NativeModules;

/**
 * Debug-only GPX playback module.
 * Injects 10 mock GPS waypoints (100m apart, 5s interval) to simulate a 1km walk
 * end-to-end without needing a physical device outdoors.
 *
 * Only functional in Android debug builds — isAvailable is false otherwise.
 */
export const GpxPlayback = {
  isAvailable: __DEV__ && Platform.OS === 'android' && GpxPlaybackModule != null,

  startPlayback(): Promise<boolean> {
    if (!this.isAvailable) return Promise.resolve(false);
    return GpxPlaybackModule.startPlayback();
  },

  stopPlayback(): Promise<boolean> {
    if (!this.isAvailable) return Promise.resolve(false);
    return GpxPlaybackModule.stopPlayback();
  },
};
