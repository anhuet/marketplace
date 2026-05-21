import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';
import { api } from './api';

/**
 * Logout:
 * 1. Deregister push token from backend (best-effort)
 * 2. Clear Auth0 SSO cookie via /v2/logout in an in-app browser
 * 3. Clear local auth state (Zustand + AsyncStorage)
 *
 * We use `openBrowserAsync` (in-app Safari/Chrome custom tab) — NOT
 * `openAuthSessionAsync` — so iOS does not show the "Wants to Use X to Sign In"
 * permission dialog. The Auth0 logout endpoint clears the shared session
 * cookie used by ASWebAuthenticationSession, which is what causes the next
 * signup/login to skip straight to the "Authorize App" consent screen of the
 * previously logged-in user.
 *
 * `prompt: 'login'` on the authorize requests is kept as a defense-in-depth
 * fallback in case logout fails (network error, browser dismissed early).
 */
export async function logout(): Promise<void> {
  const pushToken = useAuthStore.getState().pushToken;
  if (pushToken) {
    try {
      await api.deletePushToken(pushToken);
    } catch {
      // Non-fatal
    }
  }

  const domain: string | undefined = Constants.expoConfig?.extra?.auth0Domain;
  const clientId: string | undefined = Constants.expoConfig?.extra?.auth0ClientId;
  if (domain && clientId) {
    const returnTo = 'marketplace://logout-callback';
    const logoutUrl = `https://${domain}/v2/logout?client_id=${encodeURIComponent(
      clientId,
    )}&returnTo=${encodeURIComponent(returnTo)}`;
    try {
      // Race: openBrowserAsync resolves when the user dismisses, but Auth0
      // redirects to the custom scheme which the in-app browser cannot handle.
      // We give Auth0 ~1.5s to clear the cookie, then force-dismiss the browser.
      const browserPromise = WebBrowser.openBrowserAsync(logoutUrl, {
        showInRecents: false,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await WebBrowser.dismissBrowser();
      await browserPromise.catch(() => undefined);
    } catch {
      // Non-fatal — `prompt: 'login'` on next auth still bypasses the cookie.
    }
  }

  useAuthStore.getState().setPushToken(null);
  useAuthStore.getState().clearAuth();
}
