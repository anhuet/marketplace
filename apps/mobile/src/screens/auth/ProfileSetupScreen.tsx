import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { api, usersApi } from '../../lib/api';
import PrimaryButton from '../../components/PrimaryButton';
import FormInput from '../../components/FormInput';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { AuthStackScreenProps } from '../../navigation/types';

type Props = AuthStackScreenProps<'ProfileSetup'>;

// ── Availability indicator states ─────────────────────────────────────────────

type AvailabilityState = 'idle' | 'checking' | 'available' | 'unavailable';

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileSetupScreen({ navigation: _navigation }: Props): React.JSX.Element {
  const { user, updateUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>('idle');
  const [availabilityMessage, setAvailabilityMessage] = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Avatar picker ────────────────────────────────────────────────────────

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 512, height: 512 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        setAvatarUri(manipulated.uri);
      } catch {
        setAvatarUri(result.assets[0].uri);
      }
    }
  };

  // ── Debounced display name availability check (300 ms) ───────────────────

  const checkAvailability = useCallback((name: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setAvailabilityState('idle');
      setAvailabilityMessage('');
      return;
    }

    setAvailabilityState('checking');

    debounceTimer.current = setTimeout(async () => {
      try {
        const { data } = await usersApi.checkDisplayName(trimmed);
        if (data.available) {
          setAvailabilityState('available');
          setAvailabilityMessage('');
        } else {
          setAvailabilityState('unavailable');
          switch (data.reason) {
            case 'taken':
              setAvailabilityMessage('That name is already taken.');
              break;
            case 'invalid_format':
              setAvailabilityMessage('Name contains invalid characters or is too short.');
              break;
            case 'reserved':
              setAvailabilityMessage('That name is reserved.');
              break;
            default:
              setAvailabilityMessage('Name is not available.');
          }
        }
      } catch {
        // On network error, don't block the user — reset to idle
        setAvailabilityState('idle');
        setAvailabilityMessage('');
      }
    }, 300);
  }, []);

  useEffect(() => {
    if (user?.displayName) {
      checkAvailability(user.displayName);
    }
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleDisplayNameChange = (text: string) => {
    setDisplayName(text);
    setError('');
    checkAvailability(text);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const isNextDisabled =
    !displayName.trim() ||
    availabilityState === 'unavailable' ||
    availabilityState === 'checking';

  const handleNext = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('Please enter a display name.');
      return;
    }
    if (availabilityState === 'checking') {
      setError('Please wait while we check that name.');
      return;
    }
    if (availabilityState === 'unavailable') {
      setError(availabilityMessage || 'That name is not available.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Upload avatar first if a local file was picked
      if (avatarUri && !avatarUri.startsWith('https')) {
        try {
          const { data: avatarData } = await usersApi.uploadAvatar(avatarUri);
          updateUser(avatarData.user);
        } catch {
          setError('Could not upload profile photo. Please try again.');
          setLoading(false);
          return;
        }
      }

      // 2. Save the chosen display name
      try {
        await api.updateMe({ displayName: trimmedName });
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          const code = err.response?.data?.error?.code ?? err.response?.data?.code;
          if (status === 409 || code === 'DISPLAY_NAME_TAKEN') {
            setError('That name was just taken. Try another.');
            setAvailabilityState('unavailable');
            setAvailabilityMessage('That name is already taken.');
            setLoading(false);
            return;
          }
        }
        setError('Failed to update profile. Please try again.');
        setLoading(false);
        return;
      }

      // 3. Refresh user from server — clears needsDisplayNameSetup flag.
      //    RootNavigator observes user.needsDisplayNameSetup and transitions
      //    automatically to MainTabs when the flag becomes false.
      const { data } = await api.getMe();
      updateUser(data.user);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create your identity</Text>

          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={pickAvatar}
            accessibilityRole="button"
            accessibilityLabel="Upload profile photo"
            accessibilityHint="Opens your photo library to choose a profile picture"
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color={colors.surface} />
            </View>
          </TouchableOpacity>

          {/* Display name field with availability indicator */}
          <View style={styles.inputWrapper}>
            <FormInput
              label="Username"
              placeholder="e.g. creative_soul"
              value={displayName}
              onChangeText={handleDisplayNameChange}
              autoCapitalize="none"
              autoCorrect={false}
              error={
                error ||
                (availabilityState === 'unavailable' ? availabilityMessage : undefined)
              }
              testID="display-name-input"
            />
            {/* Availability indicator sits to the right of the field */}
            <View
              style={styles.availabilityIndicator}
              accessibilityLiveRegion="polite"
              accessibilityRole="text"
              accessibilityLabel={
                availabilityState === 'checking'
                  ? 'Checking name availability'
                  : availabilityState === 'available'
                    ? 'Name is available'
                    : availabilityState === 'unavailable'
                      ? 'Name is not available'
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

          <Text style={styles.hint}>
            This will be your public name on the marketplace. You can change it later in settings.
          </Text>

          <PrimaryButton
            label="Next"
            onPress={handleNext}
            loading={loading}
            disabled={isNextDisabled || loading}
            style={styles.button}
            testID="profile-setup-next"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    marginBottom: spacing.xl,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  inputWrapper: {
    width: '100%',
    position: 'relative',
  },
  availabilityIndicator: {
    position: 'absolute',
    right: spacing.base,
    // Aligns with the text input vertically (label ~20pt + spacing.xs gap + input half ~28pt)
    top: 34,
  },
  availableText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  button: { width: '100%', marginBottom: spacing.base },
});
