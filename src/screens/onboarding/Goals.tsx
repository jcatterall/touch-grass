import { Pressable, StyleSheet, View } from 'react-native';
import { OnboardingContainer } from '../../components/onboarding/OnboardingContainer';
import { useState } from 'react';
import { spacing } from '../../theme';
import { Button, Select, Typography } from '../../components';

export interface GoalsProps {
  onComplete: (answers: Record<number, string>) => void;
  onBack?: () => void;
  answers: Record<string, string>;
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

export const Goals = ({ onComplete, answers }: GoalsProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [currentAnswers, setCurrentAnswers] =
    useState<Record<number, string>>(answers);

  const currentStep = Steps[currentPage];
  const selectedValue = currentAnswers[currentPage] ?? null;
  const isLastPage = currentPage === Steps.length - 1;

  const handleContinue = () => {
    if (isLastPage) {
      onComplete(currentAnswers);
    } else {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleSelect = (value: (string | number) | (string | number)[]) => {
    const newValue = Array.isArray(value) ? value[0] : value;
    setCurrentAnswers(prev => ({ ...prev, [currentPage]: String(newValue) }));
  };

  return (
    <OnboardingContainer>
      <View style={{ ...styles.flex, gap: spacing.xxxxl }}>
        <View style={styles.flexReverse}>
          <Pressable onPress={handleContinue}>
            <Typography mode="dark" variant="link">
              Skip
            </Typography>
          </Pressable>
        </View>
        <View style={styles.item}>
          <Typography mode="dark" variant="heading" center>
            {currentStep.title}
          </Typography>
          <Typography mode="dark" variant="subtitle" color="secondary" center>
            {currentStep.subTitle}
          </Typography>

          <View style={styles.selectWrapper}>
            <Select
              options={currentStep.options}
              value={selectedValue ?? ''}
              onValueChange={handleSelect}
              variant="blue"
              mode="dark"
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
  flexReverse: {
    flexDirection: 'row-reverse',
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.md,
  },
  selectWrapper: {
    marginTop: spacing.lg,
  },
});

const Steps: Details[] = [
  {
    title: 'How does your phone use make you feel?',
    subTitle: 'Be honest — awareness is the first step to change',
    options: [
      { label: 'Anxious or overwhelmed', value: 'anxious' },
      { label: 'Distracted and unfocused', value: 'distracted' },
      { label: 'Guilty about wasted time', value: 'guilty' },
      { label: 'Sluggish from sitting too much', value: 'sedentary' },
      { label: 'Fine, but I want more control', value: 'control' },
    ],
  },
  {
    title: 'Which apps drain your time the most?',
    subTitle: 'Studies show social media is the biggest culprit for most',
    options: [
      { label: 'Social media (Instagram, TikTok, X)', value: 'social_media' },
      { label: 'Video streaming (YouTube, Netflix)', value: 'video' },
      { label: 'Games', value: 'games' },
      { label: 'News and browsing', value: 'news' },
      { label: 'Messaging apps', value: 'messaging' },
    ],
  },
  {
    title: 'When do you reach for your phone most?',
    subTitle: 'Identifying triggers helps break automatic habits',
    options: [
      { label: 'When I wake up or before bed', value: 'sleep_times' },
      { label: 'When I feel bored or restless', value: 'boredom' },
      { label: 'When I want to avoid a task', value: 'procrastination' },
      { label: 'When I feel stressed or anxious', value: 'stress' },
      { label: 'Instead of going for a walk', value: 'skip_walk' },
    ],
  },
  {
    title: 'What would you do with more free time?',
    subTitle: 'Having a clear intention makes change sustainable',
    options: [
      { label: 'Spend time with family or friends', value: 'relationships' },
      { label: 'Exercise or go outside', value: 'physical' },
      { label: 'Read, learn, or build something', value: 'growth' },
      { label: 'Rest and recharge properly', value: 'rest' },
      { label: 'Focus on work or side projects', value: 'productivity' },
    ],
  },
  {
    title: 'How much screen time do you want to cut?',
    subTitle:
      'Start small — even 30 minutes daily adds up to 180+ hours a year',
    options: [
      { label: '30 minutes per day', value: '30min' },
      { label: '1 hour per day', value: '1hr' },
      { label: '2 hours per day', value: '2hr' },
      { label: '3+ hours per day', value: '3hr_plus' },
      { label: "I'm not sure yet", value: 'unsure' },
    ],
  },
  {
    title: 'How do you want to earn your screen time?',
    subTitle:
      'Walking reduces stress and boosts mood — a natural swap for scrolling',
    options: [
      { label: 'Walk a certain distance', value: 'distance' },
      { label: 'Walk for a set amount of time', value: 'time' },
      { label: 'Either works for me', value: 'either' },
      { label: 'Start easy and increase over time', value: 'progressive' },
      { label: "I'm not sure yet", value: 'unsure' },
    ],
  },
  {
    title: 'What motivates you to make this change?',
    subTitle: 'Your "why" will keep you going when it gets hard',
    options: [
      { label: 'My mental health is suffering', value: 'mental_health' },
      { label: 'I want to be more present', value: 'presence' },
      { label: 'I want to move more and sit less', value: 'active' },
      { label: 'I need to be more productive', value: 'productivity' },
      { label: 'I want to set a better example', value: 'role_model' },
    ],
  },
];
