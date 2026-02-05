import {
  Platform,
  StatusBar,
  StyleProp,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Onboarding } from './screens';
import { useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  const style: StyleProp<ViewStyle> = {
    flex: 1,
  };

  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    // Platform-specific API keys
    const iosApiKey = 'test_FCQVhIlJnsAXsRUEPKrOkgMZjDN';
    const androidApiKey = 'test_FCQVhIlJnsAXsRUEPKrOkgMZjDN';

    if (Platform.OS === 'ios') {
      Purchases.configure({ apiKey: iosApiKey });
    } else if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: androidApiKey });
    }
  }, []);

  return (
    <SafeAreaProvider>
      <View style={style}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <Onboarding />
      </View>
    </SafeAreaProvider>
  );
}

export default App;
