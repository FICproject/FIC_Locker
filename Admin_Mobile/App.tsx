import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MobileAuthProvider } from './src/app/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <MobileAuthProvider>
        <RootNavigator />
      </MobileAuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
