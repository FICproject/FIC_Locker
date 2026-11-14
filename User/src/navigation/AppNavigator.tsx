import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, StatusBar } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, shadows } from '../theme';

// Tabs
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { DocumentsListScreen } from '../screens/documents/DocumentsListScreen';
import { ScannerScreen } from '../screens/scanner/ScannerScreen';
import { CategoriesScreen } from '../screens/categories/CategoriesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

// Stack Screens
import { DocumentDetailScreen } from '../screens/documents/DocumentDetailScreen';
import { ScannerEditScreen } from '../screens/scanner/ScannerEditScreen';
import { UploadDocumentScreen } from '../screens/upload/UploadDocumentScreen';
import { SearchScreen } from '../screens/search/SearchScreen';
import { StorageScreen } from '../screens/storage/StorageScreen';
import { RemindersScreen } from '../screens/reminders/RemindersScreen';
import { SubscriptionScreen } from '../screens/subscription/SubscriptionScreen';
import { SupportScreen } from '../screens/support/SupportScreen';
import { FoldersScreen } from '../screens/folders/FoldersScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

// Icons
import {
  HomeIcon,
  DocumentsIcon,
  ScanIcon,
  CategoriesIcon,
  ProfileIcon,
} from '../assets/icons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const BottomTabNavigator = () => {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FE" translucent={false} />
      <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="DocumentsTab"
        component={DocumentsListScreen}
        options={{
          tabBarLabel: 'My Docs',
          tabBarIcon: ({ color, size }) => <DocumentsIcon color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="ScanTab"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, size }) => <ScanIcon color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="CategoriesTab"
        component={CategoriesScreen}
        options={{
          tabBarLabel: 'Categories',
          tabBarIcon: ({ color, size }) => <CategoriesIcon color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <ProfileIcon color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  </>
);
};

export const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
      <Stack.Screen name="ScannerEdit" component={ScannerEditScreen} />
      <Stack.Screen name="UploadDocument" component={UploadDocumentScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Storage" component={StorageScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Folders" component={FoldersScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
    ...shadows.card,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});

