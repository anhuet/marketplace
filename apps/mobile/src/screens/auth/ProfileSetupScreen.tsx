import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import PrimaryButton from '../../components/PrimaryButton';
import FormInput from '../../components/FormInput';
import { colors, spacing, typography, radius } from '../../theme/tokens';
import { AuthStackScreenProps } from '../../navigation/types';

type Props = AuthStackScreenProps<'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation: _navigation }: Props): React.JSX.Element {
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateUser = useAuthStore((s) => s.updateUser);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleNext = async () => {
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Optimistically update display name in store
      updateUser({ displayName: displayName.trim() });

      // Fetch latest user data to confirm server state
      const { data } = await api.getMe();
      updateUser(data.user);
      // RootNavigator observes isAuthenticated and transitions to MainTabs automatically
    } catch {
      setError('Failed to update profile. You can do this later in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Auth store already has user set — RootNavigator will redirect to MainTabs
  };

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
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
            <View style={styles.cameraBadge} />
          </TouchableOpacity>

          <FormInput
            label="Username"
            placeholder="e.g. creative_soul"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="none"
            autoCorrect={false}
            error={error || undefined}
            testID="display-name-input"
          />

          <Text style={styles.hint}>
            This will be your public name on the marketplace. You can change it later in settings.
          </Text>

          <PrimaryButton
            label="Next"
            onPress={handleNext}
            loading={loading}
            disabled={!displayName.trim()}
            style={styles.button}
            testID="profile-setup-next"
          />

          <TouchableOpacity
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip profile setup for now"
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.base,
  },
  button: { width: '100%', marginBottom: spacing.base },
  skipButton: { paddingVertical: spacing.sm },
  skipText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
