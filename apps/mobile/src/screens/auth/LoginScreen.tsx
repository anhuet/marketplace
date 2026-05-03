import React, { useState } from 'react';
import {
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../lib/api';
import PrimaryButton from '../../components/PrimaryButton';
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

// DEV ONLY — mock user for UI preview without a running backend
const DEV_BYPASS = false;
const DEV_MOCK_USER: User = {
  id: 'dev-user-001',
  auth0Id: 'auth0|dev',
  email: 'dev@marketplace.app',
  displayName: 'Dev User',
  avatarUrl: null,
  bio: null,
  averageRating: 4.5,
  ratingCount: 12,
  inviteCodeUsedId: 'dev-invite-001',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

type Props = AuthStackScreenProps<'Login'>;

export default function LoginScreen({ navigation }: Props): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setAuth = useAuthStore((s) => s.setAuth);

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      extraParams: { audience, prompt: 'login' },
    },
    discovery,
  );

  // Fire when the button is pressed; result arrives via the `response` state
  // above, but we handle it inline via the resolved promise from promptAsync.
  const handleLogin = async () => {
    if (DEV_BYPASS) {
      setAuth(DEV_MOCK_USER, 'dev-token');
      return;
    }
    if (!domain || !clientId) {
      setError('Auth0 is not configured. Set auth0Domain and auth0ClientId in app.json extra.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await promptAsync();
      console.log('[Login] promptAsync result.type =', result.type);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return;
      }

      if (result.type !== 'success') {
        throw new Error(`Auth failed: result.type = ${result.type}`);
      }

      console.log('[Login] exchanging code...');
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request!.codeVerifier! },
        },
        discovery,
      );

      console.log('[Login] accessToken present =', !!tokenResponse.accessToken);

      if (!tokenResponse.accessToken) {
        throw new Error('No access token received from Auth0.');
      }

      console.log('[Login] calling /auth/me...');
      const meResponse = await apiClient.get<{ user: User }>('/auth/me', {
        headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
      });

      console.log('[Login] /auth/me status =', meResponse.status, 'user =', meResponse.data?.user?.email);

      if (!meResponse.data.user) {
        throw new Error(`/auth/me returned no user. Response: ${JSON.stringify(meResponse.data)}`);
      }

      setAuth(meResponse.data.user, tokenResponse.accessToken);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
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
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your Marketplace account.</Text>

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
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            disabled={!DEV_BYPASS && !request}
            style={styles.button}
            testID="login-button"
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('Signup')}
            accessibilityRole="button"
            accessibilityLabel="Don't have an account? Create one"
            style={styles.signupLink}
          >
            <Text style={styles.signupLinkText}>
              {"Don't have an account? "}
              <Text style={styles.signupLinkBold}>Create one</Text>
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
    justifyContent: 'center',
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
  },
  errorBanner: {
    ...typography.caption,
    color: colors.error,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.base,
  },
  button: { marginBottom: spacing.base },
  signupLink: { marginTop: spacing.base },
  signupLinkText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  signupLinkBold: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
