import { NativeModules, Platform } from 'react-native';

const { BuildConfigModule } = NativeModules;

export const BuildConfig = {
  REVENUECAT_API_KEY:
    Platform.OS === 'android'
      ? (BuildConfigModule?.REVENUECAT_API_KEY as string)
      : 'test_FCQVhIlJnsAXsRUEPKrOkgMZjDN',
};
