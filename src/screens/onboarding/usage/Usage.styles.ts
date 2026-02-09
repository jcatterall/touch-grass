import { StyleSheet, TextStyle } from 'react-native';
import { colors, spacing } from '../../../theme';

/**
 * Centralized big number colors used across usage screens
 */
export const bigNumberColors = {
  green: colors.success,
  red: colors.primary60,
  terracotta: colors.terracotta,
};

export const usageStyles = StyleSheet.create({
  slidePage: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  slideHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  textCentered: {
    textAlign: 'center',
  },
  comparisonSection: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  barsGroup: {
    gap: spacing.xs,
  },
});

/**
 * Creates a big number text style with the specified color
 */
export const createBigNumberStyle = (
  color: string,
  fontSize = 100,
): TextStyle => ({
  fontSize,
  fontWeight: '700',
  color,
  textAlign: 'center',
});
