import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacityProps,
} from 'react-native';
import { colors, radius, typography, spacing } from '../theme/tokens';

interface PrimaryButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
}

export default function PrimaryButton({
  label,
  loading = false,
  disabled,
  style,
  ...props
}: PrimaryButtonProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.button, (disabled || loading) && styles.disabled, style]}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.surface} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.surface,
  },
});
