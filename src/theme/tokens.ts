import { moderateScale } from 'react-native-size-matters';

/**
 * Design Tokens for Touch Grass App
 * Using react-native-size-matters for responsive scaling
 */

// Font Family tokens
export const FontFamily = {
  bold: 'Apercu',
  semibold: 'Apercu',
  medium: 'Apercu',
  regular: 'Apercu',
  light: 'Apercu',
};

// Color Palette (Touch Grass)
const colors = {
  skyBlue: '#87CEEB',
  meadowGreen: '#4F7942',
  terracotta: '#E2725B',
  oatmeal: '#F5F5DC',
  charcoal: '#2F2F2F',
  white: '#FFFFFF',
  black: '#010001',
  background: '#1B1b1A',
  backgroundSecondary: '#2A2A2B',

  // Semantic
  error: '#E7002A',
  success: '#3EC55F',
  warning: '#FECB2F',
  info: '#157EFB',
};

// Spacing
const spacing = {
  none: 0,
  xxxs: moderateScale(2),
  xxs: moderateScale(4),
  xs: moderateScale(8),
  sm: moderateScale(12),
  md: moderateScale(16),
  lg: moderateScale(20),
  xl: moderateScale(24),
  xxl: moderateScale(32),
  xxxl: moderateScale(40),
  xxxxl: moderateScale(48),
};

// Font Sizes
const fontSizes = {
  xxl: moderateScale(48),
  xl: moderateScale(36),
  lg: moderateScale(28),
  md: moderateScale(22),
  base: moderateScale(18),
  sm: moderateScale(16),
  xs: moderateScale(14),
  xxs: moderateScale(12),
  xxxs: moderateScale(10),
};

// Line Heights
const lineHeights = {
  xxl: moderateScale(56),
  xl: moderateScale(44),
  lg: moderateScale(36),
  md: moderateScale(28),
  base: moderateScale(24),
  sm: moderateScale(24),
  xs: moderateScale(20),
  xxs: moderateScale(18),
  xxxs: moderateScale(14),
};

// Border Radius
const borderRadius = {
  none: 0,
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(20),
  xxl: moderateScale(24),
  pill: 9999,
};

// Icon Sizes
const iconSizes = {
  xs: moderateScale(12),
  sm: moderateScale(16),
  md: moderateScale(20),
  lg: moderateScale(24),
  xl: moderateScale(32),
  xxl: moderateScale(40),
};

// Shadows
const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: moderateScale(1) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(2),
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(4),
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: moderateScale(4) },
    shadowOpacity: 0.12,
    shadowRadius: moderateScale(8),
    elevation: 4,
  },
};

// Animation
const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
};

// Text Styles
const textStyles = {
  heading: {
    fontFamily: FontFamily.bold,
    fontWeight: '700' as const,
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontWeight: '700' as const,
    fontSize: fontSizes.md,
    lineHeight: lineHeights.md,
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontWeight: '500' as const,
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontWeight: '400' as const,
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
  },
  link: {
    fontFamily: FontFamily.medium,
    fontWeight: '500' as const,
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
  },
};

const textColors = {
  primary: colors.white,
  secondary: colors.black,
  tertiary: '#8A8A8A',
  disabled: '#5A5A5A',
  inverse: colors.black,
  link: colors.skyBlue,
  accent: colors.terracotta,
  error: colors.error,
  success: colors.success,
};

// Theme Object
const theme = {
  colors,
  spacing,
  fontSizes,
  lineHeights,
  borderRadius,
  iconSizes,
  shadows,
  animation,
  textStyles,
  textColors,
};

export {
  colors,
  spacing,
  fontSizes,
  lineHeights,
  borderRadius,
  iconSizes,
  shadows,
  animation,
  textStyles,
  textColors,
};

export default theme;
