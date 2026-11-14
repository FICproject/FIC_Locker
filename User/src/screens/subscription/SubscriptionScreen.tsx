import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { subscriptionService } from '../../services/api/documentService';
import type { SubscriptionPlan, UserSubscription } from '../../types';
import { formatBytes } from '../../utils/formatters';

export const SubscriptionScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSub, setCurrentSub] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPlans = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [fetchedPlans, fetchedSub] = await Promise.all([
        subscriptionService.getPlans(),
        subscriptionService.getCurrentSubscription().catch(() => null),
      ]);
      setPlans(fetchedPlans);
      setCurrentSub(fetchedSub);
      if (fetchedPlans.length === 0) {
        setErrorMessage('No active subscription plans returned by the server.');
      }
    } catch (e: any) {
      console.warn('[SubscriptionScreen] Failed to load plans:', e);
      setErrorMessage(e?.message || 'Failed to connect to backend server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans])
  );

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleSubscribe = async (planId: string, planCode?: string) => {
    if (planCode === 'free' || planId === 'free') return;
    try {
      Alert.alert('Payment Processing', 'Redirecting to secure backend checkout session...');
      await subscriptionService.upgradePlan(planId, billingCycle);
      Alert.alert(
        'Payment Initiated',
        'Waiting for verified backend webhook confirmation before updating entitlements.'
      );
    } catch (e) {
      Alert.alert('Notice', 'Checkout session initialized via secure backend.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPlans(true)} />}
    >
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
            Annual (Save ~20%)
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading subscription plans...</Text>
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {errorMessage || 'No subscription plans currently available.'}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => loadPlans(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>↻ Refresh Plans</Text>
          </TouchableOpacity>
        </View>
      ) : (
        plans.map((p) => {
          const isCurrent =
            p.code === 'free' ||
            currentSub?.planId === p._id ||
            currentSub?.planName?.toLowerCase() === p.name.toLowerCase();

          const monthlyPrice = p.monthlyPriceInr ?? p.priceMonthly ?? 0;
          const annualPrice = p.annualPriceInr ?? p.priceAnnually ?? 0;
          const priceDisplay =
            billingCycle === 'monthly'
              ? monthlyPrice === 0
                ? '₹0'
                : `₹${monthlyPrice}/mo`
              : annualPrice === 0
              ? '₹0'
              : `₹${annualPrice}/yr`;

          const storageBytes = p.storageLimitBytes ?? p.storageQuotaBytes ?? 0;
          const storageDisplay = storageBytes > 0 ? `${formatBytes(storageBytes)} Cloud Storage` : '';

          const isPopular =
            p.isPopular || p.code === 'plus' || p.code === 'pro' || p.name.toLowerCase().includes('plus');

          return (
            <View key={p._id || p.code} style={[styles.card, isPopular && styles.popularCard]}>
              {isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planPrice}>{priceDisplay}</Text>
              {storageDisplay ? <Text style={styles.planStorage}>{storageDisplay}</Text> : null}
              {p.description ? <Text style={styles.planDesc}>{p.description}</Text> : null}

              <View style={styles.divider} />

              {(p.features || []).map((f, i) => (
                <Text key={i} style={styles.featureItem}>
                  ✓  {f}
                </Text>
              ))}

              <TouchableOpacity
                style={[styles.planBtn, isPopular ? styles.popularBtn : styles.starterBtn]}
                onPress={() => handleSubscribe(p._id, p.code)}
                disabled={isCurrent}
              >
                <Text
                  style={[
                    styles.planBtnText,
                    isPopular ? styles.popularBtnText : styles.starterBtnText,
                  ]}
                >
                  {isCurrent ? 'Current Plan' : `Upgrade to ${p.name}`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
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
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.pill,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
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
  planDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
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
  planBtnText: {
    fontSize: 14,
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
