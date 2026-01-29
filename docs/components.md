# TouchGrass Component Library

A collection of reusable React Native components based on Headspace design patterns.

## Installation

All components are available from the components directory:

```tsx
import {
  Button,
  PillButton,
  SelectableListItem,
  FeatureCard,
  PageIndicator,
} from '../components';
```

## Design Tokens

Components use design tokens from `src/theme/tokens.ts`. Import tokens directly for custom styling:

```tsx
import { colors, spacing, typography, borderRadius, shadows } from '../theme/tokens';
```

---

## Components

### Button

Primary action button used for CTAs like "Continue", "Get Started", etc.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Button text |
| `variant` | `'primary' \| 'secondary' \| 'outline'` | `'primary'` | Button style variant |
| `size` | `'small' \| 'medium' \| 'large'` | `'large'` | Button size |
| `fullWidth` | `boolean` | `true` | Whether button takes full width |
| `disabled` | `boolean` | `false` | Disabled state |
| `style` | `ViewStyle` | - | Additional container styles |
| `textStyle` | `TextStyle` | - | Additional text styles |

#### Usage

```tsx
import { Button } from '../components';

// Primary button (default)
<Button title="Continue" onPress={handleContinue} />

// Secondary button
<Button title="Skip" variant="secondary" onPress={handleSkip} />

// Outline button
<Button title="Learn More" variant="outline" onPress={handleLearnMore} />

// Small button
<Button title="Done" size="small" fullWidth={false} onPress={handleDone} />

// Disabled button
<Button title="Continue" disabled onPress={handleContinue} />
```

---

### PillButton

Selectable pill-shaped option button for surveys and selection screens.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Button text |
| `selected` | `boolean` | `false` | Whether the option is selected |
| `darkMode` | `boolean` | `false` | Use dark theme styling |
| `style` | `ViewStyle` | - | Additional container styles |
| `textStyle` | `TextStyle` | - | Additional text styles |

#### Usage

```tsx
import { PillButton } from '../components';

const [selected, setSelected] = useState<string | null>(null);

const options = [
  'Managing anxiety & stress',
  'Sleeping soundly',
  'Being more active',
  'Trying something new',
];

{options.map((option) => (
  <PillButton
    key={option}
    title={option}
    selected={selected === option}
    onPress={() => setSelected(option)}
  />
))}

// Dark mode variant
<PillButton
  title="Sleep soundly"
  selected={true}
  darkMode={true}
  onPress={handleSelect}
/>
```

---

### SelectableListItem

List item with checkbox for multi-select screens like goal selection.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Item text |
| `selected` | `boolean` | `false` | Whether the item is selected |
| `darkMode` | `boolean` | `true` | Use dark theme styling |
| `multiSelect` | `boolean` | `true` | Allow multiple selections |
| `style` | `ViewStyle` | - | Additional container styles |
| `textStyle` | `TextStyle` | - | Additional text styles |

#### Usage

```tsx
import { SelectableListItem } from '../components';

const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

const goals = [
  'Sleep soundly',
  'Feel calm and relaxed',
  'Reduce stress',
  'Be present and mindful',
  'Manage anxiety',
];

const toggleGoal = (goal: string) => {
  setSelectedGoals((prev) =>
    prev.includes(goal)
      ? prev.filter((g) => g !== goal)
      : [...prev, goal]
  );
};

{goals.map((goal) => (
  <SelectableListItem
    key={goal}
    title={goal}
    selected={selectedGoals.includes(goal)}
    onPress={() => toggleGoal(goal)}
  />
))}

// Light mode variant
<SelectableListItem
  title="Option"
  selected={false}
  darkMode={false}
  onPress={handleSelect}
/>
```

---

### FeatureCard

Card component for displaying features with optional illustrations.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | required | Card title/description |
| `titleHighlight` | `string` | - | Bold text prefix for title |
| `description` | `string` | - | Additional description text |
| `image` | `ImageSourcePropType` | - | Image source |
| `imageComponent` | `ReactNode` | - | Custom image/icon component |
| `darkMode` | `boolean` | `true` | Use dark theme styling |
| `style` | `ViewStyle` | - | Additional container styles |
| `titleStyle` | `TextStyle` | - | Additional title styles |

#### Usage

```tsx
import { FeatureCard } from '../components';

// Basic card
<FeatureCard
  title="with a meditation or course."
  titleHighlight="Learn the basics "
  onPress={handlePress}
/>

// Card with image
<FeatureCard
  title="with relaxing music and sleepcasts."
  titleHighlight="Sleep soundly "
  image={require('../assets/sleep-icon.png')}
  onPress={handlePress}
/>

// Card with custom icon component
<FeatureCard
  title="your empathetic AI companion."
  titleHighlight="Reflect with Ebb, "
  imageComponent={<CustomIcon />}
  onPress={handlePress}
/>

// Light mode
<FeatureCard
  title="Explore meditation"
  darkMode={false}
  onPress={handlePress}
/>
```

---

### PageIndicator

Dot pagination indicator for carousels and onboarding screens.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `totalPages` | `number` | required | Total number of pages |
| `currentPage` | `number` | required | Current active page (0-indexed) |
| `darkMode` | `boolean` | `false` | Use dark theme styling |
| `dotSize` | `number` | `8` | Size of each dot |
| `dotSpacing` | `number` | `8` | Spacing between dots |
| `style` | `ViewStyle` | - | Additional container styles |

#### Usage

```tsx
import { PageIndicator } from '../components';

const [currentPage, setCurrentPage] = useState(0);

// Basic usage
<PageIndicator totalPages={3} currentPage={currentPage} />

// Dark mode
<PageIndicator totalPages={5} currentPage={2} darkMode />

// Custom size
<PageIndicator
  totalPages={4}
  currentPage={0}
  dotSize={10}
  dotSpacing={12}
/>
```

---

## Design Tokens Reference

### Colors

```tsx
import { colors } from '../theme/tokens';

// Primary brand colors
colors.primary.orange    // #F47D31 - Primary orange
colors.primary.blue      // #3478F6 - CTA buttons

// Dark theme
colors.dark.background   // #0F1535 - Dark background
colors.dark.cardBackground // #252A4A - Card background
colors.dark.textPrimary  // #FFFFFF - White text

// Neutral colors
colors.neutral.white     // #FFFFFF
colors.neutral.cardBackground // #F5F3EF - Light card background
colors.neutral.gray600   // #666666 - Body text

// Text colors
colors.text.primary      // #1A1A1A - Headings
colors.text.secondary    // #666666 - Body text
colors.text.inverse      // #FFFFFF - Text on dark backgrounds
```

### Spacing

```tsx
import { spacing } from '../theme/tokens';

spacing.xs   // 8
spacing.sm   // 12
spacing.md   // 16
spacing.lg   // 20
spacing.xl   // 24
spacing.xxl  // 32

spacing.screenPadding  // 24 - Horizontal screen padding
spacing.cardPadding    // 16 - Internal card padding
spacing.sectionGap     // 24 - Gap between sections
spacing.listItemGap    // 16 - Gap between list items
```

### Typography

```tsx
import { typography } from '../theme/tokens';

// Font sizes
typography.fontSize.sm   // 14
typography.fontSize.md   // 16
typography.fontSize.lg   // 18
typography.fontSize.xxl  // 24

// Font weights
typography.fontWeight.regular  // '400'
typography.fontWeight.medium   // '500'
typography.fontWeight.semiBold // '600'
typography.fontWeight.bold     // '700'

// Pre-defined styles
typography.styles.title     // Large title style
typography.styles.heading   // Section heading style
typography.styles.body      // Body text style
typography.styles.caption   // Small caption style
```

### Border Radius

```tsx
import { borderRadius } from '../theme/tokens';

borderRadius.sm    // 8
borderRadius.md    // 12
borderRadius.lg    // 16
borderRadius.pill  // 9999 - Fully rounded
borderRadius.button // 28 - Button corners
borderRadius.card   // 12 - Card corners
```

### Shadows

```tsx
import { shadows } from '../theme/tokens';

// Apply shadows to StyleSheet
const styles = StyleSheet.create({
  card: {
    ...shadows.md,
    // Other styles
  },
});
```

---

## Example Screen

Here's a complete example of an onboarding screen using the components:

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import {
  Button,
  SelectableListItem,
  PageIndicator,
} from '../components';
import { colors, spacing, typography } from '../theme/tokens';

const GoalSelectionScreen = () => {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const goals = [
    'Sleep soundly',
    'Feel calm and relaxed',
    'Reduce stress',
    'Be present and mindful',
    'Manage anxiety',
    'Something else',
  ];

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal)
        ? prev.filter((g) => g !== goal)
        : [...prev, goal]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          Which goals should we work toward together?
        </Text>
        <Text style={styles.subtitle}>I want to...</Text>

        <View style={styles.list}>
          {goals.map((goal) => (
            <SelectableListItem
              key={goal}
              title={goal}
              selected={selectedGoals.includes(goal)}
              onPress={() => toggleGoal(goal)}
            />
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Continue"
          disabled={selectedGoals.length === 0}
          onPress={() => console.log('Selected:', selectedGoals)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xxl,
  },
  title: {
    ...typography.styles.heading,
    color: colors.dark.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.styles.body,
    color: colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  list: {
    gap: spacing.sm,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xl,
  },
});

export default GoalSelectionScreen;
```
