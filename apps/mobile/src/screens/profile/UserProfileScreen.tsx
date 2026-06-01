import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

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
  const insets = useSafeAreaInsets();

  // Mount guard — prevents setState after the screen has unmounted (avoids view-registry
  // corruption in RCTUIManager when async fetches resolve during or after navigation-away).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Profile data — pre-seeded from route params if available
  const [profile, setProfile] = useState<PublicUserProfile | null>(
    sellerName
      ? {
          displayName: sellerName,
          avatarUrl: sellerAvatarUrl ?? null,
          averageRating: 0,
          ratingCount: 0,
        }
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
    if (!isMountedRef.current) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const ratingRes = await api.getUserRating(userId);
      if (!isMountedRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { averageRating, ratingCount } = ratingRes.data as {
        averageRating: number;
        ratingCount: number;
      };
      setProfile((prev) => ({
        displayName: prev?.displayName ?? sellerName ?? '',
        avatarUrl: prev?.avatarUrl ?? sellerAvatarUrl ?? null,
        averageRating,
        ratingCount,
      }));
    } catch {
      if (isMountedRef.current) setProfileError('Could not load profile.');
    } finally {
      if (isMountedRef.current) setProfileLoading(false);
    }
  }, [userId, sellerName, sellerAvatarUrl]);

  const loadListings = useCallback(async () => {
    if (!isMountedRef.current) return;
    setListingsLoading(true);
    setListingsError(null);
    try {
      const res = await api.getSellerListings(userId);
      if (!isMountedRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { listings: fetchedListings = [] } = res.data as { listings: ListingWithDetails[] };
      setListings(fetchedListings);
    } catch {
      if (isMountedRef.current) setListingsError('Could not load listings.');
    } finally {
      if (isMountedRef.current) setListingsLoading(false);
    }
  }, [userId]);

  const loadReviews = useCallback(
    async (page: number, append = false) => {
      if (!isMountedRef.current) return;
      if (page === 1) {
        setReviewsLoading(true);
        setReviewsError(null);
      } else {
        setReviewsLoadingMore(true);
      }
      try {
        const res = await api.getUserReviews(userId, page);
        if (!isMountedRef.current) return;
        const data = res.data as { reviews: ReviewWithDetails[]; hasMore: boolean };
        setReviews((prev) => (append ? [...prev, ...data.reviews] : data.reviews));
        setReviewsHasMore(data.hasMore ?? false);
        setReviewsPage(page);
      } catch {
        if (isMountedRef.current && page === 1) setReviewsError('Could not load reviews.');
      } finally {
        if (isMountedRef.current) {
          setReviewsLoading(false);
          setReviewsLoadingMore(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadProfile();
    void loadListings();
    void loadReviews(1);
  }, [loadProfile, loadListings, loadReviews]);

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
      void loadReviews(reviewsPage + 1, true);
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
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
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
        {item.comment ? <Text style={styles.reviewComment}>{item.comment}</Text> : null}
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

  // useMemo gives FlatList a stable reference across renders so it does NOT unmount/remount
  // the header subtree on every state change — the primary teardown hazard behind the
  // RCTUIManager _purgeChildren / conformsToProtocol: SIGABRT on iOS 26 (build #25).
  const ListHeaderComponent = useMemo(() => {
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
            onPress={() => void loadProfile()}
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
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
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
              <StarRating rating={profile.averageRating} count={profile.ratingCount} size={16} />
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
              onPress={() => void loadListings()}
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
  }, [
    profile,
    profileLoading,
    profileError,
    listingsLoading,
    listingsError,
    listings.length,
    loadProfile,
    loadListings,
  ]);

  // useMemo for same reason — stable reference prevents FlatList footer remount on every re-render.
  const ListFooterComponent = useMemo(
    () => (
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
              onPress={() => void loadReviews(1)}
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
            {reviews.map((review) => (
              // key is required here — review.id is stable and unique, preventing incorrect
              // reconciliation when the list updates (missing key was a secondary teardown hazard).
              <React.Fragment key={review.id}>{renderReviewItem({ item: review })}</React.Fragment>
            ))}
            {reviewsHasMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => void handleLoadMoreReviews()}
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
    ),
    [
      reviews,
      reviewsLoading,
      reviewsError,
      reviewsHasMore,
      reviewsLoadingMore,
      loadReviews,
      handleLoadMoreReviews,
      renderReviewItem,
    ],
  );

  // ── Main render ─────────────────────────────────────────────────────────

  const displayTitle = profile?.displayName || sellerName;

  return (
    <View style={styles.safeArea}>
      {/* Custom header — replaces native header to avoid iOS 26 UINavigationBar SIGABRT */}
      <View style={[styles.customHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        {displayTitle ? (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayTitle}
          </Text>
        ) : null}
        {/* Spacer to balance back button and keep title centred */}
        <View style={styles.backButton} />
      </View>
      <FlatList
        data={listingsLoading || listingsError || listings.length === 0 ? [] : listings}
        keyExtractor={(item) => item.id}
        renderItem={renderListingItem}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        numColumns={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom }]}
        accessibilityLabel={`${profile?.displayName ?? 'User'}'s profile`}
      />
    </View>
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

  // Custom in-screen header (replaces native header)
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
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
