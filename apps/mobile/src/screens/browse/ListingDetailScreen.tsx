import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import StarRating from '../../components/StarRating';
import PrimaryButton from '../../components/PrimaryButton';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { BrowseStackParamList } from '../../navigation/types';
import type { ListingWithDetails } from '@marketplace/shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = 300;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBlock({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: object;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.skeleton,
        { width: width as number, height },
        style,
      ]}
      accessibilityLabel="Loading"
    />
  );
}

function ListingDetailSkeleton(): React.JSX.Element {
  return (
    <ScrollView style={styles.container} scrollEnabled={false}>
      <SkeletonBlock width={SCREEN_WIDTH} height={CAROUSEL_HEIGHT} />
      <View style={styles.content}>
        <SkeletonBlock width="80%" height={28} style={{ marginBottom: spacing.sm }} />
        <SkeletonBlock width="40%" height={24} style={{ marginBottom: spacing.base }} />
        <SkeletonBlock width="100%" height={16} style={{ marginBottom: spacing.sm }} />
        <SkeletonBlock width="100%" height={16} style={{ marginBottom: spacing.sm }} />
        <SkeletonBlock width="70%" height={16} style={{ marginBottom: spacing.lg }} />
        <SkeletonBlock width="100%" height={56} style={{ borderRadius: radius.pill }} />
      </View>
    </ScrollView>
  );
}

// ─── Not Found ───────────────────────────────────────────────────────────────

function ListingNotFound({ onBack }: { onBack: () => void }): React.JSX.Element {
  return (
    <SafeAreaView style={[styles.container, styles.centred]}>
      <Text style={styles.notFoundTitle}>Listing not found</Text>
      <Text style={styles.notFoundBody}>
        This listing may have been removed or is no longer available.
      </Text>
      <PrimaryButton
        label="Go Back"
        onPress={onBack}
        style={{ marginTop: spacing.lg, alignSelf: 'center', minWidth: 160 }}
      />
    </SafeAreaView>
  );
}

// ─── Photo Carousel ──────────────────────────────────────────────────────────

interface CarouselProps {
  images: { id: string; url: string; order: number }[];
}

function PhotoCarousel({ images }: CarouselProps): React.JSX.Element {
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const sorted = [...images].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    return (
      <View style={styles.carouselPlaceholder} accessibilityLabel="No photos available">
        <Text style={styles.carouselPlaceholderText}>No photos</Text>
      </View>
    );
  }

  return (
    <View style={styles.carouselContainer} accessibilityLabel="Listing photos">
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url }}
            style={styles.carouselImage}
            resizeMode="cover"
            accessibilityLabel="Listing photo"
          />
        )}
        getItemLayout={(_data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
      {sorted.length > 1 && (
        <View style={styles.dotRow} accessibilityLabel={`Photo ${activeIndex + 1} of ${sorted.length}`}>
          {sorted.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Condition Label ─────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<BrowseStackParamList, 'ListingDetail'>;

export default function ListingDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { listingId } = route.params;
  const currentUser = useAuthStore((s) => s.user);

  const [listing, setListing] = useState<ListingWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [markSoldLoading, setMarkSoldLoading] = useState(false);

  const fetchListing = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);
      const response = await api.getListing(listingId);
      setListing((response.data as { listing: ListingWithDetails }).listing);
    } catch (err: unknown) {
      const status =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        setNotFound(true);
      } else {
        Alert.alert('Error', 'Failed to load listing. Please try again.');
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  }, [listingId, navigation]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  const isOwner = !!(currentUser && listing && currentUser.id === listing.sellerId);

  const handleMessageSeller = useCallback(async () => {
    if (!listing) return;
    try {
      setMessagingLoading(true);
      const response = await api.startConversation(listing.id);
      const conversation = (response.data as { conversation: { id: string } }).conversation;
      navigation.navigate('ChatThread', {
        conversationId: conversation.id,
        listingTitle: listing.title,
      });
    } catch {
      Alert.alert('Error', 'Could not start conversation. Please try again.');
    } finally {
      setMessagingLoading(false);
    }
  }, [listing, navigation]);

  const handleMarkSold = useCallback(() => {
    if (!listing) return;
    Alert.alert(
      'Mark as Sold',
      'Are you sure you want to mark this listing as sold? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Sold',
          style: 'destructive',
          onPress: async () => {
            try {
              setMarkSoldLoading(true);
              await api.markListingSold(listing.id);
              setListing((prev: ListingWithDetails | null) =>
                prev ? { ...prev, status: 'SOLD' as const } : prev,
              );
            } catch {
              Alert.alert('Error', 'Could not update listing status. Please try again.');
            } finally {
              setMarkSoldLoading(false);
            }
          },
        },
      ],
    );
  }, [listing]);

  const handleEditListing = useCallback(() => {
    // Navigate to PostListing (sell tab) — the SellStack's PostListing screen
    // accepts a listingId for pre-fill; navigate via parent tab navigation
    navigation.getParent()?.navigate('SellTab', {
      screen: 'PostListing',
      params: { listingId: listing?.id },
    });
  }, [listing, navigation]);

  if (loading) {
    return <ListingDetailSkeleton />;
  }

  if (notFound || !listing) {
    return <ListingNotFound onBack={() => navigation.goBack()} />;
  }

  const isSold = listing.status === 'SOLD';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Carousel */}
        <PhotoCarousel images={listing.images} />

        <View style={styles.content}>
          {/* Status badge for sold listings */}
          {isSold && (
            <View style={styles.soldBadge} accessibilityLabel="Sold">
              <Text style={styles.soldBadgeText}>SOLD</Text>
            </View>
          )}

          {/* Title & Price */}
          <Text style={styles.title} accessibilityRole="header">
            {listing.title}
          </Text>
          <Text
            style={styles.price}
            accessibilityLabel={`Price: ${formatPrice(listing.price)}`}
          >
            {formatPrice(listing.price)}
          </Text>

          {/* Meta row: condition, category, distance, date */}
          <View style={styles.metaRow}>
            <MetaChip label={CONDITION_LABELS[listing.condition] ?? listing.condition} />
            <MetaChip label={listing.category.name} />
          </View>

          <View style={styles.metaSecondRow}>
            {listing.distanceKm !== undefined && (
              <Text style={styles.metaText} accessibilityLabel={formatDistance(listing.distanceKm)}>
                {formatDistance(listing.distanceKm)}
              </Text>
            )}
            <Text style={styles.metaText} accessibilityLabel={`Posted ${formatDate(listing.createdAt)}`}>
              Posted {formatDate(listing.createdAt)}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.sectionHeading}>Description</Text>
          <Text style={styles.description} selectable>
            {listing.description}
          </Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Seller Info */}
          <Text style={styles.sectionHeading}>Seller</Text>
          <View style={styles.sellerRow} accessibilityLabel={`Seller: ${listing.seller.displayName}`}>
            {listing.seller.avatarUrl ? (
              <Image
                source={{ uri: listing.seller.avatarUrl }}
                style={styles.avatar}
                accessibilityLabel={`${listing.seller.displayName} avatar`}
              />
            ) : (
              <View
                style={[styles.avatar, styles.avatarFallback]}
                accessibilityLabel={`${listing.seller.displayName} avatar`}
              >
                <Text style={styles.avatarInitial}>
                  {listing.seller.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.sellerInfo}>
              <Text style={styles.sellerName}>{listing.seller.displayName}</Text>
              <StarRating
                rating={listing.seller.averageRating}
                count={listing.seller.ratingCount}
                size={14}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isOwner ? (
              <>
                <PrimaryButton
                  label="Edit Listing"
                  onPress={handleEditListing}
                  style={styles.actionButton}
                  accessibilityHint="Opens the listing editor pre-filled with current details"
                />
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    (isSold || markSoldLoading) && styles.secondaryButtonDisabled,
                  ]}
                  onPress={handleMarkSold}
                  disabled={isSold || markSoldLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as Sold"
                  accessibilityHint="Marks this listing as sold — this action cannot be undone"
                  accessibilityState={{ disabled: isSold || markSoldLoading }}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      (isSold || markSoldLoading) && styles.secondaryButtonTextDisabled,
                    ]}
                  >
                    {isSold ? 'Already Sold' : 'Mark as Sold'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <PrimaryButton
                label="Message Seller"
                onPress={handleMessageSeller}
                loading={messagingLoading}
                disabled={messagingLoading || isSold}
                style={styles.actionButton}
                accessibilityHint="Opens a chat thread with the seller"
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Meta chip ───────────────────────────────────────────────────────────────

function MetaChip({ label }: { label: string }): React.JSX.Element {
  return (
    <View style={styles.chip} accessibilityLabel={label}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centred: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Carousel
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: colors.border,
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
  },
  carouselPlaceholder: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselPlaceholderText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  dotRow: {
    position: 'absolute',
    bottom: spacing.sm,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: colors.surface,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  // Content
  content: {
    padding: spacing.base,
  },

  // Sold badge
  soldBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  soldBadgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Title & price
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.base,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  metaSecondRow: {
    flexDirection: 'row',
    gap: spacing.base,
    marginBottom: spacing.base,
    flexWrap: 'wrap',
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chip: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.base,
  },

  // Section
  sectionHeading: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 24,
  },

  // Seller
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarInitial: {
    ...typography.title,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  sellerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  sellerName: {
    ...typography.label,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  // Actions
  actions: {
    marginTop: spacing.base,
    gap: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  secondaryButtonDisabled: {
    borderColor: colors.border,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  secondaryButtonTextDisabled: {
    color: colors.textSecondary,
  },

  // Skeleton
  skeleton: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
  },

  // Not found
  notFoundTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  notFoundBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
