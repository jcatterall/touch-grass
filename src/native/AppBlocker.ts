import { NativeModules, Platform } from 'react-native';

const { AppBlockerModule } = NativeModules;

const isAvailable = Platform.OS === 'android' && AppBlockerModule != null;

export const AppBlocker = {
  isAvailable,

  async hasOverlayPermission(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.hasOverlayPermission();
  },

  async requestOverlayPermission(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.requestOverlayPermission();
  },

  async hasUsageStatsPermission(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.hasUsageStatsPermission();
  },

  async requestUsageStatsPermission(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.requestUsageStatsPermission();
  },

  async hasNotificationListenerPermission(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.hasNotificationListenerPermission();
  },

  async requestNotificationListenerPermission(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.requestNotificationListenerPermission();
  },

  async getNotificationsBlockedTodayForApp(
    packageName: string,
  ): Promise<number> {
    if (!isAvailable) return 0;
    return AppBlockerModule.getNotificationsBlockedTodayForApp(packageName);
  },

  async getNotificationsBlockedTodayTotal(): Promise<number> {
    if (!isAvailable) return 0;
    return AppBlockerModule.getNotificationsBlockedTodayTotal();
  },

  async updateBlockerConfig(
    blockedPackages: string[],
    goalsReached: boolean,
    hasPermanent: boolean,
  ): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.updateBlockerConfig(
      blockedPackages,
      goalsReached,
      hasPermanent,
    );
  },

  async startBlocker(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.startBlocker();
  },

  async stopBlocker(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.stopBlocker();
  },

  async getCurrentlyBlockedApp(): Promise<string | null> {
    if (!isAvailable) return null;
    return AppBlockerModule.getCurrentlyBlockedApp();
  },

  async clearCurrentlyBlockedApp(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.clearCurrentlyBlockedApp();
  },

  async setImmersiveMode(enabled: boolean): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.setImmersiveMode(enabled);
  },

  async dismissBlockingScreen(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.dismissBlockingScreen();
  },
};
