import { PermissionsAndroid, Platform } from 'react-native';

export const TrackingPermissions = {
  async requestAll(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    // Step 1: Activity Recognition (Android 10+)
    if (Platform.Version >= 29) {
      const activityResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        {
          title: 'Activity Recognition',
          message:
            'TouchGrass needs to detect when you start walking to automatically track your progress.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (activityResult !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }

    // Step 2: Fine Location
    const locationResult = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Access',
        message:
          'TouchGrass needs your location to measure the distance you walk.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    if (locationResult !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }

    // Step 3: Background Location (must be requested separately after fine location)
    if (Platform.Version >= 29) {
      const bgResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'Background Location',
          message:
            'TouchGrass needs background location access to track your walks even when your screen is off. Please select "Allow all the time".',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (bgResult !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }

    // Step 4: Notifications (Android 13+)
    if (Platform.Version >= 33) {
      const notifResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Notifications',
          message:
            'TouchGrass needs notification permission to show your walking progress.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (notifResult !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }

    return true;
  },

  async checkAll(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const fineLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    if (!fineLocation) return false;

    if (Platform.Version >= 29) {
      const activity = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      );
      if (!activity) return false;

      const bgLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      );
      if (!bgLocation) return false;
    }

    return true;
  },
};
