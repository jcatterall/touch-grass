/**
 * Typography - Text component with design system integration
 */

import React from 'react';
import {
  Text,
  type TextProps as RNTextProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { textStyles, textColors } from '../theme/tokens';

type TextVariant = keyof typeof textStyles;
type TextColor = keyof typeof textColors.light;
type ColorMode = 'light' | 'dark';

export interface TypographyProps extends Omit<RNTextProps, 'style'> {
  children: React.ReactNode;
  /** Text style variant: heading, title, subtitle, body, link */
  variant?: TextVariant;
  /** Semantic color: primary, secondary, tertiary, disabled, inverse, link, accent, error, success */
  color?: TextColor;
  /** Theme mode */
  mode?: ColorMode;
  /** Center text */
  center?: boolean;
  /** Custom style overrides */
  style?: StyleProp<TextStyle>;
}

export const Typography: React.FC<TypographyProps> = ({
  children,
  variant = 'body',
  color = 'primary',
  mode = 'light',
  center = false,
  style,
  ...textProps
}) => {
  const composedStyle: StyleProp<TextStyle> = [
    textStyles[variant],
    { color: textColors[mode][color] },
    center && { textAlign: 'center' },
    style,
  ];

  return (
    <Text style={composedStyle} {...textProps}>
      {children}
    </Text>
  );
};

export type { TextVariant, TextColor, ColorMode };
export default Typography;
