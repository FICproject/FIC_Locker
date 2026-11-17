import { NativeModules, Platform } from 'react-native';

export const PROD_API_BASE_URL = 'https://fic-locker.onrender.com/api/v1';

function resolveDevHost(): string {
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = /^https?:\/\/([^/:]+)/i.exec(scriptURL);
    if (match?.[1]) {
      return match[1];
    }
  }
  return Platform.OS === 'android' ? '192.168.100.110' : 'localhost';
}

// In production release builds or when __DEV__ is false, defaults to Render cloud backend.
// In development, uses Render or the local dev machine depending on developer preference.
export const API_BASE_URL = __DEV__
  ? PROD_API_BASE_URL // Connects directly to live Render backend
  : PROD_API_BASE_URL;

export const DEV_LOCAL_API_BASE_URL = `http://${resolveDevHost()}:5000/api/v1`;
