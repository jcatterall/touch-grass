import { NativeModules, Platform } from 'react-native';

const { AppBlockerModule } = NativeModules;

const isAvailable = Platform.OS === 'android' && AppBlockerModule != null;

export type EmergencyUnblockMode = 'none' | '5m' | '30m' | 'today';

export interface EmergencyUnblockStatus {
  active: boolean;
  mode: EmergencyUnblockMode;
  untilMs: number;
  remainingMs: number;
}

const EMERGENCY_UNBLOCK_DURATION_5M_MS = 5 * 60 * 1000;
const EMERGENCY_UNBLOCK_DURATION_30M_MS = 30 * 60 * 1000;

const DEFAULT_EMERGENCY_STATUS: EmergencyUnblockStatus = {
  active: false,
  mode: 'none',
  untilMs: 0,
  remainingMs: 0,
};

export const AppBlocker = {
  isAvailable,
  EMERGENCY_UNBLOCK_DURATION_5M_MS,
  EMERGENCY_UNBLOCK_DURATION_30M_MS,

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

  async getBlockedAttemptsTodayForApp(packageName: string): Promise<number> {
    if (!isAvailable) return 0;
    return AppBlockerModule.getBlockedAttemptsTodayForApp(packageName);
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

  async startEmergencyUnblock(
    mode: EmergencyUnblockMode,
    durationMs: number,
  ): Promise<EmergencyUnblockStatus> {
    if (!isAvailable) return DEFAULT_EMERGENCY_STATUS;
    const status = await AppBlockerModule.startEmergencyUnblock(
      mode,
      durationMs,
    );
    return {
      active: !!status?.active,
      mode: (status?.mode ?? 'none') as EmergencyUnblockMode,
      untilMs: Number(status?.untilMs ?? 0),
      remainingMs: Number(status?.remainingMs ?? 0),
    };
  },

  async getEmergencyUnblockStatus(): Promise<EmergencyUnblockStatus> {
    if (!isAvailable) return DEFAULT_EMERGENCY_STATUS;
    const status = await AppBlockerModule.getEmergencyUnblockStatus();
    return {
      active: !!status?.active,
      mode: (status?.mode ?? 'none') as EmergencyUnblockMode,
      untilMs: Number(status?.untilMs ?? 0),
      remainingMs: Number(status?.remainingMs ?? 0),
    };
  },

  async clearEmergencyUnblock(): Promise<boolean> {
    if (!isAvailable) return false;
    return AppBlockerModule.clearEmergencyUnblock();
  },
};
