export const colors = {
  primary: '#A2C2E1',
  primaryDark: '#2D4B6B',
  secondary: '#76777A',
  tertiary: '#6E7691',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  error: '#E53E3E',
  success: '#38A169',
  textPrimary: '#1A202C',
  textSecondary: '#718096',
  border: '#E2E8F0',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 28,
  full: 9999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 38 },
  heading: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
  title: { fontSize: 18, fontWeight: '600' as const, lineHeight: 25 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  label: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },
} as const;
