/**
 * Design Tokens extracted from Headspace App
 * For React Native Application
 */

export const colors = {
  // Primary Brand Colors
  primary: {
    orange: '#F47D31', // Primary orange (checkmarks, selected cards)
    orangeLight: '#FF9F4A', // Lighter orange gradient
    blue: '#3478F6', // CTA buttons
    blueDark: '#2E6BD6', // Blue pressed state (estimated)
  },

  // Gradient Colors (Sun illustration)
  gradient: {
    yellow: '#FFE566', // Top of sun rays
    yellowMid: '#FFD54F', // Mid sun
    orangeLight: '#FFAB40', // Lower sun
    orangeDark: '#F47D31', // Base orange
    skyBlue: '#87CEEB', // Sky background
    skyBlueLight: '#B0E0E6', // Lighter sky
  },

  // Neutral Colors
  neutral: {
    white: '#FFFFFF',
    background: '#FAFAFA', // Slight off-white background
    cardBackground: '#F5F3EF', // Beige/cream card background
    gray100: '#F5F5F5', // Light gray backgrounds
    gray200: '#E8E8E8', // Borders, dividers
    gray300: '#D1D1D1', // Toggle off state
    gray400: '#9E9E9E', // Secondary text
    gray600: '#666666', // Body text
    gray800: '#333333', // Primary text
    black: '#1A1A1A', // Headings
  },

  // Dark Theme Colors
  dark: {
    background: '#0F1535', // Dark navy background
    surface: '#1A1F3D', // Slightly lighter surface
    cardBackground: '#252A4A', // Card/list item background
    cardBackgroundHover: '#2D3250', // Hover state
    border: '#3D4470', // Subtle borders
    textPrimary: '#FFFFFF', // White headings
    textSecondary: '#B8BDD4', // Muted text
    textTertiary: '#6B7194', // Very muted text
  },

  // Accent Colors (from illustrations)
  accent: {
    purple: '#9B59B6', // Illustration element
    pink: '#FFB6C1', // Cloud pink
    pinkLight: '#FFC0CB', // Light pink clouds
    teal: '#4ECDC4', // Illustration ring
    mint: '#7ED9A6', // Illustration element
    yellow: '#FFD93D', // Star illustration
    peach: '#FFAB91', // Peach illustration element
  },

  // Semantic Colors
  semantic: {
    success: '#F47D31', // Orange checkmarks
    link: '#F47D31', // Orange link text
    disabled: '#D1D1D1',
    disabledDark: '#4A4F6A', // Disabled state in dark mode
  },

  // Text Colors
  text: {
    primary: '#1A1A1A', // Main headings
    secondary: '#666666', // Body text, descriptions
    tertiary: '#9E9E9E', // Subtle text
    inverse: '#FFFFFF', // Text on dark/colored backgrounds
    link: '#F47D31', // Link text (orange)
    linkBlue: '#3478F6', // Alternative link color
  },
};

export const spacing = {
  // Base unit: 4px
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

  // Specific use cases
  screenPadding: 24, // Horizontal screen padding
  cardPadding: 16, // Internal card padding
  sectionGap: 24, // Gap between sections
  listItemGap: 16, // Gap between list items
  buttonMargin: 16, // Margin around buttons
  iconTextGap: 12, // Gap between icon and text
};

export const typography = {
  // Primary font family (site design)
  fontFamily: 'Apercu',

  // Font weight tokens (kept for compatibility)
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '900' as const,
  },

  // Responsive typography scales provided by design
  scales: {
    large_screens: {
      display: {
        display_1: { fontSize: 92, fontWeight: '700' },
        display_2: { fontSize: 64, fontWeight: '700' },
        display_3: { fontSize: 40, fontWeight: '700' },
      },
      title: {
        title_1: { fontSize: 28, fontWeight: '400' },
        title_2: { fontSize: 24, fontWeight: '700' },
        title_3: { fontSize: 18, fontWeight: '700' },
      },
      body: {
        paragraph_1: { fontSize: 18, fontWeight: '400' },
        paragraph_2: { fontSize: 16, fontWeight: '400' },
        paragraph_3: { fontSize: 14, fontWeight: '400' },
      },
      labels: {
        label_1: { fontSize: 12, fontWeight: '400' },
        label_2: { fontSize: 10, fontWeight: '400' },
      },
    },

    small_screens: {
      display: {
        display_1: { fontSize: 56, fontWeight: '700' },
        display_2: { fontSize: 36, fontWeight: '700' },
        display_3: { fontSize: 32, fontWeight: '700' },
      },
      title: {
        title_1: { fontSize: 28, fontWeight: '700' },
        title_2: { fontSize: 24, fontWeight: '700' },
        title_3: { fontSize: 20, fontWeight: '700' },
      },
      body: {
        paragraph_1: { fontSize: 18, fontWeight: '400' },
        paragraph_2: { fontSize: 16, fontWeight: '400' },
        paragraph_3: { fontSize: 14, fontWeight: '400' },
        headline: { fontSize: 16, fontWeight: '700' },
        headline_caps: {
          fontSize: 14,
          fontWeight: '700',
          textTransform: 'uppercase' as const,
        },
        input_field: { fontSize: 16, fontWeight: '400' },
      },
      labels: {
        label_1: { fontSize: 14, fontWeight: '700' },
        label_2: { fontSize: 12, fontWeight: '700' },
        label_3: { fontSize: 10, fontWeight: '700' },
        label_4: { fontSize: 10, fontWeight: '400' },
      },
    },
  },

  // Legacy pre-defined text styles kept for backward compatibility with existing components
  styles: {
    light: {
      largeTitle: {
        fontSize: 48,
        fontWeight: '700' as const,
        lineHeight: 54,
        color: colors.text.primary,
      },
      title: {
        fontSize: 36,
        fontWeight: '700' as const,
        lineHeight: 42,
        color: colors.text.primary,
      },
      largeHeading: {
        fontSize: 28,
        fontWeight: '700' as const,
        lineHeight: 36,
        color: colors.text.primary,
      },
      heading: {
        fontSize: 22,
        fontWeight: '700' as const,
        lineHeight: 28,
        color: colors.text.primary,
      },
      subheading: {
        fontSize: 18,
        fontWeight: '400' as const,
        lineHeight: 24,
        color: colors.text.primary,
      },
      body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
        color: colors.text.secondary,
      },
      caption: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
        color: colors.text.tertiary,
      },
      small: {
        fontSize: 12,
        fontWeight: '400' as const,
        lineHeight: 20,
        color: colors.text.tertiary,
      },
      price: {
        fontSize: 18,
        fontWeight: '600' as const,
        lineHeight: 24,
        color: colors.text.inverse,
      },
      button: {
        fontSize: 17,
        fontWeight: '600' as const,
        lineHeight: 22,
      },
      link: {
        fontSize: 14,
        fontWeight: '500' as const,
        lineHeight: 20,
        color: colors.text.secondary,
      },
    },
    dark: {
      largeTitle: {
        fontSize: 48,
        fontWeight: '700' as const,
        lineHeight: 54,
        color: colors.dark.textPrimary,
      },
      title: {
        fontSize: 36,
        fontWeight: '700' as const,
        lineHeight: 42,
        color: colors.dark.textPrimary,
      },
      largeHeading: {
        fontSize: 28,
        fontWeight: '700' as const,
        lineHeight: 36,
        color: colors.dark.textPrimary,
      },
      heading: {
        fontSize: 22,
        fontWeight: '700' as const,
        lineHeight: 28,
        color: colors.dark.textPrimary,
      },
      subheading: {
        fontSize: 18,
        fontWeight: '400' as const,
        lineHeight: 24,
        color: colors.dark.textPrimary,
      },
      body: {
        fontSize: 16,
        fontWeight: '400' as const,
        lineHeight: 24,
        color: colors.dark.textSecondary,
      },
      caption: {
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
        color: colors.dark.textTertiary,
      },
      small: {
        fontSize: 12,
        fontWeight: '400' as const,
        lineHeight: 20,
        color: colors.dark.textPrimary,
      },
      price: {
        fontSize: 18,
        fontWeight: '600' as const,
        lineHeight: 24,
        color: colors.dark.textPrimary,
      },
      button: {
        fontSize: 17,
        fontWeight: '600' as const,
        lineHeight: 22,
      },
      link: {
        fontSize: 14,
        fontWeight: '500' as const,
        lineHeight: 20,
        color: colors.text.secondary,
      },
    },
  },
};

export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 9999, // Fully rounded (buttons)

  // Specific components
  button: 28, // Primary buttons are very rounded
  card: 12, // Card corners
  toggle: 16, // Toggle switch
  badge: 8, // Small badges like "Best value"
};

export const shadows = {
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
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const buttons = {
  primary: {
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  secondary: {
    backgroundColor: colors.neutral.cardBackground,
    borderRadius: borderRadius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  selected: {
    backgroundColor: colors.primary.orange,
    borderRadius: borderRadius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  unselected: {
    backgroundColor: colors.neutral.cardBackground,
    borderRadius: borderRadius.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
};

export const components = {
  // Toggle/Switch
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    thumbSize: 27,
    activeColor: colors.primary.orange,
    inactiveColor: colors.neutral.gray200,
    thumbColor: colors.neutral.white,
  },

  // Checkmark icon
  checkmark: {
    size: 20,
    color: colors.primary.orange,
  },

  // Badge (e.g., "Best value")
  badge: {
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.badge,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.neutral.white,
  },

  // Cards
  card: {
    borderRadius: borderRadius.card,
    padding: spacing.md,
    backgroundColor: colors.neutral.cardBackground,
  },

  // Screen
  screen: {
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.screenPadding,
  },

  // Close button
  closeButton: {
    size: 32,
    iconSize: 16,
    color: colors.neutral.gray600,
  },
};

export const animation = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    default: 'ease-in-out',
    enter: 'ease-out',
    exit: 'ease-in',
  },
};

// Theme object combining all tokens
const theme = {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  buttons,
  components,
  animation,
};

export default theme;
