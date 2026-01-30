import { useState } from 'react';
import { Why } from './Why';
import { Goals } from './Goals';
import { Plan } from './Plan';
import { Usage } from './Usage';
import { Home } from './Home';

const Steps: OnboardingStep[] = ['home', 'why', 'usage', 'goals', 'plan'];
type OnboardingStep = 'home' | 'why' | 'goals' | 'plan' | 'usage';

export const Onboarding = () => {
  //TODO: default to why
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('home');

  const handleNext = () => {
    const currentIndex = Steps.indexOf(currentStep);
    const nextStep = Steps[currentIndex + 1];

    if (nextStep) {
      setCurrentStep(nextStep);
    } else {
      console.log('Onboarding Finished');
    }
  };

  const StepComponent = {
    home: <Home onComplete={handleNext} />,
    why: <Why onComplete={handleNext} />,
    goals: <Goals onComplete={handleNext} />,
    plan: <Plan onComplete={handleNext} />,
    usage: <Usage onComplete={handleNext} />,
  }[currentStep];

  return <>{StepComponent}</>;
};
