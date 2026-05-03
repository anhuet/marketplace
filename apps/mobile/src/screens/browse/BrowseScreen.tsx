import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { ListingWithDetails, Category } from '@marketplace/shared';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useLocationStore } from '../../store/locationStore';
import { useNotificationStore } from '../../store/notificationStore';
import { Image } from 'expo-image';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import InactiveUserBanner from '../../components/InactiveUserBanner';
import type { BrowseStackScreenProps } from '../../navigation/types';

// -----------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------

type Props = BrowseStackScreenProps<'Browse'>;
type ViewMode = 'grid' | 'feed';

interface NearbyListingsResponse {
  listings: ListingWithDetails[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface CategoriesResponse {
  categories: Category[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
const DEFAULT_RADIUS_KM = 10;
const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

// Grid: 3 columns with gaps
const GRID_COLUMNS = 3;
const GRID_GAP = spacing.xs;
const GRID_PADDING = spacing.sm;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const GRID_ITEM_HEIGHT = GRID_ITEM_WIDTH * 1.25;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function formatPrice(price: string): string {
  const n = parseFloat(price);
  if (isNaN(n)) return price;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(0)}`;
}

function formatDistance(km: number | undefined): string {
  if (km === undefined || km === null) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

// -----------------------------------------------------------------
// Grid item
// -----------------------------------------------------------------

function GridItem({
  listing,
  onPress,
}: {
  listing: ListingWithDetails;
  onPress: (listing: ListingWithDetails) => void;
}) {
  const coverUrl =
    (listing as { coverImageUrl?: string }).coverImageUrl ??
    listing.images?.[0]?.url;

  return (
    <TouchableOpacity
      style={gridStyles.item}
      onPress={() => onPress(listing)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={listing.title}
    >
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={gridStyles.image} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[gridStyles.image, gridStyles.imageFallback]}>
          <Text style={gridStyles.imageFallbackText}>No photo</Text>
        </View>
      )}

      {/* Price badge — bottom left */}
      <View style={gridStyles.priceBadge}>
        <Text style={gridStyles.priceText}>{formatPrice(listing.price)}</Text>
      </View>

      {/* Distance badge — bottom right */}
      {listing.distanceKm !== undefined && (
        <View style={gridStyles.distanceBadge}>
          <Text style={gridStyles.distanceText}>{formatDistance(listing.distanceKm)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const gridStyles = StyleSheet.create({
  item: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.border,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  priceBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  priceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 14,
  },
});

// -----------------------------------------------------------------
// Feed item (full-width card)
// -----------------------------------------------------------------

function FeedItem({
  listing,
  onPress,
}: {
  listing: ListingWithDetails;
  onPress: (listing: ListingWithDetails) => void;
}) {
  const coverUrl =
    (listing as { coverImageUrl?: string }).coverImageUrl ??
    listing.images?.[0]?.url;

  return (
    <TouchableOpacity
      style={feedStyles.card}
      onPress={() => onPress(listing)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={listing.title}
    >
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={feedStyles.image} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[feedStyles.image, feedStyles.imageFallback]}>
          <Text style={feedStyles.imageFallbackText}>No photo</Text>
        </View>
      )}
      <View style={feedStyles.info}>
        <Text style={feedStyles.title} numberOfLines={2}>{listing.title}</Text>
        <View style={feedStyles.meta}>
          <Text style={feedStyles.price}>
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(parseFloat(listing.price))}
          </Text>
          {listing.distanceKm !== undefined && (
            <Text style={feedStyles.distance}>{formatDistance(listing.distanceKm)}</Text>
          )}
        </View>
        {listing.category && (
          <Text style={feedStyles.category}>{listing.category.name}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const feedStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    flexDirection: 'row',
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
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  price: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  distance: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  category: {
    ...typography.caption,
    color: colors.tertiary,
  },
});

// -----------------------------------------------------------------
// Nearby card (horizontal scroll)
// -----------------------------------------------------------------

const NEARBY_CARD_WIDTH = 140;
const NEARBY_CARD_HEIGHT = 100;

function NearbyCard({
  listing,
  onPress,
}: {
  listing: ListingWithDetails;
  onPress: (listing: ListingWithDetails) => void;
}) {
  const coverUrl =
    (listing as { coverImageUrl?: string }).coverImageUrl ??
    listing.images?.[0]?.url;

  return (
    <TouchableOpacity
      style={nearbyStyles.card}
      onPress={() => onPress(listing)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={listing.title}
    >
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={nearbyStyles.image} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[nearbyStyles.image, nearbyStyles.imageFallback]} />
      )}
      <View style={nearbyStyles.overlay}>
        <Text style={nearbyStyles.name} numberOfLines={2}>{listing.title}</Text>
        {listing.distanceKm !== undefined && (
          <Text style={nearbyStyles.distance}>{formatDistance(listing.distanceKm)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const nearbyStyles = StyleSheet.create({
  card: {
    width: NEARBY_CARD_WIDTH,
    height: NEARBY_CARD_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.border,
    marginRight: spacing.sm,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFallback: {
    backgroundColor: colors.primary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: spacing.sm,
    justifyContent: 'flex-end',
  },
  name: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 14,
  },
  distance: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});

// -----------------------------------------------------------------
// Main component
// -----------------------------------------------------------------

export default function BrowseScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const notificationUnread = useNotificationStore((s) => s.unreadCount);
  const clearNotifications = useNotificationStore((s) => s.clearUnread);

  // Location
  const { lastKnownLocation, setLastKnownLocation } = useLocationStore();
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | undefined>(undefined);
  const [pendingRadiusKm, setPendingRadiusKm] = useState(DEFAULT_RADIUS_KM);

  // Data
  const [listings, setListings] = useState<ListingWithDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------
  // Location
  // -----------------------------------------------------------------

  const requestLocation = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionDenied(true);
        return null;
      }
      setLocationPermissionDenied(false);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLastKnownLocation(coords);
      return coords;
    } catch {
      return null;
    }
  }, [setLastKnownLocation]);

  // -----------------------------------------------------------------
  // Fetch listings
  // -----------------------------------------------------------------

  const fetchListings = useCallback(async ({
    coords,
    pageNum,
    query,
    catId,
    km,
    append,
  }: {
    coords: { latitude: number; longitude: number };
    pageNum: number;
    query: string;
    catId: string | undefined;
    km: number;
    append: boolean;
  }) => {
    try {
      const response = await api.getNearbyListings({
        lat: coords.latitude,
        lng: coords.longitude,
        radiusKm: km,
        categoryId: catId,
        q: query || undefined,
        page: pageNum,
        limit: PAGE_LIMIT,
      });
      const data = response.data as NearbyListingsResponse;
      setListings((prev) => (append ? [...prev, ...data.listings] : data.listings));
      setHasMore(data.hasMore);
      setPage(pageNum);
      setFetchError(null);
    } catch {
      setFetchError('Could not load listings. Please try again.');
    }
  }, []);

  const loadInitial = useCallback(async (refresh = false) => {
    let coords = lastKnownLocation;
    if (!coords) {
      const acquired = await requestLocation();
      if (!acquired) return;
      coords = acquired;
    }
    if (refresh) {
      const fresh = await requestLocation();
      if (fresh) coords = fresh;
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    await fetchListings({ coords, pageNum: 1, query: appliedQuery, catId: selectedCategoryId, km: radiusKm, append: false });
    if (refresh) setIsRefreshing(false);
    else setIsLoading(false);
  }, [lastKnownLocation, requestLocation, fetchListings, appliedQuery, selectedCategoryId, radiusKm]);

  const loadNextPage = useCallback(async () => {
    if (!hasMore || isFetchingMore || isLoading || !lastKnownLocation) return;
    setIsFetchingMore(true);
    await fetchListings({ coords: lastKnownLocation, pageNum: page + 1, query: appliedQuery, catId: selectedCategoryId, km: radiusKm, append: true });
    setIsFetchingMore(false);
  }, [hasMore, isFetchingMore, isLoading, lastKnownLocation, fetchListings, page, appliedQuery, selectedCategoryId, radiusKm]);

  // -----------------------------------------------------------------
  // Categories
  // -----------------------------------------------------------------

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.getCategories();
      const data = response.data as CategoriesResponse;
      setCategories(data.categories);
    } catch {
      // Non-critical
    }
  }, []);

  // -----------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadInitial(false);
    }, [loadInitial]),
  );

  // Reload on filter change
  useEffect(() => {
    if (!lastKnownLocation) return;
    setIsLoading(true);
    fetchListings({ coords: lastKnownLocation, pageNum: 1, query: appliedQuery, catId: selectedCategoryId, km: radiusKm, append: false })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery, selectedCategoryId, radiusKm]);

  // Debounce search
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setAppliedQuery(text), SEARCH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  // -----------------------------------------------------------------
  // Filter sheet
  // -----------------------------------------------------------------

  const openFilterSheet = useCallback(() => {
    setPendingCategoryId(selectedCategoryId);
    setPendingRadiusKm(radiusKm);
    setFilterSheetVisible(true);
  }, [selectedCategoryId, radiusKm]);

  const applyFilters = useCallback(() => {
    setSelectedCategoryId(pendingCategoryId);
    setRadiusKm(pendingRadiusKm);
    setFilterSheetVisible(false);
  }, [pendingCategoryId, pendingRadiusKm]);

  const clearFilters = useCallback(() => {
    setPendingCategoryId(undefined);
    setPendingRadiusKm(DEFAULT_RADIUS_KM);
  }, []);

  // -----------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------

  const handleCardPress = useCallback((listing: ListingWithDetails) => {
    navigation.navigate('ListingDetail', { listingId: listing.id });
  }, [navigation]);

  // -----------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (selectedCategoryId) c++;
    if (radiusKm !== DEFAULT_RADIUS_KM) c++;
    return c;
  }, [selectedCategoryId, radiusKm]);

  // Top 6 listings for nearby horizontal scroll
  const nearbyListings = useMemo(() => listings.slice(0, 6), [listings]);

  // -----------------------------------------------------------------
  // Permission denied
  // -----------------------------------------------------------------

  if (locationPermissionDenied) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.permissionDenied}>
          <Text style={styles.permissionTitle}>Location access required</Text>
          <Text style={styles.permissionBody}>
            Marketplace needs your location to show nearby listings. Please enable location access in your device settings.
          </Text>
          <TouchableOpacity style={styles.settingsButton} onPress={() => Linking.openSettings()}>
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLocationPermissionDenied(false); loadInitial(false); }}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------

  const renderGridRow = ({ item }: { item: ListingWithDetails[] }) => (
    <View style={styles.gridRow}>
      {item.map((listing) => (
        <GridItem key={listing.id} listing={listing} onPress={handleCardPress} />
      ))}
      {/* Fill empty cells */}
      {item.length < GRID_COLUMNS &&
        Array.from({ length: GRID_COLUMNS - item.length }).map((_, i) => (
          <View key={`empty-${i}`} style={{ width: GRID_ITEM_WIDTH }} />
        ))}
    </View>
  );

  // Chunk listings into rows of 3
  const gridRows = useMemo(() => {
    const rows: ListingWithDetails[][] = [];
    for (let i = 0; i < listings.length; i += GRID_COLUMNS) {
      rows.push(listings.slice(i, i + GRID_COLUMNS));
    }
    return rows;
  }, [listings]);

  const ListHeaderComponent = (
    <View>
      {/* Error banner */}
      {fetchError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{fetchError}</Text>
          <TouchableOpacity onPress={() => loadInitial(false)}>
            <Text style={styles.retryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Grid / Feed toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'grid' && styles.toggleButtonActive]}
            onPress={() => setViewMode('grid')}
            accessibilityRole="button"
            accessibilityLabel="Grid view"
            accessibilityState={{ selected: viewMode === 'grid' }}
          >
            <Text style={[styles.toggleText, viewMode === 'grid' && styles.toggleTextActive]}>Grid</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'feed' && styles.toggleButtonActive]}
            onPress={() => setViewMode('feed')}
            accessibilityRole="button"
            accessibilityLabel="Feed view"
            accessibilityState={{ selected: viewMode === 'feed' }}
          >
            <Text style={[styles.toggleText, viewMode === 'feed' && styles.toggleTextActive]}>Feed</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.filterChip, activeFilterCount > 0 && styles.filterChipActive]}
          onPress={openFilterSheet}
          accessibilityRole="button"
          accessibilityLabel={activeFilterCount > 0 ? `${activeFilterCount} filters active` : 'Open filters'}
        >
          <Text style={[styles.filterChipText, activeFilterCount > 0 && styles.filterChipTextActive]}>
            ⊞ {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ListFooterComponent = (
    <View>
      {isFetchingMore ? (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : null}

      {/* Nearby Treasures section */}
      {nearbyListings.length > 0 && (
        <View style={styles.nearbySection}>
          <Text style={styles.nearbySectionTitle}>NEARBY TREASURES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nearbyScroll}
          >
            {nearbyListings.map((listing) => (
              <NearbyCard key={listing.id} listing={listing} onPress={handleCardPress} />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const ListEmptyComponent = isLoading ? null : (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No listings found</Text>
      <Text style={styles.emptyBody}>
        There are no active listings within {radiusKm} km of your location.
      </Text>
      {radiusKm < 100 && (
        <TouchableOpacity style={styles.emptyAction} onPress={() => setRadiusKm(Math.min(radiusKm * 2, 100))}>
          <Text style={styles.emptyActionText}>Increase radius to {Math.min(radiusKm * 2, 100)} km</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.headerIcon} accessibilityRole="button" accessibilityLabel="Menu">
            <Ionicons name="menu" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Atelier</Text>
          <TouchableOpacity
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel={`Notifications${notificationUnread > 0 ? `, ${notificationUnread} unread` : ''}`}
            onPress={clearNotifications}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            {notificationUnread > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {notificationUnread > 99 ? '99+' : notificationUnread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search curated treasures…"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search listings"
          />
        </View>
      </View>

      {/* ── Inactive user banner ── */}
      <InactiveUserBanner />

      {/* ── Content ── */}
      {isLoading && listings.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          data={gridRows}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderGridRow}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          ListEmptyComponent={ListEmptyComponent}
          refreshing={isRefreshing}
          onRefresh={() => loadInitial(true)}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedItem listing={item} onPress={handleCardPress} />}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          ListEmptyComponent={ListEmptyComponent}
          refreshing={isRefreshing}
          onRefresh={() => loadInitial(true)}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Filter modal ── */}
      <Modal visible={filterSheetVisible} transparent animationType="slide" onRequestClose={() => setFilterSheetVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterSheetVisible(false)} />
        <View style={[styles.filterSheet, { paddingBottom: insets.bottom + spacing.base }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filters</Text>

          <Text style={styles.filterSectionLabel}>Search radius</Text>
          <View style={styles.chipGroup}>
            {RADIUS_OPTIONS.map((km) => (
              <TouchableOpacity
                key={km}
                style={[styles.chip, pendingRadiusKm === km && styles.chipSelected]}
                onPress={() => setPendingRadiusKm(km)}
                accessibilityRole="radio"
                accessibilityState={{ checked: pendingRadiusKm === km }}
              >
                <Text style={[styles.chipText, pendingRadiusKm === km && styles.chipTextSelected]}>{km} km</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterSectionLabel}>Category</Text>
          <View style={styles.chipGroup}>
            <TouchableOpacity
              style={[styles.chip, !pendingCategoryId && styles.chipSelected]}
              onPress={() => setPendingCategoryId(undefined)}
              accessibilityRole="radio"
              accessibilityState={{ checked: !pendingCategoryId }}
            >
              <Text style={[styles.chipText, !pendingCategoryId && styles.chipTextSelected]}>All</Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, pendingCategoryId === cat.id && styles.chipSelected]}
                onPress={() => setPendingCategoryId(cat.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: pendingCategoryId === cat.id }}
              >
                <Text style={[styles.chipText, pendingCategoryId === cat.id && styles.chipTextSelected]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// -----------------------------------------------------------------
// Styles
// -----------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 0,
    right: -2,
    backgroundColor: colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.select({ ios: spacing.sm, android: spacing.xs }) ?? spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm - 2,
  },
  toggleButtonActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  filterChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primary,
  },
  filterChipText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },

  // Grid layout
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: spacing.xxl,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },

  // Feed layout
  feedContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },

  // Loading / error / empty
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F5',
    borderBottomWidth: 1,
    borderBottomColor: colors.error,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },
  retryLink: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  emptyAction: {
    marginTop: spacing.base,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  emptyActionText: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '600',
  },

  // Nearby section
  nearbySection: {
    marginTop: spacing.base,
    paddingBottom: spacing.base,
  },
  nearbySectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  nearbyScroll: {
    paddingHorizontal: spacing.base,
    paddingRight: spacing.base,
  },

  // Permission denied
  permissionDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  permissionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  permissionBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  settingsButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    minWidth: 200,
    alignItems: 'center',
  },
  settingsButtonText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '600',
  },
  retryButton: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 200,
    alignItems: 'center',
  },
  retryButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Filter modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  filterSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.base,
  },
  filterSectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.base,
  },
  clearButton: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  clearButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  applyButton: {
    flex: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  applyButtonText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '600',
  },
});
