/**
 * Shared haptic feedback utilities
 */

type HapticType = 'impactLight' | 'impactMedium' | 'selection';

let HapticFeedback: {
  trigger: (type: string, options?: object) => void;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  HapticFeedback = require('react-native-haptic-feedback').default;
} catch {
  HapticFeedback = null;
}

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const triggerHaptic = (type: HapticType = 'impactLight'): void => {
  if (!HapticFeedback) return;
  try {
    HapticFeedback.trigger(type, hapticOptions);
  } catch {
    // Silently fail
  }
};
