/**
 * Headspace Design System - Theme Tokens
 * Production-ready design tokens for Button and Chip components
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const HSColors = {
  // Brand Colors
  primaryBlue: '#4759FF',
  orange: '#F27D42',
  yellow: '#FFC52C',
  charcoal: '#2D2E36',

  // Extended Palette
  white: '#FFFFFF',
  black: '#000000',

  // Danger/Error
  danger: '#E53935',
  dangerDark: '#C62828',

  // State Colors
  disabled: '#B0B0B0',
  disabledBackground: '#E0E0E0',
} as const;

// =============================================================================
// LIGHT & DARK MODE COLOR SCHEMES
// =============================================================================

export const HSColorSchemes = {
  light: {
    // Primary Button (Solid)
    primary: {
      background: HSColors.primaryBlue,
      backgroundPressed: '#3A4AD9',
      backgroundDisabled: HSColors.disabledBackground,
      text: HSColors.white,
      textDisabled: HSColors.disabled,
    },
    // Secondary Button (Toned/Filled Subtle)
    secondary: {
      background: 'rgba(71, 89, 255, 0.12)',
      backgroundPressed: 'rgba(71, 89, 255, 0.20)',
      backgroundDisabled: HSColors.disabledBackground,
      text: HSColors.primaryBlue,
      textDisabled: HSColors.disabled,
    },
    // Tertiary Button (Outline/Ghost)
    tertiary: {
      background: 'transparent',
      backgroundPressed: 'rgba(71, 89, 255, 0.08)',
      backgroundDisabled: 'transparent',
      borderColor: HSColors.primaryBlue,
      borderColorDisabled: HSColors.disabled,
      text: HSColors.primaryBlue,
      textDisabled: HSColors.disabled,
    },
    // Danger Button
    danger: {
      background: HSColors.danger,
      backgroundPressed: HSColors.dangerDark,
      backgroundDisabled: HSColors.disabledBackground,
      text: HSColors.white,
      textDisabled: HSColors.disabled,
    },
  },
  dark: {
    // Primary Button (Solid)
    primary: {
      background: HSColors.primaryBlue,
      backgroundPressed: '#5A6BFF',
      backgroundDisabled: '#3D3D47',
      text: HSColors.white,
      textDisabled: '#6B6B73',
    },
    // Secondary Button (Toned/Filled Subtle)
    secondary: {
      background: 'rgba(71, 89, 255, 0.20)',
      backgroundPressed: 'rgba(71, 89, 255, 0.30)',
      backgroundDisabled: '#3D3D47',
      text: '#8B9AFF',
      textDisabled: '#6B6B73',
    },
    // Tertiary Button (Outline/Ghost)
    tertiary: {
      background: 'transparent',
      backgroundPressed: 'rgba(71, 89, 255, 0.15)',
      backgroundDisabled: 'transparent',
      borderColor: '#8B9AFF',
      borderColorDisabled: '#4D4D57',
      text: '#8B9AFF',
      textDisabled: '#6B6B73',
    },
    // Danger Button
    danger: {
      background: HSColors.danger,
      backgroundPressed: '#EF5350',
      backgroundDisabled: '#3D3D47',
      text: HSColors.white,
      textDisabled: '#6B6B73',
    },
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

export const HSAnimation = {
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
// CHIP COLOR SCHEMES
// =============================================================================

export const ChipColorSchemes = {
  light: {
    // Blue variant (Primary Blue when selected)
    blue: {
      selected: {
        background: HSColors.primaryBlue,
        backgroundPressed: '#3A4AD9',
        text: HSColors.white,
      },
      unselected: {
        background: '#F7F7F7',
        backgroundPressed: '#EBEBEB',
        text: HSColors.charcoal,
      },
    },
    // Orange variant (Orange when selected)
    orange: {
      selected: {
        background: HSColors.orange,
        backgroundPressed: '#E06A30',
        text: HSColors.white,
      },
      unselected: {
        background: '#F7F7F7',
        backgroundPressed: '#EBEBEB',
        text: HSColors.charcoal,
      },
    },
    // Outline variant (bordered style)
    outline: {
      selected: {
        background: 'rgba(71, 89, 255, 0.08)',
        backgroundPressed: 'rgba(71, 89, 255, 0.15)',
        text: HSColors.primaryBlue,
        borderColor: HSColors.primaryBlue,
      },
      unselected: {
        background: 'transparent',
        backgroundPressed: 'rgba(0, 0, 0, 0.04)',
        text: HSColors.charcoal,
        borderColor: '#D1D1D1',
      },
    },
  },
  dark: {
    // Blue variant
    blue: {
      selected: {
        background: HSColors.primaryBlue,
        backgroundPressed: '#5A6BFF',
        text: HSColors.white,
      },
      unselected: {
        background: '#3D3D47',
        backgroundPressed: '#4A4A54',
        text: '#E0E0E0',
      },
    },
    // Orange variant
    orange: {
      selected: {
        background: HSColors.orange,
        backgroundPressed: '#FF8F55',
        text: HSColors.white,
      },
      unselected: {
        background: '#3D3D47',
        backgroundPressed: '#4A4A54',
        text: '#E0E0E0',
      },
    },
    // Outline variant
    outline: {
      selected: {
        background: 'rgba(71, 89, 255, 0.20)',
        backgroundPressed: 'rgba(71, 89, 255, 0.30)',
        text: '#8B9AFF',
        borderColor: '#8B9AFF',
      },
      unselected: {
        background: 'transparent',
        backgroundPressed: 'rgba(255, 255, 255, 0.08)',
        text: '#B0B0B0',
        borderColor: '#4D4D57',
      },
    },
  },
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
export type ButtonShape = 'pill' | 'rounded';
export type HSColorMode = 'light' | 'dark';

// Chip Types
export type ChipVariant = 'blue' | 'orange' | 'outline';
export type ChipSize = 'sm' | 'md';

// Select Types
export type SelectVariant = 'blue' | 'orange';

// =============================================================================
// TOGGLE SIZES & TOKENS (Headspace Style)
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
  light: {
    on: {
      track: '#01A652', // Vibrant green
      thumb: '#FFFFFF',
    },
    off: {
      track: '#EAEAEA', // Soft gray
      thumb: '#FFFFFF',
    },
    disabled: {
      track: '#D1D1D1',
      thumb: '#F5F5F5',
    },
  },
  dark: {
    on: {
      track: '#01A652',
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
// SELECT COLOR SCHEMES
// =============================================================================

export const SelectColorSchemes = {
  light: {
    blue: {
      selected: {
        background: 'rgba(71, 89, 255, 0.08)',
        backgroundPressed: 'rgba(71, 89, 255, 0.15)',
        borderColor: HSColors.primaryBlue,
        text: HSColors.charcoal,
        indicator: HSColors.primaryBlue,
        checkIcon: HSColors.white,
      },
      unselected: {
        background: '#F7F7F7',
        backgroundPressed: '#EBEBEB',
        borderColor: 'transparent',
        text: HSColors.charcoal,
        indicator: '#D1D1D1',
        checkIcon: 'transparent',
      },
    },
    orange: {
      selected: {
        background: 'rgba(242, 125, 66, 0.08)',
        backgroundPressed: 'rgba(242, 125, 66, 0.15)',
        borderColor: HSColors.orange,
        text: HSColors.charcoal,
        indicator: HSColors.orange,
        checkIcon: HSColors.white,
      },
      unselected: {
        background: '#F7F7F7',
        backgroundPressed: '#EBEBEB',
        borderColor: 'transparent',
        text: HSColors.charcoal,
        indicator: '#D1D1D1',
        checkIcon: 'transparent',
      },
    },
  },
  dark: {
    blue: {
      selected: {
        background: 'rgba(71, 89, 255, 0.20)',
        backgroundPressed: 'rgba(71, 89, 255, 0.30)',
        borderColor: '#8B9AFF',
        text: '#E0E0E0',
        indicator: HSColors.primaryBlue,
        checkIcon: HSColors.white,
      },
      unselected: {
        background: '#3D3D47',
        backgroundPressed: '#4A4A54',
        borderColor: 'transparent',
        text: '#B0B0B0',
        indicator: '#5A5A62',
        checkIcon: 'transparent',
      },
    },
    orange: {
      selected: {
        background: 'rgba(242, 125, 66, 0.20)',
        backgroundPressed: 'rgba(242, 125, 66, 0.30)',
        borderColor: '#FF8F55',
        text: '#E0E0E0',
        indicator: HSColors.orange,
        checkIcon: HSColors.white,
      },
      unselected: {
        background: '#3D3D47',
        backgroundPressed: '#4A4A54',
        borderColor: 'transparent',
        text: '#B0B0B0',
        indicator: '#5A5A62',
        checkIcon: 'transparent',
      },
    },
  },
} as const;

// =============================================================================
// THEME OBJECT
// =============================================================================

export const HSTheme = {
  colors: HSColors,
  colorSchemes: HSColorSchemes,
  shapes: ButtonShapes,
  sizes: ButtonSizes,
  typography: ButtonTypography,
  animation: HSAnimation,
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
} as const;

export default HSTheme;
