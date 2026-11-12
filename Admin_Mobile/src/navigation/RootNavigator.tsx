import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useMobileAuth } from '../app/AuthContext';
import { LoadingView } from '../components/MobilePrimitives';
import { LoginScreen } from '../features/auth/LoginScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../features/auth/ResetPasswordScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { UsersScreen } from '../features/users/UsersScreen';
import { UserDetailScreen } from '../features/users/UserDetailScreen';
import { DocumentsScreen } from '../features/documents/DocumentsScreen';
import { DocumentDetailScreen } from '../features/documents/DocumentDetailScreen';
import { SupportScreen } from '../features/support/SupportScreen';
import { TicketDetailScreen } from '../features/support/TicketDetailScreen';
import { MoreScreen } from '../features/more/MoreScreen';
import { SubscriptionsPaymentsScreen } from '../features/monitoring/SubscriptionsPaymentsScreen';
import { StorageScreen } from '../features/storage/StorageScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { AuditLogsScreen } from '../features/audit-logs/AuditLogsScreen';
import type {
  AuthStackParamList,
  DocumentsStackParamList,
  MainTabParamList,
  MoreStackParamList,
  SupportStackParamList,
  UsersStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const UsersStack = createNativeStackNavigator<UsersStackParamList>();
const DocumentsStack = createNativeStackNavigator<DocumentsStackParamList>();
const SupportStack = createNativeStackNavigator<SupportStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: '#0A3A8E' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { fontWeight: '700' as const },
};

function UsersNavigator() {
  return (
    <UsersStack.Navigator screenOptions={headerOptions}>
      <UsersStack.Screen name="UsersList" component={UsersScreen} options={{ title: 'Users' }} />
      <UsersStack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: 'User Details' }} />
    </UsersStack.Navigator>
  );
}

function DocumentsNavigator() {
  return (
    <DocumentsStack.Navigator screenOptions={headerOptions}>
      <DocumentsStack.Screen name="DocumentsList" component={DocumentsScreen} options={{ title: 'Documents & Uploads' }} />
      <DocumentsStack.Screen name="DocumentDetail" component={DocumentDetailScreen} options={{ title: 'Document Details' }} />
    </DocumentsStack.Navigator>
  );
}

function SupportNavigator() {
  return (
    <SupportStack.Navigator screenOptions={headerOptions}>
      <SupportStack.Screen name="SupportList" component={SupportScreen} options={{ title: 'Support Tickets' }} />
      <SupportStack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'Ticket Details' }} />
    </SupportStack.Navigator>
  );
}

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={headerOptions}>
      <MoreStack.Screen name="MoreHub" component={MoreScreen} options={{ title: 'Operations & Audit' }} />
      <MoreStack.Screen
        name="SubscriptionsPayments"
        component={SubscriptionsPaymentsScreen}
        options={{ title: 'Subscriptions & Payments' }}
      />
      <MoreStack.Screen name="StorageMonitoring" component={StorageScreen} options={{ title: 'Storage Usage' }} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <MoreStack.Screen name="AuditLogs" component={AuditLogsScreen} options={{ title: 'Audit Trail' }} />
    </MoreStack.Navigator>
  );
}

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 16, opacity: focused ? 1 : 0.6 }}>{glyph}</Text>;
}

export function RootNavigator() {
  const { admin, loading } = useMobileAuth();

  if (loading) {
    return <LoadingView label="Verifying Admin session..." />;
  }

  return (
    <NavigationContainer>
      {!admin ? (
        <AuthStack.Navigator screenOptions={headerOptions}>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
          <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
        </AuthStack.Navigator>
      ) : (
        <Tabs.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#1D63DC',
            tabBarInactiveTintColor: '#64748B',
            tabBarStyle: {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#E2E8F0',
              height: 60,
              paddingBottom: 6,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          }}
        >
          <Tabs.Screen
            name="DashboardTab"
            component={DashboardScreen}
            options={{
              headerShown: false,
              title: 'Home',
              tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="UsersTab"
            component={UsersNavigator}
            options={{
              headerShown: false,
              title: 'Users',
              tabBarIcon: ({ focused }) => <TabIcon glyph="👥" focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="DocumentsTab"
            component={DocumentsNavigator}
            options={{
              headerShown: false,
              title: 'Documents',
              tabBarIcon: ({ focused }) => <TabIcon glyph="📄" focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="SupportTab"
            component={SupportNavigator}
            options={{
              headerShown: false,
              title: 'Support',
              tabBarIcon: ({ focused }) => <TabIcon glyph="💬" focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="MoreTab"
            component={MoreNavigator}
            options={{
              headerShown: false,
              title: 'More',
              tabBarIcon: ({ focused }) => <TabIcon glyph="•••" focused={focused} />,
            }}
          />
        </Tabs.Navigator>
      )}
    </NavigationContainer>
  );
}
