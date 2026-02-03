import { StyleSheet, TextStyle } from 'react-native';
import { colors, spacing } from '../../../theme';

/**
 * Shared styles for Usage report onboarding screens
 */
export const usageStyles = StyleSheet.create({
  // Container for animated slide pages
  slidePage: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },

  // Header section with centered text
  slideHeader: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  // Centered content area (for big numbers, etc.)
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },

  // Text alignment utility
  textCentered: {
    textAlign: 'center',
  },

  // Comparison section layout
  comparisonSection: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },

  // Group of comparison bars
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

/**
 * Pre-defined big number colors
 */
export const bigNumberColors = {
  purple: colors.accent.purple,
  green: '#2ECC71',
} as const;
