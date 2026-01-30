/**
 * TouchGrass App
 * React Native Application with Headspace Design System
 *
 * @format
 */

import {
  StatusBar,
  StyleProp,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Onboarding } from './screens';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  const style: StyleProp<ViewStyle> = {
    flex: 1,
  };

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
