import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await adminMobileApi.auth.forgotPassword(email.trim());
      setMessage(res.message || 'Verification code dispatched.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Forgot Admin Password</Text>
        <Text style={styles.subtitle}>Request a 6-digit verification code for the Platform Admin account.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Admin email"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity style={styles.btn} disabled={busy} onPress={handleSubmit}>
          <Text style={styles.btnText}>{busy ? 'Sending...' : 'Send Verification Code'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('ResetPassword', { email: email.trim() })}
        >
          <Text style={styles.secondaryText}>Already have a code? Reset Password</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', padding: 20, justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  error: { color: '#B91C1C', fontSize: 12, marginBottom: 10 },
  success: { color: '#166534', fontSize: 12, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 14,
  },
  btn: { backgroundColor: '#4F46E5', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondaryBtn: { marginTop: 14, alignItems: 'center' },
  secondaryText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },
});
