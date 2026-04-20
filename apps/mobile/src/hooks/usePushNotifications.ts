import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { api } from '../lib/api';

// Configure foreground notification behaviour — show banner + play sound while app is open
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Increment unread notification count for foreground notifications
    const data = notification.request.content.data as NotificationPayload | undefined;
    if (data?.type) {
      useNotificationStore.getState().incrementUnread();
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

type NotificationPayload = {
  type: 'new_message' | 'new_inquiry' | 'new_review';
  conversationId?: string;
  listingId?: string;
  listingTitle?: string;
  revieweeId?: string;
};

/**
 * Navigates to the appropriate screen based on the notification payload.
 * Routes into the ProfileTab stack so that ConversationList sits behind ChatThread in the back stack.
 */
function handleNotificationNavigation(
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>>,
  data: NotificationPayload,
): void {
  const nav = navigationRef.current;
  if (!nav?.isReady()) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigate = nav.navigate as (...args: any[]) => void;

  if (data.type === 'new_message' && data.conversationId) {
    navigate('Main', {
      screen: 'ProfileTab',
      params: {
        screen: 'ChatThread',
        params: {
          conversationId: data.conversationId,
          listingTitle: data.listingTitle ?? 'Message',
        },
      },
    });
    return;
  }

  if (data.type === 'new_inquiry') {
    if (data.conversationId) {
      navigate('Main', {
        screen: 'ProfileTab',
        params: {
          screen: 'ChatThread',
          params: {
            conversationId: data.conversationId,
            listingTitle: data.listingTitle ?? 'Inquiry',
          },
        },
      });
    } else {
      navigate('Main', {
        screen: 'ProfileTab',
        params: { screen: 'ConversationList' },
      });
    }
    return;
  }

  if (data.type === 'new_review') {
    navigate('Main', {
      screen: 'ProfileTab',
      params: { screen: 'Profile' },
    });
  }
}

/**
 * Registers an Android notification channel required for Android 8+ (API 26+).
 * Safe to call on iOS — the SDK no-ops on non-Android platforms.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#A2C2E1',
  });
}

/**
 * Custom hook — encapsulates all push notification logic:
 *  - Creates Android notification channel
 *  - Requests permissions
 *  - Obtains and registers the Expo push token with the backend
 *  - Listens for token rotation and re-registers on change
 *  - Listens for notification taps and navigates to the relevant screen
 *
 * Call this hook from RootNavigator when `isAuthenticated` is true.
 * Pass a stable ref to the NavigationContainer so the hook can navigate imperatively.
 *
 * @note Push tokens can only be obtained on a physical device running a development build
 *       or a standalone build. Expo Go on a simulator returns an incompatible token format
 *       and FCM/APNs will reject it in production. QA must test on a real device.
 */
export function usePushNotifications(
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>>,
): void {
  const { pushToken, setPushToken } = useAuthStore();
  // Keep a mutable ref so listeners always access the latest stored token
  const pushTokenRef = useRef<string | null>(pushToken);
  pushTokenRef.current = pushToken;

  useEffect(() => {
    let tokenSubscription: Notifications.Subscription | null = null;
    let responseSubscription: Notifications.Subscription | null = null;
    let cancelled = false;

    async function setup(): Promise<void> {
      await ensureAndroidChannel();

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        // Permission denied — continue without notifications; do not block the app
        return;
      }

      let expoPushToken: string;
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        expoPushToken = tokenData.data;
      } catch {
        // Token fetch can fail in simulators or when no FCM/APNs config is present
        return;
      }

      if (cancelled) {
        return;
      }

      const platform: 'IOS' | 'ANDROID' = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

      // Register with backend only if the token is new or has changed
      if (expoPushToken !== pushTokenRef.current) {
        try {
          await api.registerPushToken(expoPushToken, platform);
          setPushToken(expoPushToken);
          pushTokenRef.current = expoPushToken;
        } catch {
          // Registration failure is non-fatal — the user can still use the app
        }
      }

      // Listen for token rotation (device token refresh from APNs / FCM)
      tokenSubscription = Notifications.addPushTokenListener(
        async (event: Notifications.DevicePushToken) => {
          const newToken = event.data;
          if (!newToken || newToken === pushTokenRef.current) {
            return;
          }
          try {
            await api.registerPushToken(newToken, platform);
            setPushToken(newToken);
            pushTokenRef.current = newToken;
          } catch {
            // Non-fatal
          }
        },
      );

      // Listen for notification taps (app in foreground, background, or killed)
      responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response: Notifications.NotificationResponse) => {
          const data = response.notification.request.content.data as NotificationPayload;
          if (data?.type) {
            handleNotificationNavigation(navigationRef, data);
          }
        },
      );

      // Handle the notification that launched the app (killed state tap)
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        const data = lastResponse.notification.request.content.data as NotificationPayload;
        if (data?.type) {
          // Defer until navigation is ready
          const waitForNav = setInterval(() => {
            if (navigationRef.current?.isReady()) {
              clearInterval(waitForNav);
              handleNotificationNavigation(navigationRef, data);
            }
          }, 100);
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      tokenSubscription?.remove();
      responseSubscription?.remove();
    };
    // Re-run only when auth state changes (hook is only mounted when authenticated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Deregisters the stored push token from the backend.
 * Call this during the logout flow before clearing auth state.
 */
export async function unregisterPushToken(): Promise<void> {
  const token = useAuthStore.getState().pushToken;
  if (!token) {
    return;
  }
  try {
    await api.deletePushToken(token);
  } catch {
    // Non-fatal — token will expire naturally on the backend
  } finally {
    useAuthStore.getState().setPushToken(null);
  }
}
