import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMounted } from '../../hooks/useIsMounted';
import {
  ActivityIndicator,
  Alert,
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
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';

import { api, usersApi } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { ProfileStackScreenProps } from '../../navigation/types';
import ScreenHeader from '../../components/ScreenHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = ProfileStackScreenProps<'EditProfile'>;

type AvailabilityState = 'idle' | 'checking' | 'available' | 'unavailable';

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const isMounted = useIsMounted();
  const { user, updateUser } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [bio, setBio] = useState(user?.bio ?? '');

  // Sync fields if user loads from store after mount (AsyncStorage rehydration)
  useEffect(() => {
    if (user) {
      setDisplayName((prev) => (prev === '' ? (user.displayName ?? '') : prev));
      setAvatarUri((prev) => (prev === null ? (user.avatarUrl ?? null) : prev));
      setBio((prev) => (prev === '' ? (user.bio ?? '') : prev));
    }
  }, [user]);

  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>('idle');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ── Avatar picker ────────────────────────────────────────────────────────

  const compressAvatar = async (uri: string): Promise<string> => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512, height: 512 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      return manipulated.uri;
    } catch {
      return uri;
    }
  };

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
      setAvatarUri(await compressAvatar(result.assets[0].uri));
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
      setAvatarUri(await compressAvatar(result.assets[0].uri));
    }
  };

  const showAvatarOptions = () => {
    Alert.alert('Change Profile Photo', 'Choose a source', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Photo Library', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Debounced display name availability check (300 ms) ───────────────────
  // Skip the check when the value equals the current user's name (case-insensitive).

  const checkAvailability = useCallback(
    (name: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      const trimmed = name.trim();

      // Don't check against the user's own existing name
      if (trimmed.toLowerCase() === (user?.displayName ?? '').toLowerCase()) {
        setAvailabilityState('idle');
        return;
      }

      if (trimmed.length === 0) {
        setAvailabilityState('idle');
        return;
      }

      setAvailabilityState('checking');

      debounceTimer.current = setTimeout(async () => {
        try {
          const { data } = await usersApi.checkDisplayName(trimmed);
          if (!isMounted()) return;
          if (data.available) {
            setAvailabilityState('available');
            setDisplayNameError(null);
          } else {
            setAvailabilityState('unavailable');
            switch (data.reason) {
              case 'taken':
                setDisplayNameError('That name is already taken.');
                break;
              case 'invalid_format':
                setDisplayNameError('Name contains invalid characters or is too short.');
                break;
              case 'reserved':
                setDisplayNameError('That name is reserved.');
                break;
              default:
                setDisplayNameError('Name is not available.');
            }
          }
        } catch {
          if (!isMounted()) return;
          setAvailabilityState('idle');
        }
      }, 300);
    },
    [user?.displayName],
  );

  const handleDisplayNameChange = (text: string) => {
    setDisplayName(text);
    if (displayNameError) setDisplayNameError(null);
    checkAvailability(text);
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
    if (availabilityState === 'unavailable') {
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
      const trimmedName = displayName.trim();
      const nameChanged =
        trimmedName.toLowerCase() !== (user?.displayName ?? '').toLowerCase();

      // If name changed, do a final pre-save availability check
      if (nameChanged) {
        try {
          const { data: checkData } = await usersApi.checkDisplayName(trimmedName);
          if (!isMounted()) return;
          if (!checkData.available) {
            setDisplayNameError(
              checkData.reason === 'taken'
                ? 'That name was just taken. Try another.'
                : 'Name is not available.',
            );
            setAvailabilityState('unavailable');
            setSaving(false);
            return;
          }
        } catch {
          // Non-fatal — proceed and let the PATCH handle any conflict
        }
      }

      // Upload avatar if a new local file URI was picked
      const isLocalUri = avatarUri !== null && !avatarUri.startsWith('https');
      if (isLocalUri && avatarUri) {
        try {
          const { data: avatarData } = await usersApi.uploadAvatar(avatarUri);
          if (!isMounted()) return;
          updateUser(avatarData.user);
        } catch {
          if (!isMounted()) return;
          setApiError('Could not upload profile photo. Please try again.');
          setSaving(false);
          return;
        }
      }

      // Build PATCH body — only include changed fields
      const patchBody: { displayName?: string; bio?: string } = {};
      if (nameChanged) patchBody.displayName = trimmedName;
      const bioTrimmed = bio.trim() || '';
      if (bioTrimmed !== (user?.bio ?? '')) patchBody.bio = bioTrimmed || undefined;

      if (Object.keys(patchBody).length > 0) {
        try {
          await api.updateMe(patchBody);
          if (!isMounted()) return;
        } catch (err: unknown) {
          if (!isMounted()) return;
          if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const code = err.response?.data?.error?.code ?? err.response?.data?.code;
            if (status === 409 || code === 'DISPLAY_NAME_TAKEN') {
              setDisplayNameError('That name was just taken. Try another.');
              setAvailabilityState('unavailable');
              setSaving(false);
              return;
            }
          }
          setApiError('Could not save changes. Please check your connection and try again.');
          setSaving(false);
          return;
        }
      }

      if (!isMounted()) return;
      // Optimistically update in-memory store with text changes
      updateUser({
        displayName: trimmedName,
        bio: bio.trim() || null,
      });

      navigation.goBack();
    } finally {
      if (isMounted()) setSaving(false);
    }
  }, [isMounted, displayName, avatarUri, bio, navigation, updateUser, user, availabilityState]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScreenHeader title="Edit Profile" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
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
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
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
                <Text style={styles.editAvatarIcon}>&#x270E;</Text>
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
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputFlex,
                  displayNameError ? styles.inputError : null,
                ]}
                value={displayName}
                onChangeText={handleDisplayNameChange}
                placeholder="Your public name"
                placeholderTextColor={colors.textSecondary}
                maxLength={60}
                returnKeyType="next"
                accessibilityLabel="Display name"
                accessibilityHint="Your publicly visible name, up to 60 characters"
                aria-labelledby="displayNameLabel"
              />
              {/* Availability indicator */}
              <View
                style={styles.availabilityBadge}
                accessibilityLiveRegion="polite"
                accessibilityRole="text"
                accessibilityLabel={
                  availabilityState === 'checking'
                    ? 'Checking name availability'
                    : availabilityState === 'available'
                      ? 'Name is available'
                      : undefined
                }
              >
                {availabilityState === 'checking' && (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                )}
                {availabilityState === 'available' && (
                  <Text style={styles.availableText}>Available</Text>
                )}
              </View>
            </View>
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
              placeholder="Tell others a bit about yourself..."
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
            disabled={saving || availabilityState === 'checking'}
            accessibilityRole="button"
            accessibilityLabel="Save profile changes"
            accessibilityHint="Saves your updated display name and profile photo"
            accessibilityState={{ disabled: saving || availabilityState === 'checking' }}
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputFlex: {
    flex: 1,
  },
  availabilityBadge: {
    minWidth: 64,
    alignItems: 'flex-start',
  },
  availableText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
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
