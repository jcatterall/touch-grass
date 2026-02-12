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
  // Primary - Terracotta
  primary100: '#8A3D2E',
  primary80: '#C85D47',
  primary60: '#E2725B',
  primary40: '#EF9A88',
  primary20: '#F9D5CD',

  // Secondary - Sky Blue
  secondary100: '#4A7A8F',
  secondary80: '#6BB8D4',
  secondary60: '#87CEEB',
  secondary40: '#A8DAEF',
  secondary20: '#D4EDF7',

  // Accent - Meadow Green
  accent100: '#2D4A24',
  accent80: '#3D6333',
  accent60: '#4F7942',
  accent40: '#7CA070',
  accent20: '#C4D9BE',

  // Warm - Oatmeal
  warm100: '#8A8466',
  warm80: '#CCC4A0',
  warm60: '#F5F5DC',
  warm40: '#F8F8E6',
  warm20: '#FCFCF3',

  // Neutral
  neutral100: '#1A1A1A',
  neutral90: '#333333',
  neutral80: '#4D4D4D',
  neutral70: '#666666',
  neutral60: '#808080',
  neutral50: '#9E9E9E',
  neutral40: '#B8B8B8',
  neutral30: '#D1D1D1',
  neutral20: '#E8E8E8',
  neutral10: '#F5F5F5',
  neutral5: '#FAFAFA',
  white: '#FFFFFF',

  // Dark Mode
  dark100: '#0A0D1A',
  dark90: '#0F1535',
  dark80: '#1A1F3D',
  dark70: '#252A4A',
  dark60: '#2D3250',
  dark50: '#3D4470',
  dark40: '#4A4F6A',
  dark30: '#6B7194',
  dark20: '#8A90B3',
  dark10: '#B8BDD4',

  // Semantic
  error: '#E7002A',
  errorLight: '#FFE5EA',
  success: '#3EC55F',
  successLight: '#E5F9EB',
  warning: '#FECB2F',
  warningLight: '#FFF8E0',
  info: '#157EFB',
  infoLight: '#E5F1FF',

  // Illustration
  skyBlue: '#87CEEB',
  skyBlueLight: '#B0E0E6',
  meadowGreen: '#4F7942',
  terracotta: '#E2725B',
  oatmeal: '#F5F5DC',
  charcoalDark: '#2F2F2F',

  // Legacy nested structures for compatibility
  primary: {
    blue: '#87CEEB',
    orange: '#E2725B',
  },
  neutral: {
    white: '#FFFFFF',
    black: '#010001',
    gray100: '#F5F5F5',
    gray200: '#E8E8E8',
    gray300: '#D1D1D1',
  },
  dark: {
    cardBackground: '#1B1b1A',
    cardSecondary: '#2A2A2B',
    textPrimary: '#FFFFFF',
    textSecondary: '#B8BDD4',
    textTertiary: '#6B7194',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#666666',
    tertiary: '#9E9E9E',
  },
  accent: {
    green: '#4F7942',
  },
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
    shadowColor: colors.neutral100,
    shadowOffset: { width: 0, height: moderateScale(1) },
    shadowOpacity: 0.05,
    shadowRadius: moderateScale(2),
    elevation: 1,
  },
  md: {
    shadowColor: colors.neutral100,
    shadowOffset: { width: 0, height: moderateScale(2) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(4),
    elevation: 2,
  },
  lg: {
    shadowColor: colors.neutral100,
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

// Text Colors by theme
const textColors = {
  light: {
    primary: colors.neutral100,
    secondary: colors.neutral70,
    tertiary: colors.neutral50,
    disabled: colors.neutral40,
    inverse: colors.white,
    link: colors.secondary60,
    accent: colors.primary60,
    error: colors.error,
    success: colors.success,
  },
  dark: {
    primary: colors.white,
    secondary: colors.white,
    tertiary: colors.dark20,
    disabled: colors.dark30,
    inverse: colors.neutral100,
    link: colors.secondary40,
    accent: colors.primary40,
    error: colors.error,
    success: colors.success,
  },
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
