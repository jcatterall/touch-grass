import { NativeModules, Platform } from 'react-native';

const { UsageStatsModule } = NativeModules;

const isAvailable = Platform.OS === 'android' && UsageStatsModule != null;

export interface DailyUsage {
  day: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

export interface AppUsage {
  name: string;
  packageName: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
  time: string;
  /** Base64-encoded PNG app icon (Android only) */
  icon?: string;
}

export const UsageStats = {
  /**
   * Check if the native module is available
   */
  isAvailable,

  /**
   * Check if the app has usage stats permission
   * @returns Promise<boolean> - true if permission is granted
   */
  hasPermission: async (): Promise<boolean> => {
    if (!isAvailable) {
      console.warn(
        'UsageStatsModule is not available. Did you rebuild the Android app?',
      );
      return false;
    }
    return UsageStatsModule.hasPermission();
  },

  /**
   * Open the system settings to request usage stats permission
   * The user must manually enable the permission for the app
   * @returns Promise<boolean> - true if settings were opened successfully
   */
  requestPermission: async (): Promise<boolean> => {
    if (!isAvailable) {
      console.warn(
        'UsageStatsModule is not available. Did you rebuild the Android app?',
      );
      return false;
    }
    return UsageStatsModule.requestPermission();
  },

  /**
   * Get daily usage stats for the past 7 days
   * @returns Promise<DailyUsage[]> - array of daily usage data
   */
  getWeeklyUsage: async (): Promise<DailyUsage[]> => {
    if (!isAvailable) {
      console.warn(
        'UsageStatsModule is not available. Did you rebuild the Android app?',
      );
      return [];
    }
    return UsageStatsModule.getWeeklyUsage();
  },

  /**
   * Get app usage stats for the past 7 days
   * @returns Promise<AppUsage[]> - array of app usage data sorted by usage time
   */
  getAppUsage: async (): Promise<AppUsage[]> => {
    if (!isAvailable) {
      console.warn(
        'UsageStatsModule is not available. Did you rebuild the Android app?',
      );
      return [];
    }
    return UsageStatsModule.getAppUsage();
  },

  /**
   * Get the number of device pickups/unlocks for today
   * @returns Promise<number> - number of pickups today
   */
  getDailyPickups: async (): Promise<number> => {
    if (!isAvailable) {
      console.warn(
        'UsageStatsModule is not available. Did you rebuild the Android app?',
      );
      return 0;
    }
    return UsageStatsModule.getDailyPickups();
  },
};

export default UsageStats;
