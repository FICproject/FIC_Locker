import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { colors, typography, borderRadius } from '../../theme';
import { securityService } from '../../services/securityService';

interface SecurityLockModalProps {
  visible: boolean;
  mode: 'unlock' | 'set_pin' | 'change_pin';
  onSuccess: () => void;
  onCancel?: () => void;
}

export const SecurityLockModal: React.FC<SecurityLockModalProps> = ({
  visible,
  mode,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [step, setStep] = useState<'enter_initial' | 'confirm'>('enter_initial');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>(true);

  useEffect(() => {
    if (visible) {
      setPin('');
      setConfirmPin('');
      setStep('enter_initial');
      setErrorMsg('');
      if (mode === 'unlock') {
        checkBiometricsOnLaunch();
      }
    }
  }, [visible, mode]);

  const checkBiometricsOnLaunch = async () => {
    const isBio = await securityService.isBiometricEnabled();
    if (isBio) {
      handleBiometricAuth();
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const res = await securityService.authenticateWithBiometrics();
      if (res.success) {
        onSuccess();
      }
    } catch {}
  };

  const handleKeyPress = (num: string) => {
    setErrorMsg('');
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);

      if (nextPin.length === 4) {
        handlePinComplete(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setErrorMsg('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePinComplete = async (completedPin: string) => {
    if (mode === 'unlock') {
      const valid = await securityService.verifyPin(completedPin);
      if (valid) {
        setPin('');
        onSuccess();
      } else {
        setErrorMsg('Incorrect PIN. Please try again.');
        setPin('');
      }
    } else if (mode === 'set_pin' || mode === 'change_pin') {
      if (step === 'enter_initial') {
        setConfirmPin(completedPin);
        setPin('');
        setStep('confirm');
      } else {
        // Confirm step
        if (completedPin === confirmPin) {
          await securityService.setPin(completedPin);
          Alert.alert('PIN Configured', 'Your security PIN has been set successfully!');
          setPin('');
          onSuccess();
        } else {
          setErrorMsg('PINs do not match. Please start over.');
          setPin('');
          setConfirmPin('');
          setStep('enter_initial');
        }
      }
    }
  };

  const getTitle = () => {
    if (mode === 'unlock') return 'Enter Security PIN';
    if (step === 'enter_initial') return 'Create 4-Digit PIN';
    return 'Confirm Security PIN';
  };

  const getSubTitle = () => {
    if (mode === 'unlock') return 'Unlock FIC Locker to view confidential documents';
    if (step === 'enter_initial') return 'Choose a secure 4-digit PIN for your app';
    return 'Re-enter your PIN to confirm';
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onCancel}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />

        {/* Top Cancel button if applicable */}
        {onCancel ? (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ height: 40 }} />
        )}

        {/* Lock Icon & Titles */}
        <View style={styles.header}>
          <View style={styles.lockBadge}>
            <Text style={styles.lockIcon}>🔐</Text>
          </View>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubTitle()}</Text>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        </View>

        {/* PIN Dot Indicators */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return <View key={idx} style={[styles.dot, isFilled && styles.dotFilled]} />;
          })}
        </View>

        {/* Keypad Grid (1-9, Bio, 0, Backspace) */}
        <View style={styles.keypad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
            <View key={rIdx} style={styles.keyRow}>
              {row.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={styles.keyButton}
                  onPress={() => handleKeyPress(num)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.keyNumber}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Bottom Row: Biometrics, 0, Delete */}
          <View style={styles.keyRow}>
            {mode === 'unlock' && biometricAvailable ? (
              <TouchableOpacity
                style={styles.keyButton}
                onPress={handleBiometricAuth}
                activeOpacity={0.7}
              >
                <Text style={styles.bioIcon}>👆</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.keyButton} />
            )}

            <TouchableOpacity
              style={styles.keyButton}
              onPress={() => handleKeyPress('0')}
              activeOpacity={0.7}
            >
              <Text style={styles.keyNumber}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keyButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={styles.backspaceIcon}>⌫</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 30,
  },
  cancelBtn: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  cancelText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E1B4B',
    borderWidth: 2,
    borderColor: '#4338CA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 10,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    transform: [{ scale: 1.15 }],
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    gap: 14,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1F1E33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyNumber: {
    fontSize: 26,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bioIcon: {
    fontSize: 26,
  },
  backspaceIcon: {
    fontSize: 24,
    color: '#9CA3AF',
  },
});
