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

// Color Palette
const colors = {
  // Primary - Orange
  primary100: '#7A3E18',
  primary80: '#C45A1F',
  primary60: '#F47D31',
  primary40: '#FF9F4A',
  primary20: '#FFDCC4',

  // Secondary - Blue
  secondary100: '#1A3D7A',
  secondary80: '#2558B3',
  secondary60: '#3478F6',
  secondary40: '#6B9EFF',
  secondary20: '#C4DAFF',

  // Accent - Teal
  accent100: '#1F5C57',
  accent80: '#2E8A82',
  accent60: '#4ECDC4',
  accent40: '#8EEAE4',
  accent20: '#D4F7F5',

  // Warm - Yellow
  warm100: '#8A6B00',
  warm80: '#CCA000',
  warm60: '#FFD93D',
  warm40: '#FFE566',
  warm20: '#FFF5C4',

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
  pink: '#FFB6C1',
  pinkLight: '#FFC0CB',
  purple: '#9B59B6',
  mint: '#7ED9A6',
  peach: '#FFAB91',

  // Legacy nested structures for compatibility
  primary: {
    blue: '#3095FF',
    orange: '#F47D31',
  },
  neutral: {
    white: '#FFFFFF',
    black: '#1A1A1A',
    gray100: '#F5F5F5',
    gray200: '#E8E8E8',
    gray300: '#D1D1D1',
  },
  dark: {
    cardBackground: '#1A1F3D',
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
    purple: '#9B59B6',
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
    secondary: colors.dark10,
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
