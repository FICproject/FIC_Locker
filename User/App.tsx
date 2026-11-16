import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, LogBox, AppState, AppStateStatus } from 'react-native';

LogBox.ignoreAllLogs();
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { SplashScreen } from './src/screens/splash/SplashScreen';
import { SecurityLockModal } from './src/components/modals/SecurityLockModal';
import { securityService } from './src/services/securityService';

const RootContent = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  // Check if PIN lock is active on cold launch
  useEffect(() => {
    (async () => {
      const pinActive = await securityService.isPinEnabled();
      if (pinActive) {
        setIsAppLocked(true);
      }
    })();
  }, []);

  // Listen to background-to-foreground transitions for auto-lock
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        const shouldLock = await securityService.shouldLockOnResume();
        if (shouldLock) {
          setIsAppLocked(true);
        }
      } else if (nextAppState.match(/inactive|background/)) {
        await securityService.recordBackgroundTime();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (showSplash || isLoading) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" translucent={false} />
        {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>

      {/* Global App Lock Gate */}
      <SecurityLockModal
        visible={isAppLocked}
        mode="unlock"
        onSuccess={() => setIsAppLocked(false)}
      />
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
