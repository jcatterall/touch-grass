import { useCallback, useEffect, useState, ReactNode } from 'react';
import { BackHandler } from 'react-native';
import { Why } from './Why';
import { Goals } from './Goals';
import { Plan } from './Plan';
import { Usage } from './usage/Usage';
import { Home } from './Home';
import { GoalsSplash } from './GoalsSplash';
import { PlanSplash } from './PlanSplash';
import { Streak } from './Streak';
import { Paywall } from './Paywall';
import { Notification } from './Notification';
import { UsageReport } from './usage/UsageReport';
import { UsagePermissions } from './usage/UsagePermissions';
import { BlockingPlan } from '../../types';

export interface OnboardingStepProps {
  onComplete: () => void;
  onBack?: () => void;
}

const STEPS = [
  'home',
  'why',
  'usage',
  'usagePermissions',
  'usageReport',
  'goalsSplash',
  'goals',
  'planSplash',
  'plan',
  'streak',
  'paywall',
  'notification',
] as const;

type OnboardingStep = (typeof STEPS)[number];

export const Onboarding = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [usage, setUsage] = useState(1);
  const [blockingPlan, setBlockingPlan] = useState<BlockingPlan | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skippedSteps, setSkippedSteps] = useState<Set<OnboardingStep>>(
    new Set(),
  );

  const currentStep = STEPS[stepIndex];
  const canGoBack = stepIndex > 0;

  const handleNext = useCallback((skip: boolean = false) => {
    if (skip) {
      setSkippedSteps(prev => {
        const next = new Set(prev);
        next.add(STEPS[stepIndex + 1]);
        return next;
      });
    }
    const increment = skip === true ? 2 : 1;
    setStepIndex(prev => {
      const nextIndex = prev + increment;
      if (nextIndex < STEPS.length) {
        return nextIndex;
      }
      console.log('Onboarding Finished');
      return prev;
    });
  }, [stepIndex]);

  const handleBack = useCallback(() => {
    if (!canGoBack) return false;
    setStepIndex(prev => {
      let target = prev - 1;
      while (target > 0 && skippedSteps.has(STEPS[target])) {
        target--;
      }
      return target;
    });
    return true;
  }, [canGoBack, skippedSteps]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBack,
    );
    return () => subscription.remove();
  }, [handleBack]);

  const stepComponents: Record<OnboardingStep, ReactNode> = {
    home: <Home onComplete={handleNext} />,
    why: <Why onComplete={handleNext} onBack={handleBack} />,
    goalsSplash: <GoalsSplash onComplete={handleNext} onBack={handleBack} />,
    goals: (
      <Goals
        answers={answers}
        onComplete={currentAnswers => {
          setAnswers(currentAnswers);
          handleNext();
        }}
        onBack={handleBack}
      />
    ),
    planSplash: (
      <PlanSplash
        onSkip={() => handleNext(true)}
        onComplete={handleNext}
        onBack={handleBack}
      />
    ),
    plan: (
      <Plan
        plan={blockingPlan}
        onComplete={plan => {
          setBlockingPlan(plan);
          handleNext();
        }}
        onBack={handleBack}
      />
    ),
    usage: (
      <Usage
        usage={usage}
        onComplete={handleNext}
        setUsage={setUsage}
        onBack={handleBack}
      />
    ),
    usagePermissions: (
      <UsagePermissions
        onSkip={() => handleNext(true)}
        onComplete={handleNext}
        onBack={handleBack}
      />
    ),
    usageReport: (
      <UsageReport usage={usage} onComplete={handleNext} onBack={handleBack} />
    ),
    streak: <Streak onComplete={handleNext} onBack={handleBack} />,
    paywall: <Paywall onComplete={handleNext} onBack={handleBack} />,
    notification: <Notification onComplete={handleNext} onBack={handleBack} />,
  };

  return <>{stepComponents[currentStep]}</>;
};
