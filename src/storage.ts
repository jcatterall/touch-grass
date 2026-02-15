import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingData } from './screens';
import { BlockingPlan } from './types';

const KEYS = {
  ONBOARDING_COMPLETE: 'onboarding_complete',
  BLOCKING_PLANS: 'blocking_plans',
  GOAL_ANSWERS: 'goal_answers',
} as const;

export const storage = {
  async getOnboardingComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return value === 'true';
  },

  async getPlans(): Promise<BlockingPlan[] | null> {
    const plans = await AsyncStorage.getItem(KEYS.BLOCKING_PLANS);
    const blockingPlans = plans ? JSON.parse(plans) : [];
    return blockingPlans;
  },

  async getOnboardingData(): Promise<OnboardingData | null> {
    const [plans, answers] = await AsyncStorage.multiGet([
      KEYS.BLOCKING_PLANS,
      KEYS.GOAL_ANSWERS,
    ]);
    const blockingPlans = plans[1] ? JSON.parse(plans[1]) : [];
    const goalAnswers = answers[1] ? JSON.parse(answers[1]) : {};
    return { blockingPlans, answers: goalAnswers };
  },

  async saveOnboardingData(data: OnboardingData): Promise<void> {
    await AsyncStorage.multiSet([
      [KEYS.ONBOARDING_COMPLETE, 'true'],
      [KEYS.BLOCKING_PLANS, JSON.stringify(data.blockingPlans)],
      [KEYS.GOAL_ANSWERS, JSON.stringify(data.answers)],
    ]);
  },
};
