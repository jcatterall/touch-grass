/**
 * ButtonGallery - Showcase screen for Button component
 *
 * Displays all button variants, sizes, and states in both light and dark modes
 * for visual verification and design parity testing.
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import {
  HSColors,
  type ButtonSize,
  type ButtonVariant,
  type HSColorMode,
} from '../theme/theme';

// =============================================================================
// CONSTANTS
// =============================================================================

const VARIANTS: ButtonVariant[] = [
  'primary',
  'secondary',
  'tertiary',
  'danger',
];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg', 'xl'];
const SIZE_LABELS: Record<ButtonSize, string> = {
  sm: 'Small (32px)',
  md: 'Medium (40px)',
  lg: 'Large (48px)',
  xl: 'Extra Large (56px)',
};

// Sample icon component for demonstration
const SampleIcon: React.FC<{ color: ColorValue; size: number }> = ({
  color,
  size,
}) => (
  <View
    style={[
      styles.sampleIcon,
      {
        width: size,
        height: size,
        borderColor: color,
      },
    ]}
  />
);

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

interface SectionProps {
  title: string;
  mode: HSColorMode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, mode, children }) => (
  <View style={styles.section}>
    <Text
      style={[styles.sectionTitle, mode === 'dark' && styles.sectionTitleDark]}
    >
      {title}
    </Text>
    {children}
  </View>
);

interface ModeContainerProps {
  mode: HSColorMode;
  children: React.ReactNode;
}

const ModeContainer: React.FC<ModeContainerProps> = ({ mode, children }) => (
  <View
    style={[
      styles.modeContainer,
      mode === 'dark' ? styles.darkModeContainer : styles.lightModeContainer,
    ]}
  >
    <Text style={[styles.modeTitle, mode === 'dark' && styles.modeTitleDark]}>
      {mode === 'light' ? 'Light Mode' : 'Dark Mode'}
    </Text>
    {children}
  </View>
);

// =============================================================================
// GALLERY SECTIONS
// =============================================================================

interface VariantShowcaseProps {
  mode: HSColorMode;
}

const VariantShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => (
  <Section title="Variants" mode={mode}>
    <View style={styles.buttonRow}>
      {VARIANTS.map(variant => (
        <Button
          key={variant}
          variant={variant}
          mode={mode}
          size="md"
          onPress={() => console.log(`${variant} pressed`)}
        >
          {variant.charAt(0).toUpperCase() + variant.slice(1)}
        </Button>
      ))}
    </View>
  </Section>
);

const SizeShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => (
  <Section title="Sizes" mode={mode}>
    <View style={styles.buttonColumn}>
      {SIZES.map(size => (
        <View key={size} style={styles.sizeRow}>
          <Text
            style={[styles.sizeLabel, mode === 'dark' && styles.sizeLabelDark]}
          >
            {SIZE_LABELS[size]}
          </Text>
          <Button
            variant="primary"
            mode={mode}
            size={size}
            onPress={() => console.log(`${size} pressed`)}
          >
            Button
          </Button>
        </View>
      ))}
    </View>
  </Section>
);

const ShapeShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => (
  <Section title="Shapes" mode={mode}>
    <View style={styles.buttonRow}>
      <View style={styles.shapeItem}>
        <Text
          style={[styles.shapeLabel, mode === 'dark' && styles.shapeLabelDark]}
        >
          Pill (999px)
        </Text>
        <Button
          variant="primary"
          mode={mode}
          shape="pill"
          size="lg"
          onPress={() => console.log('pill pressed')}
        >
          Pill Shape
        </Button>
      </View>
      <View style={styles.shapeItem}>
        <Text
          style={[styles.shapeLabel, mode === 'dark' && styles.shapeLabelDark]}
        >
          Rounded (12px)
        </Text>
        <Button
          variant="primary"
          mode={mode}
          shape="rounded"
          size="lg"
          onPress={() => console.log('rounded pressed')}
        >
          Rounded
        </Button>
      </View>
    </View>
  </Section>
);

const StateShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => (
  <Section title="States" mode={mode}>
    <View style={styles.buttonColumn}>
      <View style={styles.stateRow}>
        <Text
          style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}
        >
          Default
        </Text>
        <Button
          variant="primary"
          mode={mode}
          onPress={() => console.log('default pressed')}
        >
          Default
        </Button>
      </View>
      <View style={styles.stateRow}>
        <Text
          style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}
        >
          Disabled
        </Text>
        <Button
          variant="primary"
          mode={mode}
          disabled
          onPress={() => console.log('disabled pressed')}
        >
          Disabled
        </Button>
      </View>
      <View style={styles.stateRow}>
        <Text
          style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}
        >
          Loading
        </Text>
        <Button
          variant="primary"
          mode={mode}
          isLoading
          onPress={() => console.log('loading pressed')}
        >
          Loading
        </Button>
      </View>
    </View>
  </Section>
);

const IconShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => {
  const iconColor = mode === 'dark' ? '#FFFFFF' : '#FFFFFF';
  const secondaryIconColor = mode === 'dark' ? '#8B9AFF' : HSColors.primaryBlue;
  const tertiaryIconColor = mode === 'dark' ? '#8B9AFF' : HSColors.primaryBlue;

  return (
    <Section title="With Icons" mode={mode}>
      <View style={styles.buttonColumn}>
        <Button
          variant="primary"
          mode={mode}
          size="lg"
          iconLeft={<SampleIcon color={iconColor} size={18} />}
          onPress={() => console.log('icon primary pressed')}
        >
          Primary + Icon
        </Button>
        <Button
          variant="secondary"
          mode={mode}
          size="lg"
          iconLeft={<SampleIcon color={secondaryIconColor} size={18} />}
          onPress={() => console.log('icon secondary pressed')}
        >
          Secondary + Icon
        </Button>
        <Button
          variant="tertiary"
          mode={mode}
          size="lg"
          iconLeft={<SampleIcon color={tertiaryIconColor} size={18} />}
          onPress={() => console.log('icon tertiary pressed')}
        >
          Tertiary + Icon
        </Button>
      </View>
    </Section>
  );
};

const AllVariantsMatrix: React.FC<VariantShowcaseProps> = ({ mode }) => (
  <Section title="Full Matrix (All Variants x Sizes)" mode={mode}>
    <View style={styles.matrixContainer}>
      {VARIANTS.map(variant => (
        <View key={variant} style={styles.matrixRow}>
          <Text
            style={[
              styles.matrixLabel,
              mode === 'dark' && styles.matrixLabelDark,
            ]}
          >
            {variant.charAt(0).toUpperCase() + variant.slice(1)}
          </Text>
          <View style={styles.matrixButtons}>
            {SIZES.map(size => (
              <Button
                key={`${variant}-${size}`}
                variant={variant}
                mode={mode}
                size={size}
                onPress={() => console.log(`${variant} ${size} pressed`)}
              >
                {size.toUpperCase()}
              </Button>
            ))}
          </View>
        </View>
      ))}
    </View>
  </Section>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ButtonGallery: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Button Gallery</Text>
        <Text style={styles.pageSubtitle}>
          Headspace Design System Button Component
        </Text>

        {/* Light Mode Section */}
        <ModeContainer mode="light">
          <VariantShowcase mode="light" />
          <SizeShowcase mode="light" />
          <ShapeShowcase mode="light" />
          <StateShowcase mode="light" />
          <IconShowcase mode="light" />
          <AllVariantsMatrix mode="light" />
        </ModeContainer>

        {/* Dark Mode Section */}
        <ModeContainer mode="dark">
          <VariantShowcase mode="dark" />
          <SizeShowcase mode="dark" />
          <ShapeShowcase mode="dark" />
          <StateShowcase mode="dark" />
          <IconShowcase mode="dark" />
          <AllVariantsMatrix mode="dark" />
        </ModeContainer>
      </ScrollView>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: HSColors.charcoal,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 24,
  },

  // Mode Container
  modeContainer: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  lightModeContainer: {
    backgroundColor: '#FFFFFF',
  },
  darkModeContainer: {
    backgroundColor: HSColors.charcoal,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: HSColors.charcoal,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modeTitleDark: {
    color: '#FFFFFF',
    borderBottomColor: '#3D3D47',
  },

  // Section
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: HSColors.charcoal,
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },

  // Button Layouts
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  buttonColumn: {
    gap: 12,
  },

  // Size Showcase
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sizeLabel: {
    width: 120,
    fontSize: 12,
    color: '#666666',
  },
  sizeLabelDark: {
    color: '#B0B0B0',
  },

  // Shape Showcase
  shapeItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  shapeLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  shapeLabelDark: {
    color: '#B0B0B0',
  },

  // State Showcase
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stateLabel: {
    width: 80,
    fontSize: 12,
    color: '#666666',
  },
  stateLabelDark: {
    color: '#B0B0B0',
  },

  // Matrix
  matrixContainer: {
    gap: 16,
  },
  matrixRow: {
    gap: 8,
  },
  matrixLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  matrixLabelDark: {
    color: '#B0B0B0',
  },
  matrixButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Sample Icon (placeholder for demonstration)
  sampleIcon: {
    borderRadius: 4,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
});

export default ButtonGallery;
