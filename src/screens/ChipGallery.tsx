/**
 * ChipGallery - Showcase screen for Chip component
 *
 * Displays all chip variants, sizes, and states in both light and dark modes.
 * Includes horizontal ScrollView examples for category filter patterns.
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '../components/Chip';
import {
  HSColors,
  type ChipSize,
  type ChipVariant,
  type HSColorMode,
} from '../theme/theme';

// =============================================================================
// SAMPLE DATA
// =============================================================================

const CATEGORIES = [
  'All',
  'Sleep',
  'Meditation',
  'Focus',
  'Stress',
  'Anxiety',
  'Movement',
  'Music',
];

const MOODS = ['Calm', 'Energized', 'Focused', 'Relaxed', 'Happy', 'Peaceful'];

const DURATIONS = ['5 min', '10 min', '15 min', '20 min', '30 min'];

// Sample icon component
const CheckIcon: React.FC<{ color: ColorValue; size: number }> = ({
  color,
  size,
}) => (
  <View
    style={[
      styles.checkIcon,
      {
        width: size,
        height: size,
        borderColor: color,
      },
    ]}
  >
    <View
      style={[
        styles.checkMark,
        {
          borderColor: color,
        },
      ]}
    />
  </View>
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
// INTERACTIVE CHIP GROUP
// =============================================================================

interface ChipGroupProps {
  items: string[];
  variant: ChipVariant;
  size: ChipSize;
  mode: HSColorMode;
  multiSelect?: boolean;
}

const ChipGroup: React.FC<ChipGroupProps> = ({
  items,
  variant,
  size,
  mode,
  multiSelect = false,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(['All']));

  const handlePress = (item: string) => {
    setSelected(prev => {
      const newSet = new Set(prev);
      if (multiSelect) {
        if (newSet.has(item)) {
          newSet.delete(item);
        } else {
          newSet.add(item);
        }
      } else {
        newSet.clear();
        newSet.add(item);
      }
      return newSet;
    });
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipGroupContent}
    >
      {items.map(item => (
        <Chip
          key={item}
          label={item}
          isSelected={selected.has(item)}
          variant={variant}
          size={size}
          mode={mode}
          onPress={() => handlePress(item)}
        />
      ))}
    </ScrollView>
  );
};

// =============================================================================
// GALLERY SECTIONS
// =============================================================================

interface VariantShowcaseProps {
  mode: HSColorMode;
}

const VariantsShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => {
  const [selectedVariant, setSelectedVariant] = useState<ChipVariant>('blue');
  const variants: ChipVariant[] = ['blue', 'orange', 'outline'];

  return (
    <Section title="Variants" mode={mode}>
      <View style={styles.variantRow}>
        {variants.map(variant => (
          <View key={variant} style={styles.variantItem}>
            <Text
              style={[
                styles.variantLabel,
                mode === 'dark' && styles.variantLabelDark,
              ]}
            >
              {variant.charAt(0).toUpperCase() + variant.slice(1)}
            </Text>
            <View style={styles.variantChips}>
              <Chip
                label="Selected"
                isSelected={true}
                variant={variant}
                mode={mode}
                onPress={() => setSelectedVariant(variant)}
              />
              <Chip
                label="Unselected"
                isSelected={false}
                variant={variant}
                mode={mode}
                onPress={() => {}}
              />
            </View>
          </View>
        ))}
      </View>
    </Section>
  );
};

const SizesShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => {
  const sizes: ChipSize[] = ['sm', 'md'];

  return (
    <Section title="Sizes" mode={mode}>
      <View style={styles.sizesContainer}>
        {sizes.map(size => (
          <View key={size} style={styles.sizeRow}>
            <Text
              style={[
                styles.sizeLabel,
                mode === 'dark' && styles.sizeLabelDark,
              ]}
            >
              {size === 'sm' ? 'Small (32px)' : 'Medium (40px)'}
            </Text>
            <Chip
              label="Category"
              isSelected={true}
              variant="blue"
              size={size}
              mode={mode}
              onPress={() => {}}
            />
          </View>
        ))}
      </View>
    </Section>
  );
};

const StatesShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => (
  <Section title="States" mode={mode}>
    <View style={styles.statesContainer}>
      <View style={styles.stateRow}>
        <Text
          style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}
        >
          Default
        </Text>
        <Chip
          label="Active"
          isSelected={true}
          variant="blue"
          mode={mode}
          onPress={() => {}}
        />
      </View>
      <View style={styles.stateRow}>
        <Text
          style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}
        >
          Disabled
        </Text>
        <Chip
          label="Disabled"
          isSelected={false}
          variant="blue"
          mode={mode}
          disabled
          onPress={() => {}}
        />
      </View>
      <View style={styles.stateRow}>
        <Text
          style={[styles.stateLabel, mode === 'dark' && styles.stateLabelDark]}
        >
          Disabled Selected
        </Text>
        <Chip
          label="Disabled"
          isSelected={true}
          variant="blue"
          mode={mode}
          disabled
          onPress={() => {}}
        />
      </View>
    </View>
  </Section>
);

const IconShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => {
  const iconColor = mode === 'dark' ? '#FFFFFF' : '#FFFFFF';
  const unselectedIconColor = mode === 'dark' ? '#E0E0E0' : HSColors.charcoal;

  return (
    <Section title="With Icons" mode={mode}>
      <View style={styles.iconChipsContainer}>
        <Chip
          label="Selected"
          isSelected={true}
          variant="blue"
          mode={mode}
          leftIcon={<CheckIcon color={iconColor} size={12} />}
          onPress={() => {}}
        />
        <Chip
          label="Unselected"
          isSelected={false}
          variant="blue"
          mode={mode}
          leftIcon={<CheckIcon color={unselectedIconColor} size={12} />}
          onPress={() => {}}
        />
        <Chip
          label="Orange"
          isSelected={true}
          variant="orange"
          mode={mode}
          leftIcon={<CheckIcon color={iconColor} size={12} />}
          onPress={() => {}}
        />
      </View>
    </Section>
  );
};

const HorizontalScrollShowcase: React.FC<VariantShowcaseProps> = ({ mode }) => (
  <Section title="Horizontal Scroll (Category Filters)" mode={mode}>
    <View style={styles.scrollShowcaseContainer}>
      <Text
        style={[styles.scrollLabel, mode === 'dark' && styles.scrollLabelDark]}
      >
        Blue Variant - Single Select
      </Text>
      <ChipGroup
        items={CATEGORIES}
        variant="blue"
        size="sm"
        mode={mode}
        multiSelect={false}
      />

      <Text
        style={[
          styles.scrollLabel,
          mode === 'dark' && styles.scrollLabelDark,
          { marginTop: 16 },
        ]}
      >
        Orange Variant - Single Select
      </Text>
      <ChipGroup
        items={MOODS}
        variant="orange"
        size="sm"
        mode={mode}
        multiSelect={false}
      />

      <Text
        style={[
          styles.scrollLabel,
          mode === 'dark' && styles.scrollLabelDark,
          { marginTop: 16 },
        ]}
      >
        Outline Variant - Multi Select
      </Text>
      <ChipGroup
        items={DURATIONS}
        variant="outline"
        size="md"
        mode={mode}
        multiSelect={true}
      />
    </View>
  </Section>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ChipGallery: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Chip Gallery</Text>
        <Text style={styles.pageSubtitle}>
          Headspace Design System Chip Component
        </Text>

        {/* Light Mode Section */}
        <ModeContainer mode="light">
          <VariantsShowcase mode="light" />
          <SizesShowcase mode="light" />
          <StatesShowcase mode="light" />
          <IconShowcase mode="light" />
          <HorizontalScrollShowcase mode="light" />
        </ModeContainer>

        {/* Dark Mode Section */}
        <ModeContainer mode="dark">
          <VariantsShowcase mode="dark" />
          <SizesShowcase mode="dark" />
          <StatesShowcase mode="dark" />
          <IconShowcase mode="dark" />
          <HorizontalScrollShowcase mode="dark" />
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

  // Variants
  variantRow: {
    gap: 20,
  },
  variantItem: {
    marginBottom: 12,
  },
  variantLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  variantLabelDark: {
    color: '#B0B0B0',
  },
  variantChips: {
    flexDirection: 'row',
    gap: 8,
  },

  // Sizes
  sizesContainer: {
    gap: 12,
  },
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

  // States
  statesContainer: {
    gap: 12,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stateLabel: {
    width: 120,
    fontSize: 12,
    color: '#666666',
  },
  stateLabelDark: {
    color: '#B0B0B0',
  },

  // Icons
  iconChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    width: 6,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginBottom: 2,
  },

  // Horizontal Scroll
  scrollShowcaseContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 0,
  },
  scrollLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  scrollLabelDark: {
    color: '#B0B0B0',
  },
  chipGroupContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
});

export default ChipGallery;
