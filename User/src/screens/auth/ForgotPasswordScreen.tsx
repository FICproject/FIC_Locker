import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../theme';
import { authService } from '../../services/api/authService';

export const ForgotPasswordScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your account email.');
      return;
    }
    setIsLoading(true);
    try {
      await authService.forgotPassword({ email: email.trim() });
      Alert.alert('Reset Link Sent', 'Check your email inbox for password recovery instructions.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not send recovery email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter the email associated with your account</Text>

        <TextInput
          style={styles.input}
          placeholder="name@example.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Recovery Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F8FE',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: borderRadius.xl,
    ...shadows.card,
  },
  title: {
    fontSize: 22,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: '#FAFAFF',
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  buttonText: {
    color: '#fff',
    fontWeight: typography.fontWeights.bold,
  },
  backBtn: {
    marginTop: 18,
    alignItems: 'center',
  },
  backText: {
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
});

