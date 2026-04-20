import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ConversationWithDetails, ListingStatus } from '@marketplace/shared';

import { api } from '../../lib/api';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { MessagesStackParamList, ProfileStackParamList } from '../../navigation/types';
import { colors, spacing, radius, typography } from '../../theme/tokens';

// Raw shape returned by GET /api/v1/conversations — last message comes back in a `messages` array
interface RawConversation {
  id: string;
  listingId: string;
  buyerId: string;
  createdAt: string;
  updatedAt: string;
  listing: {
    id: string;
    title: string;
    status: string;
    sellerId: string;
    images: Array<{ id: string; url: string; order: number }>;
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

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ConversationRowProps {
  conversation: ConversationWithDetails;
  currentUserId: string;
  onPress: () => void;
}

function ConversationRow({
  conversation,
  currentUserId,
  onPress,
}: ConversationRowProps): React.JSX.Element {
  // When the current user is the buyer, the other party is the seller.
  // The seller's display name is not returned directly in this payload shape,
  // so we use "Seller" as a label in that case. When the current user is
  // the seller, the other party is the buyer and we have their name.
  const participantLabel =
    conversation.buyer.id === currentUserId ? 'Seller' : conversation.buyer.displayName;

  const coverImage = conversation.listing.images.find(
    (img: { id: string; url: string; order: number }) => img.order === 0,
  );
  const lastMessage = conversation.lastMessage;
  const hasUnread = (conversation.unreadCount ?? 0) > 0;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Conversation about ${conversation.listing.title} with ${participantLabel}`}
      accessibilityHint="Opens the message thread"
    >
      {coverImage ? (
        <Image
          source={{ uri: coverImage.url }}
          style={styles.thumbnail}
          accessibilityLabel={`Thumbnail for ${conversation.listing.title}`}
        />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={styles.thumbnailPlaceholderText}>?</Text>
        </View>
      )}

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.participantName} numberOfLines={1}>
            {participantLabel}
          </Text>
          {lastMessage && (
            <Text style={styles.timestamp}>{formatRelativeTime(lastMessage.createdAt)}</Text>
          )}
        </View>

        <Text style={styles.listingTitle} numberOfLines={1}>
          {conversation.listing.title}
        </Text>

        <View style={styles.rowFooter}>
          <Text
            style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {lastMessage ? lastMessage.content : 'No messages yet'}
          </Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ConversationListScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList & MessagesStackParamList>>();
  const currentUser = useAuthStore((s) => s.user);
  const { conversations, setConversations } = useChatStore();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getConversations();
      const raw: RawConversation[] = (response.data as { conversations: RawConversation[] })
        .conversations;

      // Normalise to ConversationWithDetails shape expected by the store
      const normalised: ConversationWithDetails[] = raw.map((c) => ({
        id: c.id,
        listingId: c.listingId,
        buyerId: c.buyerId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        listing: {
          ...c.listing,
          status: c.listing.status as ListingStatus,
          images: c.listing.images.map((img) => ({ ...img, listingId: c.listingId })),
        },
        buyer: { averageRating: 0, ratingCount: 0, ...c.buyer },
        lastMessage: c.messages.length > 0 ? c.messages[c.messages.length - 1] : null,
        unreadCount: c.unreadCount,
      }));

      setConversations(normalised);
    } catch {
      setError('Failed to load conversations. Pull down to retry.');
    } finally {
      setLoading(false);
    }
  }, [setConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handlePress = useCallback(
    (conversation: ConversationWithDetails) => {
      navigation.navigate('ChatThread', {
        conversationId: conversation.id,
        listingTitle: conversation.listing.title,
      });
    },
    [navigation],
  );

  if (loading && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </SafeAreaView>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchConversations}
          accessibilityRole="button"
          accessibilityLabel="Retry loading conversations"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            currentUserId={currentUser?.id ?? ''}
            onPress={() => handlePress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onRefresh={fetchConversations}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No conversations yet.</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation by tapping "Message Seller" on any listing.
            </Text>
          </View>
        }
        contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
      />
    </SafeAreaView>
  );
}

const THUMBNAIL_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radius.md,
    marginRight: spacing.md,
  },
  thumbnailPlaceholder: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    ...typography.title,
    color: colors.textSecondary,
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  participantName: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  timestamp: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  listingTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  lastMessageUnread: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: THUMBNAIL_SIZE + spacing.base + spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
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
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  retryButton: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  retryButtonText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
});
