import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, StatusBar, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '../../theme';

interface SplashScreenProps {
  onFinish?: () => void;
}

const ShieldFeatureIcon: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L4 5.5v5.5c0 5.25 3.4 10.15 8 11.35 4.6-1.2 8-6.1 8-11.35V5.5L12 2z"
      fill="#7C3AED"
    />
    <Path
      d="M9 11.5l2 2 4.5-4.5"
      stroke="#FFFFFF"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const FlashFeatureIcon: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M13 2L3.5 13.5h7L9.5 22 20.5 10.5h-7L13 2z"
      fill="#7C3AED"
    />
  </Svg>
);

const CloudBackupFeatureIcon: React.FC = () => (
  <Svg width={24} height={22} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
      fill="#7C3AED"
    />
    <Path
      d="M12 9.5a3.2 3.2 0 1 0 3.2 3.2"
      stroke="#FFFFFF"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M15.5 10l1.5 2.5-2.5.5"
      stroke="#FFFFFF"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const fadeValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.9)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [statusText, setStatusText] = useState('Initializing secure locker...');

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

    // 5-second progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      useNativeDriver: false,
    }).start();

    const progressListener = progressAnim.addListener(({ value }) => {
      const pct = Math.round(value * 100);
      let nextStatus = 'Initializing secure locker...';
      if (pct >= 95) {
        nextStatus = 'Ready! Starting FIC LOCKER...';
      } else if (pct >= 75) {
        nextStatus = 'Preparing your personal vault...';
      } else if (pct >= 50) {
        nextStatus = 'Setting up security protocols...';
      } else if (pct >= 25) {
        nextStatus = 'Loading encrypted documents...';
      }

      setStatusText(prev => (prev !== nextStatus ? nextStatus : prev));
    });

    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 5000);

    return () => {
      clearTimeout(timer);
      progressAnim.removeListener(progressListener);
    };
  }, []);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Mobile adaptive hero sizing: dynamically scales with screen width and aspect ratio
  const maxHeroWidth = Math.min(screenWidth * 0.74, 310);
  const maxHeroHeight = screenHeight * 0.30;
  const aspectRatio = 1024 / 890;

  let heroWidth = maxHeroWidth;
  let heroHeight = Math.round(heroWidth / aspectRatio);
  if (heroHeight > maxHeroHeight) {
    heroHeight = Math.round(maxHeroHeight);
    heroWidth = Math.round(heroHeight * aspectRatio);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EFFF" translucent />
      
      {/* Background Graphic */}
      <Image
        source={require('../../assets/images/splash_bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      <Animated.View style={[styles.content, { opacity: fadeValue, transform: [{ scale: scaleValue }] }]}>
        {/* Logo and Scanner Illustration (Mobile Adaptive) */}
        <View style={[styles.illustrationWrapper, { width: heroWidth, height: heroHeight }]}>
          <Image
            source={require('../../assets/images/scanner_hero.png')}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        {/* Brand Text */}
        <Text style={styles.brandTitle}>
          FIC <Text style={styles.brandTitleAccent}>LOCKER</Text>
        </Text>
        <Text style={styles.tagline}>Scan  •  Store  •  Access</Text>
        <View style={styles.divider} />
        <Text style={styles.subtext}>Your Documents, Always Safe</Text>

        {/* Feature Highlights Card (Secure Your Files • Fast Scanning • Secure Backup) */}
        <View style={[styles.featuresCard, { width: Math.min(screenWidth * 0.88, 340) }]}>
          <View style={styles.featureItem}>
            <ShieldFeatureIcon />
            <Text style={styles.featureLine1}>Secure</Text>
            <Text style={styles.featureLine2}>Your Files</Text>
          </View>

          <View style={styles.featureDivider} />

          <View style={styles.featureItem}>
            <FlashFeatureIcon />
            <Text style={styles.featureLine1}>Fast</Text>
            <Text style={styles.featureLine2}>Scanning</Text>
          </View>

          <View style={styles.featureDivider} />

          <View style={styles.featureItem}>
            <CloudBackupFeatureIcon />
            <Text style={styles.featureLine1}>Secure</Text>
            <Text style={styles.featureLine2}>Backup</Text>
          </View>
        </View>
      </Animated.View>

      {/* Modern Progress Bar & Live Status */}
      <View style={styles.footer}>
        <View style={styles.progressBarTrack}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <Text style={styles.loadingText}>{statusText}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    marginVertical: 10,
  },
  subtext: {
    fontSize: typography.fontSizes.sm,
    color: '#6F6196',
    fontWeight: typography.fontWeights.regular,
  },
  featuresCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  featureDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#EDE9FE',
  },
  featureLine1: {
    fontSize: 12,
    fontWeight: typography.fontWeights.bold,
    color: '#1C1948',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 15,
  },
  featureLine2: {
    fontSize: 11,
    fontWeight: typography.fontWeights.medium,
    color: '#4B3F72',
    marginTop: 1,
    textAlign: 'center',
    lineHeight: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 42,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  progressBarTrack: {
    width: '78%',
    maxWidth: 260,
    height: 6,
    backgroundColor: '#EBE5FC',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  loadingText: {
    fontSize: 12.5,
    color: '#6F6196',
    fontWeight: typography.fontWeights.medium,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

