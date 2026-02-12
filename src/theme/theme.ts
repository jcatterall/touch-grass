/**
 * Design System - Theme Tokens
 * Production-ready design tokens for components (dark-mode only)
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const Colors = {
  // Brand Colors (Touch Grass Palette)
  meadowGreen: '#4F7942',
  meadowGreenPressed: '#3D6333',
  skyBlue: '#87CEEB',
  skyBluePressed: '#6BB8D4',
  terracotta: '#E2725B',
  terracottaPressed: '#C85D47',
  oatmeal: '#F5F5DC',
  charcoal: '#2F2F2F',

  // Extended Palette
  white: '#FFFFFF',
  black: '#000000',

  // Text Colors
  textDark: '#F5F5DC',

  // Danger/Error
  danger: '#E2725B',
  dangerDark: '#C85D47',

  // State Colors
  disabled: '#B0B0B0',
  disabledBackground: '#E0E0E0',
} as const;

// =============================================================================
// SPACING TOKENS
// =============================================================================

export const Spacing = {
  xxxs: 2,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  xxxxl: 48,
} as const;

// =============================================================================
// BORDER TOKENS
// =============================================================================

export const Borders = {
  width: {
    thin: 1,
    normal: 1.5,
    medium: 2,
    thick: 3,
  },
  radius: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 999,
  },
} as const;

// =============================================================================
// SHADOW TOKENS
// =============================================================================

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// =============================================================================
// DISABLED STATE COLORS
// =============================================================================

export const DisabledColors = {
  background: '#2A2A32',
  text: '#5A5A62',
  border: '#3D3D47',
  indicator: '#3D3D47',
} as const;

// =============================================================================
// COLOR SCHEMES (dark-mode only)
// =============================================================================

export const ColorSchemes = {
  // Primary Button (Solid)
  primary: {
    background: Colors.skyBlue,
    backgroundPressed: Colors.skyBluePressed,
    backgroundDisabled: '#3D3D47',
    text: Colors.black,
    textDisabled: '#6B6B73',
  },
  // Secondary Button (Toned/Filled Subtle)
  secondary: {
    background: '#4D4C4C',
    backgroundPressed: 'rgba(79, 121, 66, 0.35)',
    backgroundDisabled: '#3D3D47',
    text: '#FFFFFF',
    textDisabled: '#6B6B73',
  },
  // Tertiary Button (Outline/Ghost)
  tertiary: {
    background: 'transparent',
    backgroundPressed: 'rgba(135, 206, 235, 0.15)',
    backgroundDisabled: 'transparent',
    borderColor: Colors.skyBlue,
    borderColorDisabled: '#4D4D57',
    text: Colors.skyBlue,
    textDisabled: '#6B6B73',
  },
  // Danger Button
  danger: {
    background: Colors.danger,
    backgroundPressed: Colors.dangerDark,
    backgroundDisabled: '#3D3D47',
    text: Colors.white,
    textDisabled: '#6B6B73',
  },
  // Link Button (text-only, no background)
  link: {
    background: 'transparent',
    backgroundPressed: 'transparent',
    backgroundDisabled: 'transparent',
    text: Colors.white,
    textPressed: '#A8DAEF',
    textDisabled: '#6B6B73',
  },
} as const;

// =============================================================================
// BUTTON SHAPES
// =============================================================================

export const ButtonShapes = {
  pill: 999,
  rounded: 12,
} as const;

// =============================================================================
// BUTTON SIZES
// =============================================================================

export const ButtonSizes = {
  sm: {
    height: 32,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600' as const,
    iconSize: 16,
    borderWidth: 1.5,
  },
  md: {
    height: 40,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600' as const,
    iconSize: 18,
    borderWidth: 1.5,
  },
  lg: {
    height: 48,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600' as const,
    iconSize: 20,
    borderWidth: 2,
  },
  xl: {
    height: 56,
    paddingHorizontal: 24,
    fontSize: 17,
    fontWeight: '600' as const,
    iconSize: 22,
    borderWidth: 2,
  },
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const ButtonTypography = {
  fontFamily: undefined, // Uses system font (SF Pro on iOS, Roboto on Android)
  letterSpacing: 0.2,
} as const;

// =============================================================================
// ANIMATION TOKENS
// =============================================================================

export const Animation = {
  pressedScale: 0.97,
  duration: {
    press: 100,
    release: 150,
  },
} as const;

// =============================================================================
// CHIP SIZES
// =============================================================================

export const ChipSizes = {
  sm: {
    height: 32,
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: '500' as const,
    iconSize: 14,
    gap: 6,
  },
  md: {
    height: 40,
    paddingHorizontal: 20,
    fontSize: 15,
    fontWeight: '500' as const,
    iconSize: 16,
    gap: 8,
  },
} as const;

// =============================================================================
// CHIP COLOR SCHEMES (dark-mode only)
// =============================================================================

export const ChipColorSchemes = {
  // Blue variant
  blue: {
    selected: {
      background: Colors.meadowGreen,
      backgroundPressed: Colors.meadowGreenPressed,
      text: Colors.white,
    },
    unselected: {
      background: 'rgba(255, 255, 255, 0.08)',
      backgroundPressed: 'rgba(255, 255, 255, 0.12)',
      text: Colors.oatmeal,
    },
  },
  // Orange variant
  orange: {
    selected: {
      background: Colors.terracotta,
      backgroundPressed: Colors.terracottaPressed,
      text: Colors.white,
    },
    unselected: {
      background: 'rgba(255, 255, 255, 0.08)',
      backgroundPressed: 'rgba(255, 255, 255, 0.12)',
      text: Colors.oatmeal,
    },
  },
  // Outline variant
  outline: {
    selected: {
      background: 'rgba(135, 206, 235, 0.20)',
      backgroundPressed: 'rgba(135, 206, 235, 0.30)',
      text: Colors.skyBlue,
      borderColor: Colors.skyBlue,
    },
    unselected: {
      background: 'transparent',
      backgroundPressed: 'rgba(255, 255, 255, 0.08)',
      text: '#B0B0B0',
      borderColor: '#4D4D57',
    },
  },
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'danger'
  | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type ButtonShape = 'pill' | 'rounded';

// Chip Types
export type ChipVariant = 'blue' | 'orange' | 'outline';
export type ChipSize = 'sm' | 'md';

// Select Types
export type SelectVariant = 'blue' | 'orange';

// =============================================================================
// TOGGLE SIZES & TOKENS
// =============================================================================

export const ToggleSizes = {
  track: {
    width: 56,
    height: 32,
    borderRadius: 100, // Pill-shaped
  },
  thumb: {
    size: 24,
    margin: 4, // Inset from track edges
  },
} as const;

export const ToggleColorSchemes = {
  on: {
    track: Colors.meadowGreen,
    thumb: '#FFFFFF',
  },
  off: {
    track: '#4A4A54',
    thumb: '#E0E0E0',
  },
  disabled: {
    track: '#3D3D47',
    thumb: '#5A5A62',
  },
} as const;

export const ToggleShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 3,
  elevation: 3,
} as const;

// =============================================================================
// SELECT SIZES
// =============================================================================

export const SelectSizes = {
  rowHeight: 56,
  borderRadius: 12,
  paddingHorizontal: 16,
  indicatorSize: 24,
  checkIconSize: 14,
  gap: 12,
  fontSize: 16,
  fontWeight: '500' as const,
} as const;

// =============================================================================
// SELECT COLOR SCHEMES (dark-mode only)
// =============================================================================

export const SelectColorSchemes = {
  blue: {
    selected: {
      background: 'rgba(135, 206, 235, 0.20)',
      backgroundPressed: 'rgba(135, 206, 235, 0.30)',
      borderColor: Colors.skyBlue,
      text: '#FFFFFF',
      indicator: Colors.skyBlue,
      checkIcon: Colors.charcoal,
    },
    unselected: {
      background: 'rgba(255, 255, 255, 0.08)',
      backgroundPressed: 'rgba(255, 255, 255, 0.12)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      text: '#E0E0E0',
      indicator: '#6B6B73',
      checkIcon: 'transparent',
    },
  },
  orange: {
    selected: {
      background: 'rgba(226, 114, 91, 0.25)',
      backgroundPressed: 'rgba(226, 114, 91, 0.35)',
      borderColor: Colors.terracotta,
      text: '#FFFFFF',
      indicator: Colors.terracotta,
      checkIcon: Colors.white,
    },
    unselected: {
      background: 'rgba(255, 255, 255, 0.08)',
      backgroundPressed: 'rgba(255, 255, 255, 0.12)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      text: '#E0E0E0',
      indicator: '#6B6B73',
      checkIcon: 'transparent',
    },
  },
} as const;

// =============================================================================
// TOOLTIP TOKENS
// =============================================================================

export const TooltipSizes = {
  padding: {
    horizontal: 12,
    vertical: 10,
  },
  borderRadius: 10,
  fontSize: 14,
  fontWeight: '500' as const,
  maxWidth: 240,
  arrow: {
    size: 8,
    offset: 12,
  },
} as const;

export const TooltipColorSchemes = {
  charcoal: {
    background: '#3D3D47',
    text: Colors.white,
  },
  navy: {
    background: '#2A2A44',
    text: Colors.white,
  },
} as const;

export const TooltipAnimation: {
  initialScale: number;
  finalScale: number;
  duration: number;
} = {
  initialScale: 0.8,
  finalScale: 1.0,
  duration: 200,
};

export type TooltipVariant = 'charcoal' | 'navy';
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

// Pagination & Carousel Types
export type PaginationVariant = 'dots' | 'bars';

// =============================================================================
// PAGINATION TOKENS
// =============================================================================

export const PaginationSizes = {
  dot: {
    size: 8,
    activeWidth: 24,
    spacing: 8,
  },
  bar: {
    height: 4,
    inactiveWidth: 16,
    activeWidth: 32,
    spacing: 6,
    borderRadius: 2,
  },
} as const;

export const PaginationColorSchemes = {
  inactive: '#4A4A54',
  active: {
    blue: Colors.skyBlue,
    orange: Colors.terracotta,
  },
} as const;

export const PaginationAnimation = {
  duration: 300,
  damping: 15,
  stiffness: 150,
} as const;

// =============================================================================
// CAROUSEL TOKENS
// =============================================================================

export const CarouselSizes = {
  defaultHeight: 300,
  paginationBottomOffset: 24,
} as const;

// =============================================================================
// THEME OBJECT
// =============================================================================

export const Theme = {
  colors: Colors,
  colorSchemes: ColorSchemes,
  spacing: Spacing,
  borders: Borders,
  shadows: Shadows,
  disabled: DisabledColors,
  shapes: ButtonShapes,
  sizes: ButtonSizes,
  typography: ButtonTypography,
  animation: Animation,
  chip: {
    sizes: ChipSizes,
    colorSchemes: ChipColorSchemes,
  },
  select: {
    sizes: SelectSizes,
    colorSchemes: SelectColorSchemes,
  },
  toggle: {
    sizes: ToggleSizes,
    colorSchemes: ToggleColorSchemes,
    shadow: ToggleShadow,
  },
  tooltip: {
    sizes: TooltipSizes,
    colorSchemes: TooltipColorSchemes,
    animation: TooltipAnimation,
  },
  pagination: {
    sizes: PaginationSizes,
    colorSchemes: PaginationColorSchemes,
    animation: PaginationAnimation,
  },
  carousel: {
    sizes: CarouselSizes,
  },
} as const;

export default Theme;
