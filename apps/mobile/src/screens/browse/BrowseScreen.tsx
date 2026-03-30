import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ListingWithDetails, Category } from '@marketplace/shared';
import { api } from '../../lib/api';
import ListingCard from '../../components/ListingCard';
import { useLocationStore } from '../../store/locationStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { BrowseStackScreenProps } from '../../navigation/types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

type Props = BrowseStackScreenProps<'Browse'>;

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

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_RADIUS_KM = 10;
const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export default function BrowseScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  // Location
  const { lastKnownLocation, setLastKnownLocation } = useLocationStore();
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

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

  // Debounce ref for search input
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------
  // Location
  // -----------------------------------------------------------------

  const requestLocation = useCallback(async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermissionDenied(true);
        return null;
      }
      setLocationPermissionDenied(false);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setLastKnownLocation(coords);
      return coords;
    } catch {
      return null;
    }
  }, [setLastKnownLocation]);

  // -----------------------------------------------------------------
  // Fetch listings
  // -----------------------------------------------------------------

  const fetchListings = useCallback(
    async ({
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
    },
    [],
  );

  const loadInitial = useCallback(
    async (refresh = false) => {
      let coords = lastKnownLocation;
      if (!coords) {
        const acquired = await requestLocation();
        if (!acquired) return;
        coords = acquired;
      }
      if (refresh) {
        // Re-acquire fresh GPS on pull-to-refresh
        const fresh = await requestLocation();
        if (fresh) coords = fresh;
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      await fetchListings({
        coords,
        pageNum: 1,
        query: appliedQuery,
        catId: selectedCategoryId,
        km: radiusKm,
        append: false,
      });
      if (refresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    },
    [
      lastKnownLocation,
      requestLocation,
      fetchListings,
      appliedQuery,
      selectedCategoryId,
      radiusKm,
    ],
  );

  const loadNextPage = useCallback(async () => {
    if (!hasMore || isFetchingMore || isLoading || !lastKnownLocation) return;
    setIsFetchingMore(true);
    await fetchListings({
      coords: lastKnownLocation,
      pageNum: page + 1,
      query: appliedQuery,
      catId: selectedCategoryId,
      km: radiusKm,
      append: true,
    });
    setIsFetchingMore(false);
  }, [
    hasMore,
    isFetchingMore,
    isLoading,
    lastKnownLocation,
    fetchListings,
    page,
    appliedQuery,
    selectedCategoryId,
    radiusKm,
  ]);

  // -----------------------------------------------------------------
  // Categories
  // -----------------------------------------------------------------

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.getCategories();
      const data = response.data as CategoriesResponse;
      setCategories(data.categories);
    } catch {
      // Non-critical — filter sheet will just show no categories
    }
  }, []);

  // -----------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------

  useEffect(() => {
    fetchCategories();
    loadInitial(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (!lastKnownLocation) return;
    setIsLoading(true);
    fetchListings({
      coords: lastKnownLocation,
      pageNum: 1,
      query: appliedQuery,
      catId: selectedCategoryId,
      km: radiusKm,
      append: false,
    }).finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery, selectedCategoryId, radiusKm]);

  // -----------------------------------------------------------------
  // Search input with debounce
  // -----------------------------------------------------------------

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setAppliedQuery(text);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
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

  const handleCardPress = useCallback(
    (listing: ListingWithDetails) => {
      navigation.navigate('ListingDetail', { listingId: listing.id });
    },
    [navigation],
  );

  // -----------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------

  const keyExtractor = useCallback((item: ListingWithDetails) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: ListingWithDetails }) => (
      <ListingCard listing={item} onPress={handleCardPress} />
    ),
    [handleCardPress],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategoryId) count += 1;
    if (radiusKm !== DEFAULT_RADIUS_KM) count += 1;
    return count;
  }, [selectedCategoryId, radiusKm]);

  const ListHeaderComponent = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Text style={styles.nearbyLabel}>Nearby listings</Text>
      </View>
    ),
    [],
  );

  const ListFooterComponent = useMemo(
    () =>
      isFetchingMore ? (
        <View style={styles.footer}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      ) : null,
    [isFetchingMore],
  );

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No listings found</Text>
        <Text style={styles.emptyBody}>
          There are no active listings within {radiusKm} km of your location.
        </Text>
        {radiusKm < 100 ? (
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={() => setRadiusKm(Math.min(radiusKm * 2, 100))}
            accessibilityRole="button"
            accessibilityLabel="Increase search radius"
            accessibilityHint={`Doubles the radius to ${Math.min(radiusKm * 2, 100)} km`}
          >
            <Text style={styles.emptyActionText}>
              Increase radius to {Math.min(radiusKm * 2, 100)} km
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [isLoading, radiusKm]);

  // -----------------------------------------------------------------
  // Permission denied screen
  // -----------------------------------------------------------------

  if (locationPermissionDenied) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.permissionDenied}>
          <Text style={styles.permissionTitle}>Location access required</Text>
          <Text style={styles.permissionBody}>
            Marketplace needs your location to show nearby listings. Please enable
            location access in your device settings.
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open device settings"
            accessibilityHint="Opens the device settings app so you can enable location access"
          >
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLocationPermissionDenied(false);
              loadInitial(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // -----------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search bar + filter button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search listings…"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search listings"
            accessibilityHint="Filters listings by keyword"
          />
        </View>
        <TouchableOpacity
          style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
          onPress={openFilterSheet}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          accessibilityHint={
            activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`
              : 'Open filter options'
          }
        >
          <Text
            style={[
              styles.filterButtonText,
              activeFilterCount > 0 && styles.filterButtonTextActive,
            ]}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {fetchError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{fetchError}</Text>
          <TouchableOpacity
            onPress={() => loadInitial(false)}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Initial loading spinner */}
      {isLoading && listings.length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          ListEmptyComponent={ListEmptyComponent}
          refreshing={isRefreshing}
          onRefresh={() => loadInitial(true)}
          onEndReached={loadNextPage}
          onEndReachedThreshold={0.3}
          contentContainerStyle={
            listings.length === 0 ? styles.emptyListContent : styles.listContent
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Filter sheet modal */}
      <Modal
        visible={filterSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setFilterSheetVisible(false)}
          accessibilityLabel="Close filters"
          accessibilityRole="button"
        />
        <View style={[styles.filterSheet, { paddingBottom: insets.bottom + spacing.base }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filters</Text>

          {/* Radius picker */}
          <Text style={styles.filterSectionLabel}>Search radius</Text>
          <View style={styles.radiusOptions}>
            {RADIUS_OPTIONS.map((km) => (
              <TouchableOpacity
                key={km}
                style={[styles.chip, pendingRadiusKm === km && styles.chipSelected]}
                onPress={() => setPendingRadiusKm(km)}
                accessibilityRole="radio"
                accessibilityLabel={`${km} km`}
                accessibilityState={{ checked: pendingRadiusKm === km }}
              >
                <Text
                  style={[
                    styles.chipText,
                    pendingRadiusKm === km && styles.chipTextSelected,
                  ]}
                >
                  {km} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category picker */}
          <Text style={styles.filterSectionLabel}>Category</Text>
          <View style={styles.categoryOptions}>
            <TouchableOpacity
              style={[styles.chip, !pendingCategoryId && styles.chipSelected]}
              onPress={() => setPendingCategoryId(undefined)}
              accessibilityRole="radio"
              accessibilityLabel="All categories"
              accessibilityState={{ checked: !pendingCategoryId }}
            >
              <Text style={[styles.chipText, !pendingCategoryId && styles.chipTextSelected]}>
                All
              </Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, pendingCategoryId === cat.id && styles.chipSelected]}
                onPress={() => setPendingCategoryId(cat.id)}
                accessibilityRole="radio"
                accessibilityLabel={cat.name}
                accessibilityState={{ checked: pendingCategoryId === cat.id }}
              >
                <Text
                  style={[
                    styles.chipText,
                    pendingCategoryId === cat.id && styles.chipTextSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={applyFilters}
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
            >
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBarContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.select({ ios: spacing.sm, android: spacing.xs }) ?? spacing.sm,
    marginRight: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    color: colors.textPrimary,
    padding: 0, // Remove default Android padding
  },
  filterButton: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterButtonActive: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  filterButtonTextActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyListContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  listHeader: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  nearbyLabel: {
    ...typography.title,
    color: colors.textPrimary,
  },
  footer: {
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
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
  emptyState: {
    flex: 1,
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
  // Modal / filter sheet
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
  radiusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  categoryOptions: {
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
