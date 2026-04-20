import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api } from '../../lib/api';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import StarRating from '../../components/StarRating';
import ListingCard from '../../components/ListingCard';
import type { ProfileStackParamList, BrowseStackParamList } from '../../navigation/types';
import type { ListingWithDetails, ReviewWithDetails } from '@marketplace/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserProfileRouteParams = {
  userId: string;
  sellerName?: string;
  sellerAvatarUrl?: string | null;
};

type AnyNavigation = NativeStackNavigationProp<ProfileStackParamList & BrowseStackParamList>;

interface PublicUserProfile {
  displayName: string;
  avatarUrl: string | null;
  averageRating: number;
  ratingCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<AnyNavigation>();
  const route = useRoute<RouteProp<{ UserProfile: UserProfileRouteParams }, 'UserProfile'>>();
  const { userId, sellerName, sellerAvatarUrl } = route.params;

  // Profile data — pre-seeded from route params if available
  const [profile, setProfile] = useState<PublicUserProfile | null>(
    sellerName
      ? { displayName: sellerName, avatarUrl: sellerAvatarUrl ?? null, averageRating: 0, ratingCount: 0 }
      : null,
  );
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Listings
  const [listings, setListings] = useState<ListingWithDetails[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState<string | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const ratingRes = await api.getUserRating(userId);
      setProfile((prev) => ({
        displayName: prev?.displayName ?? sellerName ?? '',
        avatarUrl: prev?.avatarUrl ?? sellerAvatarUrl ?? null,
        averageRating: ratingRes.data.averageRating,
        ratingCount: ratingRes.data.ratingCount,
      }));
    } catch {
      setProfileError('Could not load profile.');
    } finally {
      setProfileLoading(false);
    }
  }, [userId, sellerName, sellerAvatarUrl]);

  const loadListings = useCallback(async () => {
    setListingsLoading(true);
    setListingsError(null);
    try {
      const res = await api.getSellerListings(userId);
      const fetchedListings: ListingWithDetails[] = res.data.listings ?? [];
      setListings(fetchedListings);
    } catch {
      setListingsError('Could not load listings.');
    } finally {
      setListingsLoading(false);
    }
  }, [userId]);

  const loadReviews = useCallback(
    async (page: number, append = false) => {
      if (page === 1) {
        setReviewsLoading(true);
        setReviewsError(null);
      } else {
        setReviewsLoadingMore(true);
      }
      try {
        const res = await api.getUserReviews(userId, page);
        const data = res.data;
        setReviews((prev) => (append ? [...prev, ...data.reviews] : data.reviews));
        setReviewsHasMore(data.hasMore ?? false);
        setReviewsPage(page);
      } catch {
        if (page === 1) setReviewsError('Could not load reviews.');
      } finally {
        setReviewsLoading(false);
        setReviewsLoadingMore(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    loadProfile();
    loadListings();
    loadReviews(1);
  }, [loadProfile, loadListings, loadReviews]);

  // Set screen title — use params immediately, update once profile loads
  useEffect(() => {
    const title = profile?.displayName || sellerName;
    if (title) {
      navigation.setOptions({ title });
    }
  }, [navigation, profile?.displayName, sellerName]);

  // ── Listing press ────────────────────────────────────────────────────────

  const handleListingPress = useCallback(
    (listing: ListingWithDetails) => {
      navigation.navigate('ListingDetail', { listingId: listing.id });
    },
    [navigation],
  );

  // ── Load more reviews ────────────────────────────────────────────────────

  const handleLoadMoreReviews = useCallback(() => {
    if (reviewsHasMore && !reviewsLoadingMore) {
      loadReviews(reviewsPage + 1, true);
    }
  }, [reviewsHasMore, reviewsLoadingMore, reviewsPage, loadReviews]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderReviewItem = useCallback(
    ({ item }: { item: ReviewWithDetails }) => (
      <View style={styles.reviewCard} accessibilityRole="none">
        <View style={styles.reviewHeader}>
          {item.reviewer.avatarUrl ? (
            <Image
              source={{ uri: item.reviewer.avatarUrl }}
              style={styles.reviewerAvatar}
              accessibilityLabel={`${item.reviewer.displayName}'s avatar`}
            />
          ) : (
            <View style={[styles.reviewerAvatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {item.reviewer.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.reviewerInfo}>
            <Text style={styles.reviewerName}>{item.reviewer.displayName}</Text>
            <Text style={styles.reviewDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <StarRating rating={item.rating} size={14} showNumeric={false} />
        </View>
        {item.comment ? (
          <Text style={styles.reviewComment}>{item.comment}</Text>
        ) : null}
      </View>
    ),
    [],
  );

  const renderListingItem = useCallback(
    ({ item }: { item: ListingWithDetails }) => (
      <ListingCard listing={item} onPress={handleListingPress} />
    ),
    [handleListingPress],
  );

  // ── Header ────────────────────────────────────────────────────────────────

  const renderHeader = () => {
    if (profileLoading && !profile) {
      return (
        <View style={styles.profileHeaderLoading} accessibilityLabel="Loading profile">
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      );
    }

    if (profileError && !profile) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{profileError}</Text>
          <TouchableOpacity
            onPress={loadProfile}
            accessibilityRole="button"
            accessibilityLabel="Retry loading profile"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View>
        {/* ── Profile header ── */}
        <View style={styles.profileHeader} accessibilityRole="none">
          {profile?.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={styles.avatar}
              accessibilityLabel={`${profile.displayName}'s profile photo`}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {profile?.displayName?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}

          <View style={styles.profileInfo}>
            <Text style={styles.displayName} numberOfLines={2}>
              {profile?.displayName ?? ''}
            </Text>
            {profile && (profile.averageRating > 0 || profile.ratingCount > 0) ? (
              <StarRating
                rating={profile.averageRating}
                count={profile.ratingCount}
                size={16}
              />
            ) : (
              <Text style={styles.noRating}>No reviews yet</Text>
            )}
          </View>
        </View>

        {/* ── Listings section header ── */}
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Listings
        </Text>
        {listingsLoading ? (
          <ActivityIndicator
            size="small"
            color={colors.primaryDark}
            style={styles.inlineLoader}
            accessibilityLabel="Loading listings"
          />
        ) : listingsError ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{listingsError}</Text>
            <TouchableOpacity
              onPress={loadListings}
              accessibilityRole="button"
              accessibilityLabel="Retry loading listings"
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : listings.length === 0 ? (
          <Text style={styles.emptyText}>No active listings.</Text>
        ) : null}
      </View>
    );
  };

  const renderFooter = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Reviews
      </Text>
      {reviewsLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.primaryDark}
          style={styles.inlineLoader}
          accessibilityLabel="Loading reviews"
        />
      ) : reviewsError ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{reviewsError}</Text>
          <TouchableOpacity
            onPress={() => loadReviews(1)}
            accessibilityRole="button"
            accessibilityLabel="Retry loading reviews"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : reviews.length === 0 ? (
        <Text style={styles.emptyText}>No reviews yet.</Text>
      ) : (
        <>
          {reviews.map((review) => renderReviewItem({ item: review }))}
          {reviewsHasMore && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMoreReviews}
              disabled={reviewsLoadingMore}
              accessibilityRole="button"
              accessibilityLabel="Load more reviews"
            >
              {reviewsLoadingMore ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={listingsLoading || listingsError || listings.length === 0 ? [] : listings}
        keyExtractor={(item) => item.id}
        renderItem={renderListingItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        numColumns={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        accessibilityLabel={`${profile?.displayName ?? 'User'}'s profile`}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 72;
const REVIEWER_AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Profile header
  profileHeaderLoading: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarFallbackText: {
    ...typography.heading,
    color: colors.primaryDark,
  },
  profileInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  displayName: {
    ...typography.title,
    color: colors.textPrimary,
  },
  noRating: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Section
  sectionContainer: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },

  // Reviews
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  reviewerAvatar: {
    width: REVIEWER_AVATAR_SIZE,
    height: REVIEWER_AVATAR_SIZE,
    borderRadius: REVIEWER_AVATAR_SIZE / 2,
    backgroundColor: colors.border,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarInitial: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  reviewDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  reviewComment: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },

  // Misc
  inlineLoader: {
    marginVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginLeft: spacing.base,
  },
  errorContainer: {
    padding: spacing.base,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  retryText: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  loadMoreText: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
