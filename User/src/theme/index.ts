export const colors = {
  primary: '#6C47FF',
  primaryDark: '#502DDE',
  primaryLight: '#8F71FF',
  primarySoft: '#F4F0FF',
  accent: '#9333EA',
  secondary: '#00C6FF',
  
  background: '#F8F9FE',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F4FA',
  cardBackground: '#FFFFFF',
  
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverted: '#FFFFFF',
  
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#E5E7EB',
  
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  pdfRed: '#EF4444',
  imageBlue: '#3B82F6',
  sheetGreen: '#10B981',
  docOrange: '#F97316',

  // Gradient stops
  gradientStart: '#6C47FF',
  gradientEnd: '#9333EA',
  headerGradientStart: '#8450FC',
  headerGradientEnd: '#5528DB',
};

export const typography = {
  fontSizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    display: 30,
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  glow: {
    shadowColor: '#6C47FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
};

