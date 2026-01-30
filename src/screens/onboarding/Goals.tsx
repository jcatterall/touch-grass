import { StyleSheet, Text, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { useState } from 'react';
import { spacing, typography } from '../../theme';
import { Button, Select } from '../../components';

export interface GoalsProps {
  onComplete: () => void;
}

interface Details {
  title: string;
  subTitle: string;
  options: Option[];
}

interface Option {
  label: string;
  value: string;
}

export const Goals = ({ onComplete }: GoalsProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const currentStep = Steps[currentPage];
  const selectedValue = answers[currentPage] ?? null;
  const isLastPage = currentPage === Steps.length - 1;

  const handleContinue = () => {
    if (!selectedValue) return;

    if (isLastPage) {
      onComplete();
    } else {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleSelect = (value: (string | number) | (string | number)[]) => {
    const newValue = Array.isArray(value) ? value[0] : value;
    setAnswers(prev => ({ ...prev, [currentPage]: String(newValue) }));
  };

  return (
    <OnboardingContainer>
      <View style={styles.flex}>
        <View style={styles.item}>
          <Text style={typography.styles.light.title}>{currentStep.title}</Text>
          <Text style={typography.styles.light.body}>
            {currentStep.subTitle}
          </Text>

          <View style={styles.selectWrapper}>
            <Select
              options={currentStep.options}
              value={selectedValue ?? ''}
              onValueChange={handleSelect}
              variant="blue"
            />
          </View>
        </View>
      </View>

      <View>
        <Button size="lg" onPress={handleContinue}>
          Continue
        </Button>
      </View>
    </OnboardingContainer>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.md,
  },
  selectWrapper: {
    marginHorizontal: spacing.xxxxl,
    marginTop: spacing.lg, // Optional: adds a bit of breathing room below the subTitle
  },
});

const Steps: Details[] = [
  {
    title: "What's on your mind?",
    subTitle: 'Choose one option for now. You can explore others',
    options: [
      { label: 'Reduce stress', value: 'stress' },
      { label: 'Improve sleep', value: 'sleep' },
      { label: 'Build focus', value: 'focus' },
      { label: 'Increase happiness', value: 'happiness' },
      { label: 'Reduce anxiety', value: 'anxiety' },
    ],
  },
  {
    title: "What's most important to you right now?",
    subTitle: 'Choose one to focus on for the next week',
    options: [
      { label: 'Manage stress', value: 'manage_stress' },
      { label: 'Sleep better', value: 'sleep_better' },
      { label: 'Improve focus', value: 'improve_focus' },
      { label: 'Increase joy', value: 'increase_joy' },
      { label: 'Reduce worry', value: 'reduce_worry' },
    ],
  },
  {
    title: 'Which activities will you try?',
    subTitle: 'Pick one to start incorporating into your routine',
    options: [
      { label: 'Mindfulness meditation', value: 'mindfulness' },
      { label: 'Breathing exercises', value: 'breathing' },
      { label: 'Short workouts', value: 'exercise' },
      { label: 'Gratitude journaling', value: 'journaling' },
      { label: 'Consistent sleep schedule', value: 'sleep_routine' },
    ],
  },
];
