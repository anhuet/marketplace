import { useAuthStore } from '../store/authStore';
import { api } from './api';

/**
 * Logout:
 * 1. Deregister push token from backend (best-effort)
 * 2. Clear local auth state (Zustand + AsyncStorage)
 *
 * We do NOT call Auth0's /v2/logout endpoint because:
 * - openAuthSessionAsync triggers the iOS "Wants to Use X to Sign In" dialog
 * - fetch() cannot clear the shared browser cookie used by ASWebAuthenticationSession
 *
 * Instead, both LoginScreen and SignupScreen pass `prompt: 'login'` in their
 * Auth0 authorize request, which forces Auth0 to always show the login form
 * regardless of any existing SSO cookie. This lets users switch accounts.
 */
export async function logout(): Promise<void> {
  // 1. Best-effort push token deregistration
  const pushToken = useAuthStore.getState().pushToken;
  if (pushToken) {
    try {
      await api.deletePushToken(pushToken);
    } catch {
      // Non-fatal
    }
  }

  // 2. Clear local state
  useAuthStore.getState().setPushToken(null);
  useAuthStore.getState().clearAuth();
}
