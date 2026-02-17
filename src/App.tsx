import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Onboarding, MainApp, Splash } from './screens';
import type { OnboardingData } from './screens';
import { useCallback, useEffect, useState } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { colors } from './theme';
import { storage } from './storage';
import { BuildConfig } from './native/BuildConfig';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    Purchases.configure({ apiKey: BuildConfig.REVENUECAT_API_KEY });
  }, []);

  useEffect(() => {
    const minDelay = new Promise<void>(resolve => setTimeout(resolve, 2000));
    const loadData = storage.getOnboardingComplete();

    Promise.all([minDelay, loadData]).then(([, complete]) => {
      setOnboardingComplete(complete);
      setIsLoading(false);
    });
  }, []);

  const handleOnboardingComplete = useCallback(async (data: OnboardingData) => {
    await storage.saveOnboardingData(data);
    setOnboardingComplete(true);
  }, []);

  if (isLoading) {
    return <Splash />;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        {onboardingComplete ? (
          <MainApp />
        ) : (
          <Onboarding onComplete={handleOnboardingComplete} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default App;
