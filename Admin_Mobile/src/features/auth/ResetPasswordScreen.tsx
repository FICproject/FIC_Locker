import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { adminMobileApi } from '../../services/adminMobileApi';
import { getErrorMessage } from '../../services/apiClient';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ route, navigation }: Props) {
  const [email, setEmail] = useState(route.params?.email || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleReset = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await adminMobileApi.auth.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      setSuccess(res.message || 'Password updated.');
      setTimeout(() => navigation.navigate('Login'), 1200);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset Admin Password</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <TextInput style={styles.input} placeholder="Admin email" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="6-digit OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
        <TextInput
          style={styles.input}
          placeholder="New password (min 8 chars)"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <TouchableOpacity style={styles.btn} disabled={busy} onPress={handleReset}>
          <Text style={styles.btnText}>{busy ? 'Updating...' : 'Confirm Reset'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', padding: 20, justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  error: { color: '#B91C1C', fontSize: 12, marginBottom: 10 },
  success: { color: '#166534', fontSize: 12, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 12 },
  btn: { backgroundColor: '#4F46E5', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
