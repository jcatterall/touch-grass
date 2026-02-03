import { useState } from 'react';
import { Why } from './Why';
import { Goals } from './Goals';
import { Plan } from './Plan';
import { Usage } from './usage/Usage';
import { Home } from './Home';
import { GoalsSplash } from './GoalsSplash';
import { PlanSplash } from './PlanSplash';
import { Streak } from './Streak';
import { Paywall } from './Paywall';
import { Notification } from '../Notification';
import { UsageReport } from './usage/UsageReport';
import { UsagePermissions } from './usage/UsagePermissions';

const Steps: OnboardingStep[] = [
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
]; //ordered

type OnboardingStep =
  | 'home'
  | 'why'
  | 'goalsSplash'
  | 'goals'
  | 'planSplash'
  | 'plan'
  | 'usage'
  | 'usagePermissions'
  | 'usageReport'
  | 'streak'
  | 'paywall'
  | 'notification';

export const Onboarding = () => {
  //TODO: default to home
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('plan');
  const [usage, setUsage] = useState(0);

  const handleNext = (skip: boolean = false) => {
    const currentIndex = Steps.indexOf(currentStep);
    const nextIndex = skip ? 2 : 1; //skip next
    const nextStep = Steps[currentIndex + nextIndex];

    if (nextStep) {
      setCurrentStep(nextStep);
    } else {
      console.log('Onboarding Finished');
    }
  };

  const StepComponent = {
    home: <Home onComplete={handleNext} />,
    why: <Why onComplete={handleNext} />,
    goalsSplash: <GoalsSplash onComplete={handleNext} />,
    goals: <Goals onComplete={handleNext} />,
    planSplash: (
      <PlanSplash onSkip={() => handleNext(true)} onComplete={handleNext} />
    ),
    plan: <Plan onComplete={handleNext} />,
    usage: (
      <Usage onComplete={handleNext} setUsage={value => setUsage(value)} />
    ),
    usagePermissions: (
      <UsagePermissions
        onSkip={() => handleNext(true)}
        onComplete={handleNext}
      />
    ),
    usageReport: <UsageReport usage={usage} onComplete={handleNext} />,
    streak: <Streak onComplete={handleNext} />,
    paywall: <Paywall onComplete={handleNext} />,
    notification: <Notification onComplete={handleNext} />,
  }[currentStep];

  return <>{StepComponent}</>;
};
