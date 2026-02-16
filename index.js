/**
 * Foobar
 * @format Foo
 */

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// Register the headless task for background activity detection
import './src/native/headlessTask';

AppRegistry.registerComponent(appName, () => App);
