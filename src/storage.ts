import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingData } from './screens';

const KEYS = {
  ONBOARDING_COMPLETE: 'onboarding_complete',
  BLOCKING_PLAN: 'blocking_plan',
  GOAL_ANSWERS: 'goal_answers',
} as const;

export const storage = {
  async getOnboardingComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return value === 'true';
  },

  async getOnboardingData(): Promise<OnboardingData | null> {
    const [plan, answers] = await AsyncStorage.multiGet([
      KEYS.BLOCKING_PLAN,
      KEYS.GOAL_ANSWERS,
    ]);
    const blockingPlan = plan[1] ? JSON.parse(plan[1]) : null;
    const goalAnswers = answers[1] ? JSON.parse(answers[1]) : {};
    return { blockingPlan, answers: goalAnswers };
  },

  async saveOnboardingData(data: OnboardingData): Promise<void> {
    await AsyncStorage.multiSet([
      [KEYS.ONBOARDING_COMPLETE, 'true'],
      [KEYS.BLOCKING_PLAN, JSON.stringify(data.blockingPlan)],
      [KEYS.GOAL_ANSWERS, JSON.stringify(data.answers)],
    ]);
  },
};
