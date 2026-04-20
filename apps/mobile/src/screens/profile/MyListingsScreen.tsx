import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { MyListingsStackScreenProps } from '../../navigation/types';
import type { ListingWithDetails } from '@marketplace/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = MyListingsStackScreenProps<'MyListings'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  SOLD: 'Sold',
  DELETED: 'Deleted',
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: colors.success,
  SOLD: colors.secondary,
  DELETED: colors.error,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyListingsScreen({ navigation }: Props): React.JSX.Element {
  const { user } = useAuthStore();

  const [listings, setListings] = useState<ListingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingSoldId, setMarkingSoldId] = useState<string | null>(null);

  // ── Load listings on focus ───────────────────────────────────────────────

  const loadListings = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSellerListings(user.id);
      setListings(res.data.listings ?? []);
    } catch {
      setError('Could not load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings]),
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleEdit = useCallback(
    (listing: ListingWithDetails) => {
      navigation.getParent()?.navigate('SellTab', {
        screen: 'PostListing',
        params: { listingId: listing.id },
      });
    },
    [navigation],
  );

  const handleMarkSold = useCallback(
    (listing: ListingWithDetails) => {
      Alert.alert(
        'Mark as Sold',
        `Mark "${listing.title}" as sold? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark as Sold',
            style: 'destructive',
            onPress: async () => {
              setMarkingSoldId(listing.id);
              try {
                await api.markListingSold(listing.id);
                setListings((prev) =>
                  prev.map((l) => (l.id === listing.id ? { ...l, status: 'SOLD' as const } : l)),
                );
              } catch {
                Alert.alert('Error', 'Could not update listing. Please try again.');
              } finally {
                setMarkingSoldId(null);
              }
            },
          },
        ],
      );
    },
    [],
  );

  const handleDelete = useCallback(
    (listing: ListingWithDetails) => {
      Alert.alert(
        'Delete Listing',
        `Delete "${listing.title}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(listing.id);
              try {
                await api.deleteListing(listing.id);
                setListings((prev) => prev.filter((l) => l.id !== listing.id));
              } catch {
                Alert.alert('Error', 'Could not delete listing. Please try again.');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [],
  );

  const handleViewDetail = useCallback(
    (listing: ListingWithDetails) => {
      navigation.navigate('ListingDetail', { listingId: listing.id });
    },
    [navigation],
  );

  // ── Render item ──────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: ListingWithDetails }) => {
      const coverImage = item.images?.[0]?.url;
      const isDeleting = deletingId === item.id;
      const isMarkingSold = markingSoldId === item.id;
      const isSold = item.status === 'SOLD';
      const isDeleted = item.status === 'DELETED';
      const busy = isDeleting || isMarkingSold;

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleViewDetail(item)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.title}`}
        >
          {/* Thumbnail */}
          {coverImage ? (
            <Image
              source={{ uri: coverImage }}
              style={styles.thumbnail}
              accessibilityLabel={`${item.title} photo`}
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailFallback]}>
              <Text style={styles.thumbnailFallbackText}>No photo</Text>
            </View>
          )}

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.price}>{formatPrice(item.price)}</Text>

            {/* Status badge */}
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: STATUS_COLOR[item.status] ?? colors.border },
              ]}
              accessibilityLabel={`Status: ${STATUS_LABEL[item.status] ?? item.status}`}
            >
              <Text style={styles.statusText}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <>
                {/* Edit — only for non-deleted */}
                {!isDeleted && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEdit(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${item.title}`}
                  >
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}

                {/* Mark sold — only for active */}
                {!isSold && !isDeleted && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSold]}
                    onPress={() => handleMarkSold(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${item.title} as sold`}
                  >
                    <Text style={[styles.actionButtonText, styles.actionButtonSoldText]}>
                      Sold
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Delete */}
                {!isDeleted && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonDelete]}
                    onPress={() => handleDelete(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${item.title}`}
                  >
                    <Text style={[styles.actionButtonText, styles.actionButtonDeleteText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [deletingId, markingSoldId, handleEdit, handleMarkSold, handleDelete, handleViewDetail],
  );

  // ── States ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadListings}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          listings.length === 0 ? styles.emptyContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        onRefresh={loadListings}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptyBody}>
              Tap the Sell tab to post your first listing.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const THUMBNAIL_SIZE = 80;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  listContent: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  emptyContent: {
    flexGrow: 1,
    padding: spacing.base,
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },

  // Thumbnail
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    flexShrink: 0,
  },
  thumbnailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailFallbackText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Info
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  price: {
    ...typography.body,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  // Action buttons (vertical stack on the right)
  actions: {
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    minWidth: 56,
    alignItems: 'center',
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  actionButtonSold: {
    borderColor: colors.secondary,
  },
  actionButtonSoldText: {
    color: colors.secondary,
  },
  actionButtonDelete: {
    borderColor: colors.error,
  },
  actionButtonDeleteText: {
    color: colors.error,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Error state
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  retryButton: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryButtonText: {
    ...typography.body,
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
