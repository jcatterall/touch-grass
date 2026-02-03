import { NativeModules, Platform } from 'react-native';

const { AppListModule } = NativeModules;

const isAvailable = Platform.OS === 'android' && AppListModule != null;

interface NativeInstalledApp {
  id: string;
  name: string;
  packageName: string;
  icon: string | null;
  isSystemApp: boolean;
}

export interface InstalledApp {
  id: string;
  name: string;
  packageName: string;
  icon?: string;
}

/**
 * Get installed apps excluding system apps
 * @returns Promise<InstalledApp[]> - array of installed apps sorted by name
 */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  if (!isAvailable) {
    console.warn(
      'AppListModule is not available. Did you rebuild the Android app?',
    );
    return [];
  }

  const apps: NativeInstalledApp[] = await AppListModule.getInstalledApps();

  return apps
    .filter(app => !app.isSystemApp) // Exclude system apps
    .map(app => ({
      id: app.id,
      name: app.name,
      packageName: app.packageName,
      icon: app.icon ?? undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all installed apps including system apps
 * @returns Promise<InstalledApp[]> - array of all installed apps sorted by name
 */
export async function getAllInstalledApps(): Promise<InstalledApp[]> {
  if (!isAvailable) {
    console.warn(
      'AppListModule is not available. Did you rebuild the Android app?',
    );
    return [];
  }

  const apps: NativeInstalledApp[] = await AppListModule.getInstalledApps();

  return apps
    .map(app => ({
      id: app.id,
      name: app.name,
      packageName: app.packageName,
      icon: app.icon ?? undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const AppList = {
  isAvailable,
  getInstalledApps,
  getAllInstalledApps,
};

export default AppList;
