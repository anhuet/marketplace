import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface FormInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export default function FormInput({
  label,
  error,
  style,
  ...props
}: FormInputProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label} accessibilityRole="text">
          {label.toUpperCase()}
        </Text>
      ) : null}
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        {...props}
      />
      {error ? (
        <Text
          style={styles.error}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 56,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
