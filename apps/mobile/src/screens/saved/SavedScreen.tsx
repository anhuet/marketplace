import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../lib/api';
import { useSavedStore } from '../../store/savedStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { SavedStackScreenProps } from '../../navigation/types';
import type { ListingWithDetails } from '@marketplace/shared';

type Props = SavedStackScreenProps<'Saved'>;

interface SavedItem {
  id: string;
  listingId: string;
  createdAt: string;
  listing: ListingWithDetails;
}

interface SavedListingsResponse {
  savedListings: SavedItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function formatPrice(price: string): string {
  const n = parseFloat(price);
  if (isNaN(n)) return price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(n);
}

function SavedListingCard({
  item,
  onPress,
  onUnsave,
}: {
  item: SavedItem;
  onPress: () => void;
  onUnsave: () => void;
}): React.JSX.Element {
  const { listing } = item;
  const coverUrl = listing.images?.[0]?.url;

  return (
    <TouchableOpacity
      style={cardStyles.container}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={listing.title}
    >
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={cardStyles.image} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[cardStyles.image, cardStyles.imageFallback]}>
          <Text style={cardStyles.imageFallbackText}>No photo</Text>
        </View>
      )}
      <View style={cardStyles.info}>
        <Text style={cardStyles.title} numberOfLines={2}>
          {listing.title}
        </Text>
        <Text style={cardStyles.price}>{formatPrice(listing.price)}</Text>
        {listing.category && (
          <Text style={cardStyles.category}>{listing.category.name}</Text>
        )}
        {listing.status === 'SOLD' && (
          <View style={cardStyles.soldBadge}>
            <Text style={cardStyles.soldText}>SOLD</Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={cardStyles.heartButton}
        onPress={onUnsave}
        accessibilityRole="button"
        accessibilityLabel="Remove from saved"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="heart" size={22} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: 100,
    height: 100,
    backgroundColor: colors.border,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  info: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  price: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  category: {
    ...typography.caption,
    color: colors.tertiary,
  },
  soldBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  soldText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: 0.5,
  },
  heartButton: {
    padding: spacing.md,
    alignSelf: 'center',
  },
});

export default function SavedScreen({ navigation }: Props): React.JSX.Element {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);

  const toggleSave = useSavedStore((s) => s.toggleSave);

  const fetchSaved = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        const response = await api.getSavedListings(pageNum, 20);
        const data = response.data as SavedListingsResponse;
        setItems((prev) => (append ? [...prev, ...data.savedListings] : data.savedListings));
        setPage(pageNum);
        setHasMore(data.hasMore);
      } catch {
        // Silently fail — empty state handles no data
      }
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await fetchSaved(1, false);
    setLoading(false);
  }, [fetchSaved]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSaved(1, false);
    setRefreshing(false);
  }, [fetchSaved]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || fetchingMore) return;
    setFetchingMore(true);
    await fetchSaved(page + 1, true);
    setFetchingMore(false);
  }, [hasMore, fetchingMore, page, fetchSaved]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial]),
  );

  const handleUnsave = useCallback(
    (listingId: string) => {
      toggleSave(listingId);
      setItems((prev) => prev.filter((item) => item.listingId !== listingId));
    },
    [toggleSave],
  );

  const handlePress = useCallback(
    (listingId: string) => {
      navigation.navigate('ListingDetail', { listingId });
    },
    [navigation],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Saved</Text>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved</Text>
        {items.length > 0 && (
          <Text style={styles.headerCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
        )}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SavedListingCard
            item={item}
            onPress={() => handlePress(item.listingId)}
            onUnsave={() => handleUnsave(item.listingId)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={48} color={colors.border} />
            <Text style={styles.emptyTitle}>No saved items yet</Text>
            <Text style={styles.emptyBody}>
              Tap the heart icon on any listing to save it here for later.
            </Text>
          </View>
        }
        ListFooterComponent={
          fetchingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.primaryDark} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  headerCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
});
