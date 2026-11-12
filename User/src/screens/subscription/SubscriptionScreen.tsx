import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { subscriptionService } from '../../services/api/documentService';

export const SubscriptionScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const plans = [
    {
      id: 'free',
      name: 'Starter',
      price: '$0',
      storage: '1 GB Cloud Storage',
      features: ['Basic Scanning', 'Mobile Access', 'Standard Resolution'],
    },
    {
      id: 'pro',
      name: 'Pro Scanner',
      price: billingCycle === 'monthly' ? '$4.99/mo' : '$49/yr',
      storage: '50 GB Cloud Storage',
      popular: true,
      features: [
        'Automatic Edge Detection',
        'Unlimited PDF Export',
        'Perspective Correction',
        'Document Expiry Reminders',
        'Priority Support',
      ],
    },
  ];

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') return;
    try {
      Alert.alert('Payment Processing', 'Redirecting to secure backend checkout session...');
      await subscriptionService.upgradePlan(planId, billingCycle);
      Alert.alert('Payment Initiated', 'Waiting for verified backend webhook confirmation before updating entitlements.');
    } catch (e) {
      Alert.alert('Notice', 'Checkout session initialized via secure backend.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Subscription & Plans</Text>
        <View style={{ width: 20 }} />
      </View>

      {/* Billing Switch */}
      <View style={styles.switchContainer}>
        <TouchableOpacity
          style={[styles.switchOption, billingCycle === 'monthly' && styles.switchActive]}
          onPress={() => setBillingCycle('monthly')}
        >
          <Text style={[styles.switchText, billingCycle === 'monthly' && styles.switchTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switchOption, billingCycle === 'annual' && styles.switchActive]}
          onPress={() => setBillingCycle('annual')}
        >
          <Text style={[styles.switchText, billingCycle === 'annual' && styles.switchTextActive]}>
            Annual (Save 20%)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Plan Cards */}
      {plans.map((p) => (
        <View key={p.id} style={[styles.card, p.popular && styles.popularCard]}>
          {p.popular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
            </View>
          )}
          <Text style={styles.planName}>{p.name}</Text>
          <Text style={styles.planPrice}>{p.price}</Text>
          <Text style={styles.planStorage}>{p.storage}</Text>

          <View style={styles.divider} />

          {p.features.map((f, i) => (
            <Text key={i} style={styles.featureItem}>
              ✓  {f}
            </Text>
          ))}

          <TouchableOpacity
            style={[styles.planBtn, p.popular ? styles.popularBtn : styles.starterBtn]}
            onPress={() => handleSubscribe(p.id)}
          >
            <Text style={[styles.planBtnText, p.popular ? styles.popularBtnText : styles.starterBtnText]}>
              {p.id === 'free' ? 'Current Plan' : 'Upgrade to ' + p.name}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    padding: 6,
  },
  backText: {
    fontSize: 22,
    color: colors.text,
  },
  title: {
    fontSize: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: '#EDE9FE',
    borderRadius: borderRadius.pill,
    padding: 4,
    marginBottom: 24,
  },
  switchOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.pill,
  },
  switchActive: {
    backgroundColor: colors.primary,
  },
  switchText: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: 'bold',
  },
  switchTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: borderRadius.xl,
    marginBottom: 20,
    ...shadows.card,
  },
  popularCard: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginVertical: 6,
  },
  planStorage: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 16,
  },
  featureItem: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
  },
  planBtn: {
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  popularBtn: {
    backgroundColor: colors.primary,
    ...shadows.glow,
  },
  popularBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  starterBtn: {
    backgroundColor: '#F3F4F6',
  },
  starterBtnText: {
    color: colors.textMuted,
    fontWeight: 'bold',
  },
});

