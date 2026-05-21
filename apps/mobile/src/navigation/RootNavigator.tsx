import React, { useEffect } from 'react';
import { NavigationContainer, NavigationContainerRef, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Message } from '@marketplace/shared';
import { RootStackParamList } from './types';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useSavedStore } from '../store/savedStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { usePushNotifications } from '../hooks/usePushNotifications';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Inner component rendered only when the user is authenticated.
 * Isolates hook calls that must only run in the authenticated context.
 */
function AuthenticatedRoot({
  navigationRef,
}: {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}): React.JSX.Element {
  usePushNotifications(navigationRef);
  return <MainNavigator />;
}

export default function RootNavigator(): React.JSX.Element {
  const { isAuthenticated, token } = useAuthStore();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useEffect(() => {
    if (isAuthenticated && token && token !== 'dev-token') {
      connectSocket(token);
      useSavedStore.getState().fetchSavedIds();
    } else {
      disconnectSocket();
      useSavedStore.getState().clear();
    }
  }, [isAuthenticated, token]);

  // Global socket listener: increment unread count for messages arriving outside the active chat
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = getSocket();
    if (!socket) return;

    function handleGlobalNewMessage(message: Message) {
      const { activeConversationId, incrementUnread, updateConversationLastMessage } =
        useChatStore.getState();

      // Skip if the user is currently viewing this conversation
      if (message.conversationId === activeConversationId) return;

      // Skip messages sent by the current user (own messages echoed back)
      const currentUserId = useAuthStore.getState().user?.id;
      if (message.senderId === currentUserId) return;

      incrementUnread(message.conversationId);
      updateConversationLastMessage(message.conversationId, message);
    }

    socket.on('new_message', handleGlobalNewMessage);

    return () => {
      socket.off('new_message', handleGlobalNewMessage);
    };
  }, [isAuthenticated, token]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main">
            {() => <AuthenticatedRoot navigationRef={navigationRef} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
