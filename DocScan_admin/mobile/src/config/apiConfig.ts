import { Platform } from 'react-native';

// Android emulator maps 10.0.2.2 to host localhost; iOS simulator uses localhost.
// Replace with your staging/production HTTPS API domain before release builds.
export const API_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api/v1'
    : 'http://localhost:5000/api/v1';
