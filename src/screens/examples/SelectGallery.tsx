/**
 * SelectGallery - Showcase screen for Select component
 *
 * Displays the Select component with single-select (radio) and multi-select
 * (checkbox) modes in both light and dark themes, following Headspace aesthetics.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Select, SelectionRow } from '../../components';
import { Colors, type ColorMode, type SelectVariant } from '../../theme/theme';

// =============================================================================
// SAMPLE DATA
// =============================================================================

const FOCUS_OPTIONS = [
  { label: 'Reduce stress', value: 'stress' },
  { label: 'Improve sleep', value: 'sleep' },
  { label: 'Build focus', value: 'focus' },
  { label: 'Increase happiness', value: 'happiness' },
  { label: 'Reduce anxiety', value: 'anxiety' },
];

const INTEREST_OPTIONS = [
  { label: 'Meditation', value: 'meditation' },
  { label: 'Sleep stories', value: 'sleep_stories' },
  { label: 'Breathing exercises', value: 'breathing' },
  { label: 'Focus music', value: 'focus_music' },
  { label: 'Movement', value: 'movement' },
  { label: 'Stress relief', value: 'stress_relief' },
];

const DURATION_OPTIONS = [
  { label: '3 minutes', value: 3 },
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: '20 minutes', value: 20 },
];

const EXPERIENCE_OPTIONS = [
  { label: "I'm new to meditation", value: 'beginner' },
  { label: "I've tried it a few times", value: 'intermediate' },
  { label: 'I meditate regularly', value: 'advanced' },
  { label: "I'm a meditation teacher", value: 'expert', disabled: true },
];

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

interface SectionProps {
  title: string;
  subtitle?: string;
  mode: ColorMode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({
  title,
  subtitle,
  mode,
  children,
}) => (
  <View style={styles.section}>
    <Text
      style={[styles.sectionTitle, mode === 'dark' && styles.sectionTitleDark]}
    >
      {title}
    </Text>
    {subtitle && (
      <Text
        style={[
          styles.sectionSubtitle,
          mode === 'dark' && styles.sectionSubtitleDark,
        ]}
      >
        {subtitle}
      </Text>
    )}
    {children}
  </View>
);

interface ModeContainerProps {
  mode: ColorMode;
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

interface ShowcaseProps {
  mode: ColorMode;
}

const SingleSelectShowcase: React.FC<ShowcaseProps> = ({ mode }) => {
  const [selectedFocus, setSelectedFocus] = useState<string | number>('stress');

  return (
    <Section
      title="Choose your focus"
      subtitle="Single selection (Radio style)"
      mode={mode}
    >
      <Select
        options={FOCUS_OPTIONS}
        value={selectedFocus}
        onValueChange={setSelectedFocus}
        variant="blue"
        mode={mode}
        accessibilityLabel="Choose your focus area"
        testID="focus-select"
      />
    </Section>
  );
};

const MultiSelectShowcase: React.FC<ShowcaseProps> = ({ mode }) => {
  const [selectedInterests, setSelectedInterests] = useState<
    (string | number)[]
  >(['meditation', 'breathing']);

  return (
    <Section
      title="Select your interests"
      subtitle="Multiple selection (Checkbox style)"
      mode={mode}
    >
      <Select
        options={INTEREST_OPTIONS}
        value={selectedInterests}
        onValueChange={val => setSelectedInterests(val as (string | number)[])}
        multiSelect
        variant="orange"
        mode={mode}
        accessibilityLabel="Select your interests"
        testID="interests-select"
      />
    </Section>
  );
};

const VariantsShowcase: React.FC<ShowcaseProps> = ({ mode }) => {
  const [blueValue, setBlueValue] = useState<string | number>(5);
  const [orangeValue, setOrangeValue] = useState<string | number>(10);

  return (
    <Section
      title="Color Variants"
      subtitle="Blue and Orange themes"
      mode={mode}
    >
      <View style={styles.variantsContainer}>
        <View style={styles.variantColumn}>
          <Text
            style={[
              styles.variantLabel,
              mode === 'dark' && styles.variantLabelDark,
            ]}
          >
            Blue Variant
          </Text>
          <Select
            options={DURATION_OPTIONS.slice(0, 3)}
            value={blueValue}
            onValueChange={setBlueValue}
            variant="blue"
            mode={mode}
            itemGap={8}
          />
        </View>
        <View style={styles.variantColumn}>
          <Text
            style={[
              styles.variantLabel,
              mode === 'dark' && styles.variantLabelDark,
            ]}
          >
            Orange Variant
          </Text>
          <Select
            options={DURATION_OPTIONS.slice(0, 3)}
            value={orangeValue}
            onValueChange={setOrangeValue}
            variant="orange"
            mode={mode}
            itemGap={8}
          />
        </View>
      </View>
    </Section>
  );
};

const DisabledStatesShowcase: React.FC<ShowcaseProps> = ({ mode }) => {
  const [selectedExperience, setSelectedExperience] = useState<string | number>(
    'beginner',
  );

  return (
    <Section
      title="Experience level"
      subtitle="With disabled option"
      mode={mode}
    >
      <Select
        options={EXPERIENCE_OPTIONS}
        value={selectedExperience}
        onValueChange={setSelectedExperience}
        variant="blue"
        mode={mode}
        accessibilityLabel="Select your experience level"
      />
    </Section>
  );
};

const SelectionRowAtomShowcase: React.FC<ShowcaseProps> = ({ mode }) => {
  const [selected, setSelected] = useState<string>('option1');

  return (
    <Section
      title="SelectionRow Atom"
      subtitle="Individual row components"
      mode={mode}
    >
      <View style={styles.atomContainer}>
        <SelectionRow
          label="Radio - Selected"
          value="option1"
          isSelected={selected === 'option1'}
          multiSelect={false}
          variant="blue"
          mode={mode}
          onPress={() => setSelected('option1')}
        />
        <View style={{ height: 12 }} />
        <SelectionRow
          label="Radio - Unselected"
          value="option2"
          isSelected={selected === 'option2'}
          multiSelect={false}
          variant="blue"
          mode={mode}
          onPress={() => setSelected('option2')}
        />
        <View style={{ height: 12 }} />
        <SelectionRow
          label="Checkbox - Selected"
          value="check1"
          isSelected={true}
          multiSelect={true}
          variant="orange"
          mode={mode}
          onPress={() => {}}
        />
        <View style={{ height: 12 }} />
        <SelectionRow
          label="Checkbox - Unselected"
          value="check2"
          isSelected={false}
          multiSelect={true}
          variant="orange"
          mode={mode}
          onPress={() => {}}
        />
        <View style={{ height: 12 }} />
        <SelectionRow
          label="Disabled Row"
          value="disabled"
          isSelected={false}
          multiSelect={false}
          variant="blue"
          mode={mode}
          disabled
          onPress={() => {}}
        />
      </View>
    </Section>
  );
};

const CustomRenderShowcase: React.FC<ShowcaseProps> = ({ mode }) => {
  const [selected, setSelected] = useState<string | number>('meditation');

  const customOptions = [
    { label: 'Morning meditation', value: 'meditation', emoji: '🌅' },
    { label: 'Deep sleep', value: 'sleep', emoji: '🌙' },
    { label: 'Quick breather', value: 'breather', emoji: '💨' },
  ];

  return (
    <Section
      title="Custom Render Item"
      subtitle="With custom layout using renderItem prop"
      mode={mode}
    >
      <Select
        options={customOptions}
        value={selected}
        onValueChange={setSelected}
        variant="blue"
        mode={mode}
        renderItem={({ option, isSelected, onPress, defaultRowProps }) => {
          const customOption = option as (typeof customOptions)[0];
          return (
            <SelectionRow
              {...defaultRowProps}
              label={`${customOption.emoji}  ${customOption.label}`}
              onPress={onPress}
            />
          );
        }}
      />
    </Section>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const SelectGallery: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Select Gallery</Text>
        <Text style={styles.pageSubtitle}>
          Headspace Design System Selection List Component
        </Text>

        {/* Light Mode Section */}
        <ModeContainer mode="light">
          <SingleSelectShowcase mode="light" />
          <MultiSelectShowcase mode="light" />
          <VariantsShowcase mode="light" />
          <DisabledStatesShowcase mode="light" />
          <SelectionRowAtomShowcase mode="light" />
          <CustomRenderShowcase mode="light" />
        </ModeContainer>

        {/* Dark Mode Section */}
        <ModeContainer mode="dark">
          <SingleSelectShowcase mode="dark" />
          <MultiSelectShowcase mode="dark" />
          <VariantsShowcase mode="dark" />
          <DisabledStatesShowcase mode="dark" />
          <SelectionRowAtomShowcase mode="dark" />
          <CustomRenderShowcase mode="dark" />
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
    color: Colors.charcoal,
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
    backgroundColor: Colors.charcoal,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.charcoal,
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
    fontSize: 18,
    fontWeight: '600',
    color: Colors.charcoal,
    marginBottom: 4,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 16,
  },
  sectionSubtitleDark: {
    color: '#B0B0B0',
  },

  // Variants
  variantsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  variantColumn: {
    flex: 1,
  },
  variantLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  variantLabelDark: {
    color: '#B0B0B0',
  },

  // Atom showcase
  atomContainer: {
    // Container for individual SelectionRow atoms
  },
});

export default SelectGallery;
