import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingData } from './screens';
import { BlockingPlan } from './types';
import { generateUUID } from './utils/guid';

const KEYS = {
  ONBOARDING_COMPLETE: 'onboarding_complete',
  BLOCKING_PLANS: 'blocking_plans',
  GOAL_ANSWERS: 'goal_answers',
} as const;

async function getStoredPlans(): Promise<BlockingPlan[]> {
  const raw = await AsyncStorage.getItem(KEYS.BLOCKING_PLANS);
  return raw ? JSON.parse(raw) : [];
}

async function savePlans(plans: BlockingPlan[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.BLOCKING_PLANS, JSON.stringify(plans));
}

export const storage = {
  async getOnboardingComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return value === 'true';
  },

  async getPlans(): Promise<BlockingPlan[]> {
    return (await getStoredPlans()).sort(x => (x.active ? -1 : 1));
  },

  async createPlan(plan: Omit<BlockingPlan, 'id'>): Promise<void> {
    const plans = await getStoredPlans();
    const newPlan: BlockingPlan = { ...plan, id: generateUUID(), active: true };
    await savePlans([...plans, newPlan]);
  },

  async updatePlan(updatedPlan: BlockingPlan): Promise<void> {
    const plans = await getStoredPlans();
    await savePlans(
      plans.map(p => (p.id === updatedPlan.id ? updatedPlan : p)),
    );
  },

  async duplicatePlan(planId: string): Promise<void> {
    const plans = await getStoredPlans();
    const source = plans.find(p => p.id === planId);
    if (!source) return;
    const duplicate: BlockingPlan = {
      ...source,
      id: generateUUID(),
      active: true,
    };
    await savePlans([...plans, duplicate]);
  },

  async togglePlanActive(planId: string): Promise<void> {
    const plans = await getStoredPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    plan.active = !plan.active;
    await savePlans(plans);
  },

  async deletePlan(planId: string): Promise<void> {
    const plans = await getStoredPlans();
    await savePlans(plans.filter(p => p.id !== planId));
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
