import { NativeModules, Platform } from 'react-native';

function resolveDevHost(): string {
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = /^https?:\/\/([^/:]+)/i.exec(scriptURL);
    if (match?.[1]) {
      return match[1];
    }
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

// Automatically matches localhost (USB adb reverse / iOS), 10.0.2.2 (Android emulator),
// or LAN IP (Wi-Fi Metro). Replace with your HTTPS API domain for release builds.
export const API_BASE_URL = `http://${resolveDevHost()}:5000/api/v1`;
