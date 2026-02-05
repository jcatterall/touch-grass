import { StyleSheet } from 'react-native';
import { spacing } from '../../theme';

/**
 * Shared styles for all onboarding screens
 */
export const onboardingStyles = StyleSheet.create({
  // Layout
  flex: {
    flex: 1,
  },
  flexReverse: {
    flexDirection: 'row-reverse',
  },
  row: {
    flexDirection: 'row',
  },
  spaceBetween: {
    justifyContent: 'space-between',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Text
  textCenter: {
    textAlign: 'center',
  },

  // Common content layouts
  contentCentered: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  contentTop: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.md,
  },

  // Spacing
  gapSm: { gap: spacing.sm },
  gapMd: { gap: spacing.md },
  gapLg: { gap: spacing.lg },
  gapXl: { gap: spacing.xl },
  gapXxl: { gap: spacing.xxl },
  gapXxxl: { gap: spacing.xxxl },
  gapXxxxl: { gap: spacing.xxxxl },

  marginTopXl: { marginTop: spacing.xl },
  marginTopXxxl: { marginTop: spacing.xxxxl },
});
