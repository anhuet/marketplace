import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Message } from '@marketplace/shared';

import { api } from '../../lib/api';
import { getSocket, joinConversationRoom } from '../../lib/socket';
import { useChatStore, PendingMessage } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useIsMounted } from '../../hooks/useIsMounted';
import { BrowseStackParamList, ProfileStackParamList } from '../../navigation/types';
import { colors, spacing, radius, typography } from '../../theme/tokens';
import ChatHeaderTitle from '../../navigation/ChatHeaderTitle';
import { Ionicons } from '@expo/vector-icons';

// ChatThread is reachable from BrowseStack, MessagesStack, and ProfileStack.
// We use a union route type so the component works in all navigators.
type BrowseChatRoute = NativeStackScreenProps<BrowseStackParamList, 'ChatThread'>['route'];
type ProfileChatRoute = NativeStackScreenProps<ProfileStackParamList, 'ChatThread'>['route'];
type ChatThreadRoute = BrowseChatRoute | ProfileChatRoute;

type AnyNavigation = NativeStackNavigationProp<BrowseStackParamList & ProfileStackParamList>;

// Raw conversation shape returned by GET /api/v1/conversations
interface RawConversation {
  id: string;
  listingId: string;
  buyerId: string;
  listing: {
    id: string;
    title: string;
    status: string;
    sellerId: string;
    images: Array<{ id: string; url: string; order: number }>;
    seller?: { id: string; displayName: string; avatarUrl: string | null };
  };
  buyer: { id: string; displayName: string; avatarUrl: string | null };
  messages: Array<{
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    readAt: string | null;
    createdAt: string;
  }>;
  unreadCount: number;
}

// Unique ID generator for optimistic messages
function generateTempId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Listing Banner ───────────────────────────────────────────────────────────

interface ListingBannerProps {
  listingTitle: string;
  listingImageUrl?: string | null;
}

function ListingBanner({ listingTitle, listingImageUrl }: ListingBannerProps): React.JSX.Element {
  return (
    <View style={bannerStyles.container} accessibilityLabel={`Item: ${listingTitle}`}>
      {listingImageUrl ? (
        <Image
          source={{ uri: listingImageUrl }}
          style={bannerStyles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          accessibilityLabel={`Cover photo for ${listingTitle}`}
        />
      ) : (
        <View style={[bannerStyles.image, bannerStyles.imagePlaceholder]}>
          <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
        </View>
      )}
      <Text style={bannerStyles.title} numberOfLines={2}>
        {listingTitle}
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
  },
  imagePlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
    flex: 1,
  },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: PendingMessage;
  isOwn: boolean;
  otherUserAvatarUrl?: string | null;
  otherUserName?: string;
}

function MessageBubble({
  message,
  isOwn,
  otherUserAvatarUrl,
  otherUserName,
}: MessageBubbleProps): React.JSX.Element {
  const AVATAR_SIZE = 28;
  const displayName = otherUserName ?? 'Other';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      style={[styles.bubbleWrapper, isOwn ? styles.bubbleWrapperOwn : styles.bubbleWrapperOther]}
      accessibilityRole="text"
      accessibilityLabel={`${isOwn ? 'You' : displayName}: ${message.content}`}
    >
      {/* Avatar beside incoming messages only */}
      {!isOwn && (
        <View style={[styles.bubbleAvatar, { width: AVATAR_SIZE, height: AVATAR_SIZE }]}>
          {otherUserAvatarUrl ? (
            <Image
              source={{ uri: otherUserAvatarUrl }}
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessibilityLabel={`${displayName}'s avatar`}
            />
          ) : (
            <View
              style={[
                styles.bubbleAvatarFallback,
                { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
              ]}
              accessibilityLabel={`${displayName}'s avatar`}
            >
              <Text style={styles.bubbleAvatarInitial}>{initial}</Text>
            </View>
          )}
        </View>
      )}
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
          <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeOther]}>
            {formatMessageTime(message.createdAt)}
          </Text>
          {message.failed && <Text style={styles.failedLabel}> Failed</Text>}
          {message.pending && !message.failed && (
            <Text style={[styles.bubbleTime, styles.pendingLabel]}> Sending…</Text>
          )}
        </View>
      </View>
      {/* Spacer on the left for outgoing messages to mirror avatar width */}
      {isOwn && <View style={{ width: AVATAR_SIZE + spacing.sm }} />}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatThreadScreen(): React.JSX.Element {
  const navigation = useNavigation<AnyNavigation>();
  const route = useRoute<ChatThreadRoute>();
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();

  // Route params needed for the in-screen header and listing banner.
  // When opening from a push notification these may be undefined — we fetch them below.
  const {
    listingTitle: routeListingTitle,
    listingImageUrl: routeListingImageUrl,
    otherUserName: routeOtherUserName,
    otherUserAvatarUrl: routeOtherUserAvatarUrl,
  } = route.params;

  // Display state — starts from route params, populated by fetch if needed
  const [listingTitle, setListingTitle] = useState<string>(routeListingTitle ?? '');
  const [listingImageUrl, setListingImageUrl] = useState<string | null | undefined>(
    routeListingImageUrl,
  );
  const [otherUserName, setOtherUserName] = useState<string | undefined>(routeOtherUserName);
  const [otherUserAvatarUrl, setOtherUserAvatarUrl] = useState<string | null | undefined>(
    routeOtherUserAvatarUrl,
  );

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

  // Mount guard — prevents setState after unmount (iOS 26 RCTUIManager teardown hardening).
  const isMounted = useIsMounted();

  // Mark this conversation as active so incoming socket messages don't increment unread
  useEffect(() => {
    setActiveConversation(conversationId);
    clearUnread(conversationId);
    return () => {
      setActiveConversation(null);
    };
  }, [conversationId, setActiveConversation, clearUnread]);

  // Fetch missing display params — occurs when ChatThread is opened from a push notification
  // which only provides conversationId + listingTitle. We call GET /conversations, find the
  // matching entry, and populate otherUser + listing image from the response.
  useEffect(() => {
    const needsFetch = !routeOtherUserName || routeListingImageUrl === undefined;
    if (!needsFetch) return;

    let cancelled = false;

    async function fetchDisplayParams() {
      try {
        const response = await api.getConversations();
        if (cancelled) return;
        const raw: RawConversation[] = (response.data as { conversations: RawConversation[] })
          .conversations;
        const match = raw.find((c) => c.id === conversationId);
        if (!match) return;
        if (!isMounted()) return;

        // Determine which side the current user is on
        const isBuyer = match.buyerId === currentUser?.id;
        const name = isBuyer
          ? (match.listing.seller?.displayName ?? 'Seller')
          : match.buyer.displayName;
        const avatarUrl = isBuyer
          ? (match.listing.seller?.avatarUrl ?? null)
          : match.buyer.avatarUrl;
        const coverUrl = match.listing.images.find((img) => img.order === 0)?.url ?? null;

        setListingTitle(match.listing.title);
        setListingImageUrl(coverUrl);
        setOtherUserName(name);
        setOtherUserAvatarUrl(avatarUrl);
      } catch {
        // Non-fatal — header remains partially populated from route params
      }
    }

    fetchDisplayParams();
    return () => {
      cancelled = true;
    };
  }, [conversationId, currentUser?.id, isMounted, routeOtherUserName, routeListingImageUrl]);

  // Fetch message history on mount
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const response = await api.getMessages(conversationId);
        if (cancelled) return;
        const fetched: Message[] = (response.data as { messages: Message[] }).messages;
        if (isMounted()) setMessages(conversationId, fetched);
      } finally {
        if (!cancelled && isMounted()) setLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [conversationId, isMounted, setMessages]);

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
      if (!isMounted()) return;
      const confirmed: Message = (response.data as { message: Message }).message;
      replacePendingMessage(conversationId, tempId, confirmed);
      updateConversationLastMessage(conversationId, confirmed);
    } catch {
      if (!isMounted()) return;
      markMessageFailed(conversationId, tempId);
    } finally {
      if (isMounted()) setSending(false);
    }
  }, [
    inputText,
    sending,
    conversationId,
    currentUser?.id,
    isMounted,
    addMessage,
    updateConversationLastMessage,
    replacePendingMessage,
    markMessageFailed,
  ]);

  // The FlatList is inverted, so the data array must be reversed (newest first)
  // to render newest messages at the bottom.
  const invertedMessages = [...messages].reverse();

  // Height of the custom header: status bar (insets.top) + inner row height (44) + paddingBottom (spacing.sm)
  // This is the actual rendered height of the chatHeader View above the KeyboardAvoidingView.
  const customHeaderHeight = insets.top + 44 + spacing.sm;

  // Stabilise renderItem and ListEmptyComponent with useCallback/useMemo so their references
  // don't change on every render. Inline function/object props on FlatList can cause the legacy
  // RCTUIManager renderer to hold stale view refs during teardown, triggering the iOS 26
  // conformsToProtocol: SIGABRT when navigating away.
  const renderItem = useCallback(
    ({ item }: { item: PendingMessage }) => (
      <MessageBubble
        message={item}
        isOwn={item.senderId === currentUser?.id}
        otherUserAvatarUrl={otherUserAvatarUrl}
        otherUserName={otherUserName}
      />
    ),
    [currentUser?.id, otherUserAvatarUrl, otherUserName],
  );

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No messages yet.</Text>
        <Text style={styles.emptySubtext}>Send the first message below.</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={styles.container}>
      {/* Custom in-screen header — replaces native header to avoid iOS 26 UINavigationBar SIGABRT */}
      <View style={[styles.chatHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.chatBackButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.chatHeaderTitle}>
          <ChatHeaderTitle
            otherUserName={otherUserName}
            otherUserAvatarUrl={otherUserAvatarUrl}
            listingTitle={listingTitle}
          />
        </View>
      </View>

      {/* Listing banner — item cover photo + title shown below the header */}
      <ListingBanner listingTitle={listingTitle} listingImageUrl={listingImageUrl} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? customHeaderHeight : 0}
      >
        {loadingHistory && messages.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primaryDark} />
          </View>
        ) : (
          <FlatList
            data={invertedMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={listEmptyComponent}
          />
        )}

        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
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
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
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

  // Custom in-screen header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chatBackButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderTitle: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  inputSafeArea: {
    backgroundColor: colors.surface,
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
    alignItems: 'flex-end',
  },
  bubbleWrapperOwn: {
    justifyContent: 'flex-end',
  },
  bubbleWrapperOther: {
    justifyContent: 'flex-start',
  },
  bubbleAvatar: {
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  bubbleAvatarFallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleAvatarInitial: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '70%',
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
