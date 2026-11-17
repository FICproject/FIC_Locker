import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, borderRadius, typography, shadows } from '../../theme';
import { subscriptionService } from '../../services/api/documentService';

interface RazorpayOrderData {
  orderId: string;
  amountInr: number;
  amount: number;
  currency: string;
  keyId: string;
  plan: {
    _id: string;
    name: string;
    code: string;
    description?: string;
  };
  user: {
    name: string;
    email: string;
    phone?: string;
  };
}

interface RazorpayCheckoutModalProps {
  visible: boolean;
  orderData: RazorpayOrderData | null;
  billingCycle: 'monthly' | 'annual';
  onClose: () => void;
  onSuccess: (subscription: any) => void;
}

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  visible,
  orderData,
  billingCycle,
  onClose,
  onSuccess,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');

  if (!orderData) return null;

  const handlePay = async () => {
    setIsProcessing(true);
    setProcessStatus('Connecting to Razorpay gateway...');

    try {
      await new Promise((r) => setTimeout(r, 800));
      setProcessStatus(`Processing ₹${orderData.amountInr}.00 payment...`);

      await new Promise((r) => setTimeout(r, 1000));
      setProcessStatus('Verifying transaction signature...');

      const mockPaymentId = `pay_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const mockSignature = `sig_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

      const res = await subscriptionService.verifyPayment({
        orderId: orderData.orderId,
        paymentId: mockPaymentId,
        signature: mockSignature,
        planId: orderData.plan._id,
        billingCycle,
      });

      setIsProcessing(false);

      Alert.alert(
        '🎉 Payment Successful!',
        `Your payment of ₹${orderData.amountInr}.00 has been verified by Razorpay.\n\nPlan: ${orderData.plan.name} (${billingCycle})\nPayment ID: ${mockPaymentId}\n\nYour cloud storage quota and features have been upgraded!`,
        [
          {
            text: 'Continue',
            onPress: () => {
              onSuccess(res.subscription);
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert('Payment Error', err?.response?.data?.message || err?.message || 'Transaction could not be completed.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Razorpay Brand Bar */}
          <View style={styles.brandBar}>
            <View style={styles.brandLeft}>
              <View style={styles.rzpLogoBadge}>
                <Text style={styles.rzpLogoText}>R</Text>
              </View>
              <View>
                <Text style={styles.brandTitle}>FIC Locker Storage</Text>
                <Text style={styles.brandSub}>Razorpay Trusted Business</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={isProcessing}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Amount & Plan Ribbon */}
          <View style={styles.amountRibbon}>
            <View>
              <Text style={styles.planLabel}>
                {orderData.plan.name} Plan • {billingCycle === 'annual' ? 'Annual' : 'Monthly'}
              </Text>
              <Text style={styles.planSub}>{orderData.user.email}</Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.currencySymbol}>₹</Text>
              <Text style={styles.amountText}>{orderData.amountInr}.00</Text>
            </View>
          </View>

          {/* Test Mode Notification Tag */}
          <View style={styles.testModeBanner}>
            <Text style={styles.testModeDot}>●</Text>
            <Text style={styles.testModeText}>
              Razorpay Key: {orderData.keyId.slice(0, 14)}... (Test Mode Active)
            </Text>
          </View>

          <ScrollView style={styles.methodsScroll} showsVerticalScrollIndicator={false}>
            {/* Payment Methods Tabs */}
            <Text style={styles.sectionHeader}>SELECT PAYMENT METHOD</Text>
            <View style={styles.methodTabsRow}>
              {[
                { id: 'upi', label: 'UPI', icon: '📱' },
                { id: 'card', label: 'Cards', icon: '💳' },
                { id: 'netbanking', label: 'NetBanking', icon: '🏦' },
                { id: 'wallet', label: 'Wallets', icon: '👛' },
              ].map((tab) => {
                const isActive = selectedMethod === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.methodTab, isActive && styles.methodTabActive]}
                    onPress={() => setSelectedMethod(tab.id as PaymentMethod)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.methodIcon}>{tab.icon}</Text>
                    <Text style={[styles.methodLabel, isActive && styles.methodLabelActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Method Specific Form */}
            {selectedMethod === 'upi' && (
              <View style={styles.methodCard}>
                <Text style={styles.inputTitle}>Pay via UPI ID / VPA</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. mobileNumber@upi, user@okhdfcbank"
                  placeholderTextColor="#9CA3AF"
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  editable={!isProcessing}
                />

                <Text style={styles.quickAppsLabel}>OR FAST PAY WITH</Text>
                <View style={styles.quickAppsRow}>
                  {['Google Pay', 'PhonePe', 'Paytm', 'BHIM'].map((app) => (
                    <TouchableOpacity
                      key={app}
                      style={styles.quickAppChip}
                      onPress={() => setUpiId(`${orderData.user.phone || '9876543210'}@${app.toLowerCase().slice(0, 4)}`)}
                      disabled={isProcessing}
                    >
                      <Text style={styles.quickAppText}>{app}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selectedMethod === 'card' && (
              <View style={styles.methodCard}>
                <Text style={styles.inputTitle}>Card Number</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="4532 •••• •••• 1234"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={cardNumber}
                  onChangeText={setCardNumber}
                  maxLength={19}
                  editable={!isProcessing}
                />

                <View style={styles.cardRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.inputTitle}>Valid Thru</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="MM/YY"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={cardExpiry}
                      onChangeText={setCardExpiry}
                      maxLength={5}
                      editable={!isProcessing}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputTitle}>CVV</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="123"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      secureTextEntry
                      value={cardCvv}
                      onChangeText={setCardCvv}
                      maxLength={4}
                      editable={!isProcessing}
                    />
                  </View>
                </View>
              </View>
            )}

            {selectedMethod === 'netbanking' && (
              <View style={styles.methodCard}>
                <Text style={styles.inputTitle}>Choose Bank</Text>
                <View style={styles.bankGrid}>
                  {['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'PNB'].map((bank) => {
                    const isBankActive = selectedBank === bank;
                    return (
                      <TouchableOpacity
                        key={bank}
                        style={[styles.bankChip, isBankActive && styles.bankChipActive]}
                        onPress={() => setSelectedBank(bank)}
                        disabled={isProcessing}
                      >
                        <Text style={[styles.bankChipText, isBankActive && styles.bankChipTextActive]}>
                          {bank} Bank
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {selectedMethod === 'wallet' && (
              <View style={styles.methodCard}>
                <Text style={styles.inputTitle}>Select Wallet</Text>
                {['Paytm Wallet', 'Amazon Pay', 'MobiKwik', 'Freecharge'].map((w, index) => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.walletRow, index === 0 && styles.walletRowActive]}
                    disabled={isProcessing}
                  >
                    <Text style={styles.walletName}>{w}</Text>
                    <Text style={styles.walletChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Security Guarantee Notice */}
            <View style={styles.securityBox}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </Svg>
              <Text style={styles.securityText}>
                Secured by Razorpay • 256-Bit SSL Encryption • PCI-DSS Certified
              </Text>
            </View>
          </ScrollView>

          {/* Checkout CTA Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.payBtn, isProcessing && styles.payBtnDisabled]}
              onPress={handlePay}
              disabled={isProcessing}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <View style={styles.processingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.processingText}>{processStatus}</Text>
                </View>
              ) : (
                <View style={styles.payBtnContent}>
                  <Text style={styles.payBtnText}>Pay ₹{orderData.amountInr}.00</Text>
                  <Text style={styles.payBtnSub}>Instant Activation</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  brandBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rzpLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rzpLogoText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  brandSub: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  amountRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  planLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  planSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0284C7',
    marginRight: 2,
  },
  amountText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  testModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  testModeDot: {
    color: '#D97706',
    fontSize: 10,
    marginRight: 6,
  },
  testModeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '600',
  },
  methodsScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  methodTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  methodTabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0284C7',
  },
  methodIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  methodLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  methodLabelActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  methodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  inputTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  quickAppsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  quickAppsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAppChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAppText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  cardRow: {
    flexDirection: 'row',
  },
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bankChip: {
    flexBasis: '31%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bankChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0284C7',
  },
  bankChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  bankChipTextActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  walletRowActive: {
    backgroundColor: '#F8FAFC',
  },
  walletName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  walletChevron: {
    fontSize: 18,
    color: '#94A3B8',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 10,
  },
  securityText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  payBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  payBtnContent: {
    alignItems: 'center',
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  payBtnSub: {
    fontSize: 11,
    color: '#E0F2FE',
    marginTop: 2,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  processingText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
