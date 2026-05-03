import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { colors, radius, spacing, typography } from '../theme/tokens';

/**
 * Banner displayed to users who have not yet redeemed an invite code.
 * Shows an inline invite code input with validation + redemption flow.
 */
export default function InactiveUserBanner(): React.JSX.Element | null {
  const { user, updateUser } = useAuthStore();
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user?.inviteCodeUsedId) return null;

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Please enter an invite code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const validateRes = await api.validateInviteCode(trimmed);
      if (!validateRes.data.valid) {
        setError(validateRes.data.reason ?? 'Invalid invite code.');
        return;
      }
      await api.redeemInvite(trimmed);
      const meRes = await api.getMe();
      updateUser(meRes.data.user);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message ?? 'Failed to redeem code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Activate your account"
        accessibilityHint="Tap to enter an invite code and unlock all features"
      >
        <Ionicons name="alert-circle" size={20} color={colors.surface} />
        <Text style={styles.headerText}>
          Your account is not yet activated. Enter an invite code to unlock all features.
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.surface}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <TextInput
            style={styles.input}
            placeholder="e.g. MKT-XXXX-XXXX"
            placeholderTextColor={colors.textSecondary}
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setError(null);
            }}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleRedeem}
            editable={!loading}
            accessibilityLabel="Invite code"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.redeemButton, loading && styles.redeemButtonDisabled]}
            onPress={handleRedeem}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Activate"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={styles.redeemButtonText}>Activate</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  headerText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    ...typography.body,
    color: colors.textPrimary,
  },
  error: {
    ...typography.caption,
    color: colors.primary,
  },
  redeemButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 4,
    alignItems: 'center',
  },
  redeemButtonDisabled: {
    opacity: 0.6,
  },
  redeemButtonText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '700',
  },
});
