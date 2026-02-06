import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { OnboardingContainer } from '../../../components/onboarding/OnboardingContainer';
import { Button } from '../../../components';
import UsageStats, {
  type DailyUsage,
  type AppUsage,
} from '../../../native/UsageStats';
import { calculateAverage } from '../../../components/usage/Usage.utils';
import { UsageReportComparison } from './UsageReportComparison';
import { UsageStatsPage } from './UsageStats';
import { UsageYearly } from './UsageYearly';
import { UsageFirstWeek } from './UsageFirstWeek';
import { UsageActual } from './UsageActual';

export interface UsageReportProps {
  onComplete: () => void;
  usage: number;
  onBack?: () => void;
}

const Steps: UsageReportStep[] = [
  'actual',
  'stats',
  'yearly',
  'comparison',
  'firstWeek',
]; //ordered

type UsageReportStep =
  | 'actual'
  | 'stats'
  | 'yearly'
  | 'comparison'
  | 'firstWeek';

export const UsageReport = ({ onComplete, usage, onBack }: UsageReportProps) => {
  const [currentStep, setCurrentStep] = useState<UsageReportStep>('actual');
  const [weeklyData, setWeeklyData] = useState<DailyUsage[]>([]);
  const [appData, setAppData] = useState<AppUsage[]>([]);
  const [pickupCount, setPickupCount] = useState(0);

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        const hasPermission = await UsageStats.hasPermission();
        if (!hasPermission) return;

        const [weekly, apps, pickups] = await Promise.all([
          UsageStats.getWeeklyUsage(),
          UsageStats.getAppUsage(),
          UsageStats.getDailyPickups(),
        ]);

        setWeeklyData(weekly);
        setAppData(apps);
        setPickupCount(pickups);
      } catch (error) {
        console.error('Error fetching usage data:', error);
      }
    };

    fetchUsageData();
  }, []);

  const average = calculateAverage(weeklyData);
  const totalHours = average.hours + average.minutes / 60;
  const yearsIn30 = ((totalHours * 365 * 30) / (24 * 365)).toFixed(1);
  const reducedHours = Math.floor(totalHours / 4);
  const reducedMinutes = Math.round((totalHours / 4 - reducedHours) * 60);
  const reducedPickups = Math.round(pickupCount / 4);

  const handleNext = () => {
    const currentIndex = Steps.indexOf(currentStep);
    const nextStep = Steps[currentIndex + 1];

    if (nextStep) {
      setCurrentStep(nextStep);
    } else {
      onComplete();
    }
  };

  const handleBack = useCallback((): boolean => {
    const currentIndex = Steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(Steps[currentIndex - 1]);
      return true;
    }
    if (onBack) {
      onBack();
      return true;
    }
    return false;
  }, [currentStep, onBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBack,
    );
    return () => subscription.remove();
  }, [handleBack]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'actual':
        return <UsageActual key="actual" usage={usage} average={average} />;
      case 'stats':
        return (
          <UsageStatsPage
            key="stats"
            appData={appData}
            average={{ ...average, pickups: pickupCount }}
            weeklyData={weeklyData}
          />
        );
      case 'yearly':
        return (
          <UsageYearly key="yearly" average={average} yearsIn30={yearsIn30} />
        );
      case 'comparison':
        return (
          <UsageReportComparison
            key="comparison"
            average={{ ...average, pickups: pickupCount }}
            reduced={{
              hours: reducedHours,
              minutes: reducedMinutes,
              pickups: reducedPickups,
            }}
            totalHours={totalHours}
          />
        );
      case 'firstWeek':
        return <UsageFirstWeek key="firstWeek" />;
      default:
        return null;
    }
  };

  return (
    <OnboardingContainer>
      {renderCurrentStep()}
      <Button size="lg" onPress={handleNext}>
        Continue
      </Button>
    </OnboardingContainer>
  );
};
