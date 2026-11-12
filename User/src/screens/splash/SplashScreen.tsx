import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, StatusBar } from 'react-native';
import { colors, typography } from '../../theme';

interface SplashScreenProps {
  onFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Logo entrance animation
    Animated.parallel([
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Loader continuous spinning animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EFFF" translucent />
      
      {/* Background Graphic */}
      <Image
        source={require('../../assets/images/gradient_bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <Animated.View style={[styles.content, { opacity: fadeValue, transform: [{ scale: scaleValue }] }]}>
        {/* Logo and Scanner Illustration */}
        <View style={styles.illustrationWrapper}>
          <Image
            source={require('../../assets/images/scanner_hero.jpg')}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        {/* Brand Text */}
        <Text style={styles.brandTitle}>
          Docu<Text style={styles.brandTitleAccent}>Scan</Text>
        </Text>
        <Text style={styles.tagline}>Scan  •  Store  •  Access</Text>
        <View style={styles.divider} />
        <Text style={styles.subtext}>Your Documents, Always Safe</Text>
      </Animated.View>

      {/* Modern Circular Spinner and status label */}
      <View style={styles.footer}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
        <Text style={styles.loadingText}>Starting DocuScan...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  illustrationWrapper: {
    width: 280,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: typography.fontWeights.extraBold,
    color: '#1C1948',
    letterSpacing: -0.5,
  },
  brandTitleAccent: {
    color: colors.primary,
  },
  tagline: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: '#4B3F72',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  divider: {
    width: 140,
    height: 1.5,
    backgroundColor: '#D1C4E9',
    marginVertical: 14,
  },
  subtext: {
    fontSize: typography.fontSizes.sm,
    color: '#6F6196',
    fontWeight: typography.fontWeights.regular,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#E0D4FC',
    borderTopColor: colors.primary,
    marginBottom: 10,
  },
  loadingText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primaryDark,
    fontWeight: typography.fontWeights.medium,
  },
});

