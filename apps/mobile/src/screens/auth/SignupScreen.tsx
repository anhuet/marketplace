import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Auth0 from 'react-native-auth0';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import PrimaryButton from '../../components/PrimaryButton';
import FormInput from '../../components/FormInput';
import { colors, spacing, typography } from '../../theme/tokens';
import { AuthStackScreenProps } from '../../navigation/types';

const auth0 = new Auth0({
  domain: Constants.expoConfig?.extra?.auth0Domain ?? '',
  clientId: Constants.expoConfig?.extra?.auth0ClientId ?? '',
});

type Props = AuthStackScreenProps<'Signup'>;

export default function SignupScreen({ navigation }: Props): React.JSX.Element {
  const [inviteCode, setInviteCode] = useState('');
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteChecking, setInviteChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);

  // Debounced invite code validation — 500 ms after last keystroke
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const validateInvite = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (code: string) => {
        clearTimeout(timer);
        if (code.length < 4) {
          setInviteValid(null);
          return;
        }
        setInviteChecking(true);
        timer = setTimeout(async () => {
          try {
            const { data } = await api.validateInviteCode(code);
            setInviteValid(data.valid);
          } catch {
            setInviteValid(false);
          } finally {
            setInviteChecking(false);
          }
        }, 500);
      };
    })(),
    [],
  );

  const handleInviteCodeChange = (text: string) => {
    const upper = text.toUpperCase();
    setInviteCode(upper);
    validateInvite(upper);
  };

  const handleContinue = async () => {
    if (!inviteValid) {
      setError('Please enter a valid invite code to continue.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Pre-check the invite code via the POST endpoint before starting Auth0 flow
      await api.validateInvite(inviteCode);

      // Open Auth0 Universal Login for account creation
      const credentials = await auth0.webAuth.authorize({
        scope: 'openid profile email',
        audience: Constants.expoConfig?.extra?.auth0Audience ?? '',
        additionalParameters: { prompt: 'login' },
      });

      if (!credentials.accessToken) {
        throw new Error('No access token received from Auth0.');
      }

      // Auto-create DB user record on first call; retrieve profile
      const { data } = await api.getMe();

      // Redeem the invite code, linking it to the new user account
      await api.redeemInvite(inviteCode);

      setAuth(data.user, credentials.accessToken);

      // Proceed to profile setup before entering main app
      navigation.navigate('ProfileSetup', { inviteCode });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.title}>Join the Collective</Text>
          <Text style={styles.subtitle}>
            Enter your invite code to begin your journey into the marketplace.
          </Text>

          <View style={styles.form}>
            <FormInput
              label="Invite Code"
              placeholder="MKT-XXXX-XXXX"
              value={inviteCode}
              onChangeText={handleInviteCodeChange}
              autoCapitalize="characters"
              autoCorrect={false}
              error={
                inviteValid === false ? 'Invalid or already used invite code' : undefined
              }
              testID="invite-code-input"
            />

            {inviteChecking && (
              <ActivityIndicator
                size="small"
                color={colors.primaryDark}
                style={styles.checking}
                accessibilityLabel="Checking invite code"
              />
            )}

            {inviteValid === true && (
              <Text style={styles.validText} accessibilityRole="text">
                Valid invite code
              </Text>
            )}

            {error ? (
              <Text
                style={styles.errorBanner}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              label="Continue"
              onPress={handleContinue}
              loading={loading}
              disabled={!inviteValid}
              style={styles.button}
              testID="signup-continue-button"
            />
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="button"
            accessibilityLabel="Already have an account? Sign In"
            style={styles.signInLinkContainer}
          >
            <Text style={styles.signInLink}>
              Already have an account?{' '}
              <Text style={styles.signInLinkBold}>Sign In</Text>
            </Text>
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
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  form: { flex: 1 },
  checking: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  validText: {
    ...typography.caption,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  errorBanner: {
    ...typography.caption,
    color: colors.error,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.base,
  },
  button: { marginTop: spacing.base },
  signInLinkContainer: { marginTop: spacing.xl },
  signInLink: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  signInLinkBold: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
