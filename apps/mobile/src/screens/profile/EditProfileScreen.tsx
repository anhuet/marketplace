import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { ProfileStackScreenProps } from '../../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = ProfileStackScreenProps<'EditProfile'>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const { user, updateUser } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [bio, setBio] = useState(user?.bio ?? '');

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  // ── Avatar picker ────────────────────────────────────────────────────────

  const requestMediaPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library in Settings.');
      return false;
    }
    return true;
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access in Settings.');
      return false;
    }
    return true;
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const pickFromCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const showAvatarOptions = () => {
    Alert.alert('Change Profile Photo', 'Choose a source', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Photo Library', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    if (displayName.trim().length === 0) {
      setDisplayNameError('Display name is required.');
      return false;
    }
    if (displayName.trim().length > 60) {
      setDisplayNameError('Display name must be 60 characters or less.');
      return false;
    }
    setDisplayNameError(null);
    return true;
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setSaving(true);
    setApiError(null);

    try {
      // TODO: backend endpoint needed — PATCH /api/v1/users/me does not yet exist on the backend.
      // When implemented, it should accept { displayName, avatarUrl, bio } and return { user }.
      await api.updateMe({
        displayName: displayName.trim(),
        // If avatar was changed to a local URI, upload it separately (requires a file upload endpoint).
        // For now, pass the avatarUri if it is already an HTTPS URL (unchanged), or skip update.
        avatarUrl: avatarUri?.startsWith('https') ? avatarUri : undefined,
        bio: bio.trim() || undefined,
      });

      // Optimistically update the in-memory store with the new values.
      updateUser({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        // Only update stored avatarUrl if it is a remote URL (local URIs cannot be persisted as-is).
        avatarUrl: avatarUri?.startsWith('https') ? avatarUri : user?.avatarUrl ?? null,
      });

      navigation.goBack();
    } catch {
      setApiError('Could not save changes. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }, [displayName, avatarUri, bio, navigation, updateUser, user?.avatarUrl]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Avatar ── */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={showAvatarOptions}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              accessibilityHint="Opens options to select a new profile photo from your camera or library"
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatar}
                  accessibilityLabel="Your profile photo"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {displayName.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View
                style={styles.editAvatarBadge}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                <Text style={styles.editAvatarIcon}>✎</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.changePhotoLabel}>Tap to change photo</Text>
          </View>

          {/* ── API error banner ── */}
          {apiError ? (
            <View
              style={styles.errorBanner}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              <Text style={styles.errorBannerText}>{apiError}</Text>
            </View>
          ) : null}

          {/* ── Display name ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} nativeID="displayNameLabel">
              Display Name
            </Text>
            <TextInput
              style={[styles.input, displayNameError ? styles.inputError : null]}
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                if (displayNameError) setDisplayNameError(null);
              }}
              placeholder="Your public name"
              placeholderTextColor={colors.textSecondary}
              maxLength={60}
              returnKeyType="next"
              accessibilityLabel="Display name"
              accessibilityHint="Your publicly visible name, up to 60 characters"
              aria-labelledby="displayNameLabel"
            />
            {displayNameError ? (
              <Text
                style={styles.fieldError}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
              >
                {displayNameError}
              </Text>
            ) : null}
          </View>

          {/* ── Bio ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel} nativeID="bioLabel">
              Bio{' '}
              <Text style={styles.optionalHint}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others a bit about yourself…"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              maxLength={300}
              textAlignVertical="top"
              accessibilityLabel="Bio"
              accessibilityHint="Optional short description about yourself, up to 300 characters"
              aria-labelledby="bioLabel"
            />
            <Text style={styles.charCount}>{bio.length}/300</Text>
          </View>

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
            accessibilityHint="Saves your updated display name and profile photo"
            accessibilityState={{ disabled: saving }}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.base,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarFallbackText: {
    ...typography.display,
    color: colors.primaryDark,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  editAvatarIcon: {
    fontSize: 13,
    color: colors.surface,
    lineHeight: 16,
  },
  changePhotoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  // Error banner
  errorBanner: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.base,
  },
  errorBannerText: {
    ...typography.body,
    color: colors.error,
  },

  // Fields
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  optionalHint: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '400',
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
  },
  inputError: {
    borderColor: colors.error,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  fieldError: {
    ...typography.caption,
    color: colors.error,
  },
  charCount: {
    ...typography.caption,
    color: colors.textSecondary,
    alignSelf: 'flex-end',
  },

  // Save button
  saveButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '700',
  },
});
