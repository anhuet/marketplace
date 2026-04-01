import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';

import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import StarRating from '../../components/StarRating';
import ListingCard from '../../components/ListingCard';
import type { ProfileStackScreenProps } from '../../navigation/types';
import type { ListingWithDetails, ReviewWithDetails } from '@marketplace/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = ProfileStackScreenProps<'Profile'>;

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

export default function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const { user, clearAuth } = useAuthStore();

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

  // Invite code
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Push notifications toggle
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushToggling, setPushToggling] = useState(false);
  const pushTokenRef = useRef<string | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  const loadListings = useCallback(async () => {
    if (!user?.id) return;
    setListingsLoading(true);
    setListingsError(null);
    try {
      const res = await api.getSellerListings(user.id);
      setListings(res.data.listings ?? []);
    } catch {
      setListingsError('Could not load listings. Pull down to retry.');
    } finally {
      setListingsLoading(false);
    }
  }, [user?.id]);

  const loadReviews = useCallback(
    async (page: number, append = false) => {
      if (!user?.id) return;
      if (page === 1) {
        setReviewsLoading(true);
        setReviewsError(null);
      } else {
        setReviewsLoadingMore(true);
      }
      try {
        const res = await api.getUserReviews(user.id, page);
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
    [user?.id],
  );

  const loadInviteCode = useCallback(async () => {
    setInviteLoading(true);
    try {
      const res = await api.getMyInviteCode();
      setInviteCode(res.data.code);
    } catch {
      // Non-critical — silently fail
    } finally {
      setInviteLoading(false);
    }
  }, []);

  const resolvePushToken = useCallback(async () => {
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      pushTokenRef.current = tokenData.data;
    } catch {
      // Push notifications not available in this environment
    }
  }, []);

  useEffect(() => {
    loadListings();
    loadReviews(1);
    loadInviteCode();
    resolvePushToken();
  }, [loadListings, loadReviews, loadInviteCode, resolvePushToken]);

  // ── Invite copy ──────────────────────────────────────────────────────────

  const handleCopyInvite = useCallback(async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  }, [inviteCode]);

  const handleShareInvite = useCallback(async () => {
    if (!inviteCode) return;
    await Share.share({
      message: `Join me on Marketplace! Use my invite code: ${inviteCode}`,
    });
  }, [inviteCode]);

  // ── Push toggle ──────────────────────────────────────────────────────────

  const handlePushToggle = useCallback(
    async (enabled: boolean) => {
      if (!pushTokenRef.current) {
        Alert.alert(
          'Push Notifications',
          'No push token found. Please make sure push notifications are enabled in your device settings.',
        );
        return;
      }
      setPushToggling(true);
      try {
        if (!enabled) {
          await api.deletePushToken(pushTokenRef.current);
          setPushEnabled(false);
        } else {
          const platform =
            (await import('react-native')).Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
          await api.registerPushToken(pushTokenRef.current, platform);
          setPushEnabled(true);
        }
      } catch {
        Alert.alert('Error', 'Could not update notification preferences. Please try again.');
      } finally {
        setPushToggling(false);
      }
    },
    [],
  );

  // ── Logout ───────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          // Deregister push token before clearing auth
          if (pushTokenRef.current) {
            api.deletePushToken(pushTokenRef.current).catch(() => {
              // Best-effort — proceed with logout regardless
            });
          }
          clearAuth();
        },
      },
    ]);
  }, [clearAuth]);

  // ── Listing press ────────────────────────────────────────────────────────

  const handleListingPress = useCallback(
    (listing: ListingWithDetails) => {
      navigation.navigate('ChatThread', {
        conversationId: listing.id,
        listingTitle: listing.title,
      });
    },
    [navigation],
  );

  // ── Reviews load more ────────────────────────────────────────────────────

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
      <View style={styles.listingCardWrapper}>
        <ListingCard listing={item} onPress={handleListingPress} />
      </View>
    ),
    [handleListingPress],
  );

  // ── Profile header (shared between sections) ─────────────────────────────

  const avatarUri = user?.avatarUrl;

  const renderHeader = () => (
    <View>
      {/* ── Profile header ── */}
      <View style={styles.profileHeader}>
        <TouchableOpacity
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          accessibilityHint="Opens the edit profile screen to update your avatar"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} accessibilityLabel="Your profile photo" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <View style={styles.editAvatarBadge} accessibilityElementsHidden importantForAccessibility="no">
            <Text style={styles.editAvatarIcon}>✎</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <Text style={styles.displayName} numberOfLines={2}>
            {user?.displayName ?? ''}
          </Text>
          {user && (user.averageRating > 0 || user.ratingCount > 0) ? (
            <StarRating rating={user.averageRating} count={user.ratingCount} size={16} />
          ) : (
            <Text style={styles.noRating}>No reviews yet</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          accessibilityHint="Opens the edit profile screen"
        >
          <Text style={styles.editProfileButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* ── Invite code ── */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Your Invite Code
        </Text>
        {inviteLoading ? (
          <ActivityIndicator size="small" color={colors.primaryDark} style={styles.inlineLoader} />
        ) : inviteCode ? (
          <View style={styles.inviteCodeRow}>
            <Text style={styles.inviteCodeText} selectable accessibilityLabel={`Invite code: ${inviteCode}`}>
              {inviteCode}
            </Text>
            <TouchableOpacity
              style={styles.inviteActionButton}
              onPress={handleCopyInvite}
              accessibilityRole="button"
              accessibilityLabel={copiedInvite ? 'Copied to clipboard' : 'Copy invite code'}
              accessibilityHint="Copies your invite code to the clipboard"
            >
              <Text style={styles.inviteActionButtonText}>{copiedInvite ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inviteActionButton, styles.inviteShareButton]}
              onPress={handleShareInvite}
              accessibilityRole="button"
              accessibilityLabel="Share invite code"
              accessibilityHint="Opens the share sheet to send your invite code"
            >
              <Text style={styles.inviteShareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.emptyText}>Invite code unavailable.</Text>
        )}
      </View>

      {/* ── Listings section header ── */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        My Listings
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
        <Text style={styles.emptyText}>You have no listings yet.</Text>
      ) : null}
    </View>
  );

  const renderFooter = () => (
    <View>
      {/* ── Reviews ── */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Reviews Received
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
          <Text style={styles.emptyText}>No reviews received yet.</Text>
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

      {/* ── Settings ── */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Settings
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingName}>Push Notifications</Text>
            <Text style={styles.settingDescription}>Receive alerts for new messages and offers</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={handlePushToggle}
            disabled={pushToggling}
            trackColor={{ true: colors.primaryDark, false: colors.border }}
            thumbColor={colors.surface}
            accessibilityRole="switch"
            accessibilityLabel="Push notifications toggle"
            accessibilityState={{ checked: pushEnabled, disabled: pushToggling }}
          />
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          accessibilityHint="Signs you out of your account"
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
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
        accessibilityLabel="Profile screen"
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
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  editAvatarIcon: {
    fontSize: 10,
    color: colors.surface,
    lineHeight: 13,
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
  editProfileButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
  },
  editProfileButtonText: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '600',
  },

  // Section
  sectionContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
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

  // Invite code
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  inviteCodeText: {
    flex: 1,
    ...typography.body,
    color: colors.primaryDark,
    fontWeight: '700',
    letterSpacing: 1,
  },
  inviteActionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  inviteActionButtonText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
  },
  inviteShareButton: {
    backgroundColor: colors.primary,
  },
  inviteShareButtonText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },

  // Listing card wrapper
  listingCardWrapper: {
    paddingHorizontal: 0,
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

  // Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  settingLabel: {
    flex: 1,
  },
  settingName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  settingDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: colors.error,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  logoutButtonText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '700',
  },

  // Misc
  inlineLoader: {
    marginVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
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
