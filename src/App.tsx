/**
 * TouchGrass App
 * React Native Application with Headspace Design System
 *
 * @format
 */

import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Why from './screens/onboarding/why';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  // Switch between ButtonGallery and ChipGallery to view components
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Why />
    </SafeAreaProvider>
  );
}

export default App;
