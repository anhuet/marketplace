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
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { api, apiClient, BASE_URL } from '../../lib/api';
import PrimaryButton from '../../components/PrimaryButton';
import FormInput from '../../components/FormInput';
import { colors, spacing, typography } from '../../theme/tokens';
import { AuthStackScreenProps } from '../../navigation/types';
import { User } from '@marketplace/shared';

WebBrowser.maybeCompleteAuthSession();

const domain: string = Constants.expoConfig?.extra?.auth0Domain ?? '';
const clientId: string = Constants.expoConfig?.extra?.auth0ClientId ?? '';
const audience: string = Constants.expoConfig?.extra?.auth0Audience ?? '';

const discovery = {
  authorizationEndpoint: `https://${domain}/authorize`,
  tokenEndpoint: `https://${domain}/oauth/token`,
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'marketplace',
  path: 'auth/callback',
});

type Props = AuthStackScreenProps<'Signup'>;

export default function SignupScreen({ navigation }: Props): React.JSX.Element {
  const [inviteCode, setInviteCode] = useState('');
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteChecking, setInviteChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      extraParams: { audience, screen_hint: 'signup' },
    },
    discovery,
  );

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
            if (!data.valid) {
              setError(`Invite invalid: ${data.reason ?? 'unknown reason'}`);
            } else {
              setError('');
            }
          } catch (e) {
            setInviteValid(false);
            if (axios.isAxiosError(e)) {
              setError(
                `Invite check failed:\nURL: ${e.config?.baseURL}${e.config?.url}\nStatus: ${e.response?.status ?? 'NO RESPONSE'}\nCode: ${e.code}\n${e.message}`,
              );
            } else {
              setError(`Invite check error: ${e instanceof Error ? e.message : String(e)}`);
            }
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
    if (!domain || !clientId) {
      setError(
        'Auth0 is not configured. Set auth0Domain and auth0ClientId in app.json extra.',
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Pre-check the invite code via the POST endpoint before starting Auth0 flow
      await api.validateInvite(inviteCode);

      // Open Auth0 Universal Login for account creation
      const result = await promptAsync();

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }

      if (result.type !== 'success') {
        throw new Error('Authentication was not successful. Please try again.');
      }

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request!.codeVerifier! },
        },
        discovery,
      );

      if (!tokenResponse.accessToken) {
        throw new Error('No access token received from Auth0.');
      }

      // Token is not yet in the store — pass it explicitly for this first call.
      // Auto-creates the DB user record on first call.
      const meResponse = await apiClient.get<{ user: User }>('/auth/me', {
        headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
      });

      // Redeem the invite code, linking it to the new user account
      await apiClient.post(
        '/auth/redeem-invite',
        { code: inviteCode },
        { headers: { Authorization: `Bearer ${tokenResponse.accessToken}` } },
      );

      setAuth(meResponse.data.user, tokenResponse.accessToken);

      // Proceed to profile setup before entering main app
      navigation.navigate('ProfileSetup', { inviteCode });
    } catch (err: unknown) {
      let debugMsg = '';
      if (axios.isAxiosError(err)) {
        debugMsg = [
          `URL: ${err.config?.baseURL}${err.config?.url}`,
          `Method: ${err.config?.method?.toUpperCase()}`,
          `Status: ${err.response?.status ?? 'NO RESPONSE'}`,
          `Code: ${err.code}`,
          `Message: ${err.message}`,
          err.response?.data ? `Body: ${JSON.stringify(err.response.data).substring(0, 200)}` : '',
        ].filter(Boolean).join('\n');
      } else {
        debugMsg = err instanceof Error ? err.message : String(err);
      }
      setError(debugMsg);
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
              disabled={!inviteValid || !request}
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

          <Text style={styles.debugInfo} selectable>
            {`--- DEBUG CONFIG ---\nAPI: ${BASE_URL}\nAuth0: ${domain || '(empty)'}\nClientID: ${clientId ? clientId.substring(0, 8) + '...' : '(empty)'}`}
          </Text>
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
  debugInfo: {
    marginTop: spacing.xl,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#999',
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    padding: spacing.sm,
  },
});
