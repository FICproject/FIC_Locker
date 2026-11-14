import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Register both internal keys for seamless compatibility with both existing and new native builds
AppRegistry.registerComponent('docuscan_user', () => App);
AppRegistry.registerComponent('fic_locker_user', () => App);
if (appName && appName !== 'docuscan_user' && appName !== 'fic_locker_user') {
  AppRegistry.registerComponent(appName, () => App);
}

