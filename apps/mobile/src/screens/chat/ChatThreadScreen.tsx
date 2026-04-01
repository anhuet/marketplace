import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Message } from '@marketplace/shared';

import { api } from '../../lib/api';
import { getSocket, joinConversationRoom } from '../../lib/socket';
import { useChatStore, PendingMessage } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { BrowseStackParamList, ProfileStackParamList } from '../../navigation/types';
import { colors, spacing, radius, typography } from '../../theme/tokens';

// ChatThread is reachable from both BrowseStack and ProfileStack.
// We use a union route type so the component works in both navigators.
type BrowseChatRoute = NativeStackScreenProps<BrowseStackParamList, 'ChatThread'>['route'];
type ProfileChatRoute = NativeStackScreenProps<ProfileStackParamList, 'ChatThread'>['route'];
type ChatThreadRoute = BrowseChatRoute | ProfileChatRoute;

// Unique ID generator for optimistic messages
function generateTempId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface MessageBubbleProps {
  message: PendingMessage;
  isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps): React.JSX.Element {
  return (
    <View
      style={[styles.bubbleWrapper, isOwn ? styles.bubbleWrapperOwn : styles.bubbleWrapperOther]}
      accessibilityRole="text"
      accessibilityLabel={`${isOwn ? 'You' : 'Other'}: ${message.content}`}
    >
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          message.pending && styles.bubblePending,
          message.failed && styles.bubbleFailed,
        ]}
      >
        <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
          {message.content}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text
            style={[
              styles.bubbleTime,
              isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther,
            ]}
          >
            {formatMessageTime(message.createdAt)}
          </Text>
          {message.failed && (
            <Text style={styles.failedLabel}> Failed</Text>
          )}
          {message.pending && !message.failed && (
            <Text style={[styles.bubbleTime, styles.pendingLabel]}> Sending…</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ChatThreadScreen(): React.JSX.Element {
  const route = useRoute<ChatThreadRoute>();
  const { conversationId } = route.params;

  const currentUser = useAuthStore((s) => s.user);
  const {
    messagesByConversation,
    setMessages,
    addMessage,
    replacePendingMessage,
    markMessageFailed,
    clearUnread,
    updateConversationLastMessage,
    setActiveConversation,
  } = useChatStore();

  const messages: PendingMessage[] = messagesByConversation[conversationId] ?? [];

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Mark this conversation as active so incoming socket messages don't increment unread
  useEffect(() => {
    setActiveConversation(conversationId);
    clearUnread(conversationId);
    return () => {
      setActiveConversation(null);
    };
  }, [conversationId, setActiveConversation, clearUnread]);

  // Fetch message history on mount
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const response = await api.getMessages(conversationId);
        if (!cancelled) {
          const fetched: Message[] = (response.data as { messages: Message[] }).messages;
          setMessages(conversationId, fetched);
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [conversationId, setMessages]);

  // Join the Socket.io room and register event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    joinConversationRoom(conversationId);

    function handleNewMessage(incoming: Message) {
      // Only handle messages belonging to this conversation
      if (incoming.conversationId !== conversationId) return;

      // Skip messages sent by the current user — we've already added them optimistically
      if (incoming.senderId === currentUser?.id) return;

      addMessage(conversationId, incoming);
      updateConversationLastMessage(conversationId, incoming);
    }

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [conversationId, currentUser?.id, addMessage, updateConversationLastMessage]);

  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    if (!content || sending) return;

    const tempId = generateTempId();
    const now = new Date().toISOString();
    const optimisticMessage: PendingMessage = {
      id: tempId,
      conversationId,
      senderId: currentUser?.id ?? '',
      content,
      readAt: null,
      createdAt: now,
      pending: true,
    };

    setInputText('');
    addMessage(conversationId, optimisticMessage);
    updateConversationLastMessage(conversationId, optimisticMessage);
    setSending(true);

    try {
      const response = await api.sendMessage(conversationId, content);
      const confirmed: Message = (response.data as { message: Message }).message;
      replacePendingMessage(conversationId, tempId, confirmed);
      updateConversationLastMessage(conversationId, confirmed);
    } catch {
      markMessageFailed(conversationId, tempId);
    } finally {
      setSending(false);
    }
  }, [
    inputText,
    sending,
    conversationId,
    currentUser?.id,
    addMessage,
    updateConversationLastMessage,
    replacePendingMessage,
    markMessageFailed,
  ]);

  // The FlatList is inverted, so the data array must be reversed (newest first)
  // to render newest messages at the bottom.
  const invertedMessages = [...messages].reverse();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loadingHistory && messages.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primaryDark} />
          </View>
        ) : (
          <FlatList
            data={invertedMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwn={item.senderId === currentUser?.id}
              />
            )}
            inverted
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet.</Text>
                <Text style={styles.emptySubtext}>Send the first message below.</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message…"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            returnKeyType="default"
            blurOnSubmit={false}
            accessibilityLabel="Message input"
            accessibilityHint="Type your message here and tap Send"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !inputText.trim() || sending }}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  bubbleWrapper: {
    marginVertical: spacing.xs / 2,
    flexDirection: 'row',
  },
  bubbleWrapperOwn: {
    justifyContent: 'flex-end',
  },
  bubbleWrapperOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleOwn: {
    backgroundColor: colors.primaryDark,
    borderBottomRightRadius: radius.sm,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bubblePending: {
    opacity: 0.6,
  },
  bubbleFailed: {
    backgroundColor: colors.error,
    opacity: 0.8,
  },
  bubbleText: {
    ...typography.body,
  },
  bubbleTextOwn: {
    color: colors.surface,
  },
  bubbleTextOther: {
    color: colors.textPrimary,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  bubbleTime: {
    ...typography.caption,
  },
  bubbleTimeOwn: {
    color: 'rgba(255,255,255,0.65)',
  },
  bubbleTimeOther: {
    color: colors.textSecondary,
  },
  pendingLabel: {
    color: 'rgba(255,255,255,0.65)',
  },
  failedLabel: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyText: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    paddingBottom: spacing.sm,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    minHeight: 44,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
});
