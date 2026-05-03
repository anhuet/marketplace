import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { SellStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<SellStackParamList, 'LocationPicker'>;

const DELTA = 0.005;

export default function LocationPickerScreen({ route, navigation }: Props): React.JSX.Element {
  const { latitude, longitude } = route.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  const [pin, setPin] = useState({ latitude, longitude });
  const [address, setAddress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // ── Reverse geocode ─────────────────────────────────────────────────────────

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.street, r.district, r.city, r.region, r.country].filter(Boolean);
        setAddress(parts.join(', '));
      } else {
        setAddress(null);
      }
    } catch {
      setAddress(null);
    }
  }, []);

  useEffect(() => {
    reverseGeocode(pin.latitude, pin.longitude);
  }, [pin.latitude, pin.longitude, reverseGeocode]);

  // ── Map region change (marker drag) ─────────────────────────────────────────

  const handleMarkerDragEnd = useCallback((e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setPin({ latitude: lat, longitude: lng });
  }, []);

  const handleMapPress = useCallback((e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setPin({ latitude: lat, longitude: lng });
  }, []);

  // ── Search address ──────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError(null);
    try {
      const results = await Location.geocodeAsync(trimmed);
      if (results.length > 0) {
        const { latitude: lat, longitude: lng } = results[0];
        setPin({ latitude: lat, longitude: lng });
        mapRef.current?.animateToRegion(
          { latitude: lat, longitude: lng, latitudeDelta: DELTA, longitudeDelta: DELTA },
          400,
        );
      } else {
        setSearchError('No results found. Try a different address.');
      }
    } catch {
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  // ── Use my location ─────────────────────────────────────────────────────────

  const handleUseMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      setPin({ latitude: lat, longitude: lng });
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: DELTA, longitudeDelta: DELTA },
        400,
      );
    } catch {
      // silent — location already shown if available
    } finally {
      setLocating(false);
    }
  }, []);

  // ── Confirm ─────────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(() => {
    navigation.navigate('PostListing', {
      pickedLatitude: pin.latitude,
      pickedLongitude: pin.longitude,
      pickedAddress: address ?? undefined,
    });
  }, [navigation, pin, address]);

  const renderMap = () => {
    const mapProps = {
      ref: mapRef,
      style: styles.map,
      initialRegion: {
        latitude,
        longitude,
        latitudeDelta: DELTA,
        longitudeDelta: DELTA,
      },
      onPress: handleMapPress,
      showsUserLocation: true,
      showsMyLocationButton: false,
    };
    return React.createElement(
      MapView,
      mapProps as any,
      React.createElement(Marker, { coordinate: pin, draggable: true, onDragEnd: handleMarkerDragEnd }),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search address..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={(text: string) => {
              setSearchQuery(text);
              setSearchError(null);
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search address"
          />
          {searching && <ActivityIndicator size="small" color={colors.primaryDark} />}
        </View>
        {searchError && <Text style={styles.searchError}>{searchError}</Text>}
      </View>

      {/* Map */}
      {renderMap()}

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {/* Address display */}
        <View style={styles.addressRow}>
          <Ionicons name="location-sharp" size={20} color={colors.primaryDark} />
          <Text style={styles.addressText} numberOfLines={2}>
            {address ?? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={handleUseMyLocation}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <Ionicons name="navigate" size={18} color={colors.primaryDark} />
            )}
            <Text style={styles.myLocationText}>My Location</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirm location"
          >
            <Text style={styles.confirmText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Search
  searchContainer: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  searchError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  // Map
  map: {
    flex: 1,
  },
  // Bottom panel
  bottomPanel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  addressText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  myLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    backgroundColor: colors.surface,
  },
  myLocationText: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  confirmText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
});
