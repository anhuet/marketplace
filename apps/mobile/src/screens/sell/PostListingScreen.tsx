import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import type { SellStackParamList } from '../../navigation/types';
import type { Condition, ListingWithDetails } from '@marketplace/shared';
import { CATEGORIES } from '@marketplace/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<SellStackParamList, 'PostListing'>;

interface SelectedPhoto {
  uri: string;
  type: string;
  fileName: string;
}

interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 8;

const CONDITIONS: { label: string; value: Condition }[] = [
  { label: 'New', value: 'NEW' },
  { label: 'Like New', value: 'LIKE_NEW' },
  { label: 'Good', value: 'GOOD' },
  { label: 'Fair', value: 'FAIR' },
  { label: 'Poor', value: 'POOR' },
];

// ─── Validation schema ────────────────────────────────────────────────────────

const listingSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be 100 characters or less'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must be 1000 characters or less'),
  price: z
    .string()
    .min(1, 'Price is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, {
      message: 'Price must be a non-negative number',
    }),
  categoryId: z.string().min(1, 'Please select a category'),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'], {
    errorMap: () => ({ message: 'Please select a condition' }),
  }),
});

type ListingFormValues = z.infer<typeof listingSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostListingScreen({ route, navigation }: Props): React.JSX.Element {
  const { user, updateUser } = useAuthStore();
  const listingId = route?.params?.listingId;
  const isEditMode = Boolean(listingId);

  // ── Invite code gate ────────────────────────────────────────────────────────
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleRedeemInvite = async () => {
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      setInviteError('Please enter an invite code.');
      return;
    }
    setInviteLoading(true);
    setInviteError(null);
    try {
      // Validate first
      const validateRes = await api.validateInviteCode(trimmed);
      if (!validateRes.data.valid) {
        setInviteError(validateRes.data.reason ?? 'Invalid invite code.');
        return;
      }
      // Redeem
      await api.redeemInvite(trimmed);
      // Refresh user profile
      const meRes = await api.getMe();
      updateUser(meRes.data.user);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setInviteError(
        axiosErr?.response?.data?.error?.message ?? 'Failed to redeem invite code. Please try again.',
      );
    } finally {
      setInviteLoading(false);
    }
  };

  if (!user?.inviteCodeUsedId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.inviteGateContainer}>
          <Text style={styles.inviteGateTitle}>Invite Code Required</Text>
          <Text style={styles.inviteGateDescription}>
            You need to redeem an invite code before you can sell items. Ask a friend for their code to get started.
          </Text>
          <FormInput
            label="Invite Code"
            placeholder="e.g. MKT-XXXX-XXXX"
            value={inviteCode}
            onChangeText={(text) => {
              setInviteCode(text);
              setInviteError(null);
            }}
            error={inviteError ?? undefined}
            autoCapitalize="characters"
            returnKeyType="done"
            accessibilityLabel="Invite code input"
          />
          <PrimaryButton
            label="Activate Account"
            loading={inviteLoading}
            onPress={handleRedeemInvite}
            accessibilityLabel="Redeem invite code"
          />
        </View>
      </SafeAreaView>
    );
  }

  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photosError, setPhotosError] = useState<string | null>(null);

  const [gps, setGps] = useState<GpsCoordinates | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);

  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [loadingEdit, setLoadingEdit] = useState(isEditMode);

  // Category list from API (falls back to CATEGORIES constant for display names)
  const [apiCategories, setApiCategories] = useState<{ id: string; name: string; slug: string }[]>(
    [],
  );

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: '',
      description: '',
      price: '',
      categoryId: '',
      condition: undefined,
    },
  });

  // ── Load categories from API ─────────────────────────────────────────────

  useEffect(() => {
    api
      .getCategories()
      .then((res) => setApiCategories(res.data.categories))
      .catch(() => {
        // Fall back to CATEGORIES constant — no-op, UI uses apiCategories only when loaded
      });
  }, []);

  // ── GPS capture ──────────────────────────────────────────────────────────

  const captureLocation = useCallback(async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('Location permission denied. Please enable it in Settings.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGps({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch {
      setGpsError('Unable to get location. Please try again.');
    } finally {
      setGpsLoading(false);
    }
  }, []);

  useEffect(() => {
    captureLocation();
  }, [captureLocation]);

  // ── Handle returned location from LocationPicker ────────────────────────

  useEffect(() => {
    const params = route?.params;
    if (params?.pickedLatitude != null && params?.pickedLongitude != null) {
      setGps({ latitude: params.pickedLatitude, longitude: params.pickedLongitude });
      setLocationAddress(params.pickedAddress ?? null);
      setGpsError(null);
    }
  }, [route?.params?.pickedLatitude, route?.params?.pickedLongitude, route?.params?.pickedAddress]);

  // ── Reverse geocode initial GPS location ────────────────────────────────

  useEffect(() => {
    if (!gps || locationAddress) return;
    Location.reverseGeocodeAsync({ latitude: gps.latitude, longitude: gps.longitude })
      .then((results) => {
        if (results.length > 0) {
          const r = results[0];
          const parts = [r.street, r.district, r.city, r.region, r.country].filter(Boolean);
          setLocationAddress(parts.join(', '));
        }
      })
      .catch(() => { /* silent */ });
  }, [gps?.latitude, gps?.longitude]);

  // ── Edit mode: pre-fill form ─────────────────────────────────────────────

  useEffect(() => {
    if (!isEditMode || !listingId) return;

    setLoadingEdit(true);
    api
      .getListing(listingId)
      .then((res) => {
        const listing: ListingWithDetails = res.data.listing;
        if (listing.sellerId !== user?.id) {
          setApiError('You do not have permission to edit this listing.');
          return;
        }
        setValue('title', listing.title);
        setValue('description', listing.description);
        setValue('price', listing.price);
        setValue('categoryId', listing.categoryId);
        setValue('condition', listing.condition);
        if (listing.latitude && listing.longitude) {
          setGps({ latitude: listing.latitude, longitude: listing.longitude });
        }
        // Pre-fill existing image URIs as "remote" photos (no re-upload unless user changes)
        const existingPhotos: SelectedPhoto[] = listing.images.map((img) => ({
          uri: img.url,
          type: 'image/jpeg',
          fileName: `image-${img.id}.jpg`,
        }));
        setPhotos(existingPhotos);
      })
      .catch(() => {
        setApiError('Failed to load listing details. Please go back and try again.');
      })
      .finally(() => setLoadingEdit(false));
  }, [isEditMode, listingId, setValue]);

  // ── Photo picker ─────────────────────────────────────────────────────────

  const requestMediaPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library in Settings.',
      );
      return false;
    }
    return true;
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access in Settings.');
      return false;
    }
    return true;
  };

  const pickFromGallery = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Photo Limit', `You can only add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_PHOTOS - photos.length,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newPhotos: SelectedPhoto[] = result.assets.map((asset) => ({
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      }));
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
      setPhotosError(null);
    }
  };

  const pickFromCamera = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Photo Limit', `You can only add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setPhotos((prev) =>
        [
          ...prev,
          {
            uri: asset.uri,
            type: asset.mimeType ?? 'image/jpeg',
            fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
          },
        ].slice(0, MAX_PHOTOS),
      );
      setPhotosError(null);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Photo Library', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: ListingFormValues) => {
    if (photos.length === 0) {
      setPhotosError('At least one photo is required.');
      return;
    }
    if (!gps) {
      setGpsError('Location is required. Please capture your location.');
      return;
    }

    setSubmitting(true);
    setApiError(null);

    try {
      if (isEditMode && listingId) {
        // Edit mode: PUT with FormData
        const formData = new FormData();
        formData.append('title', values.title);
        formData.append('description', values.description);
        formData.append('price', values.price);
        formData.append('condition', values.condition);
        formData.append('categoryId', values.categoryId);
        formData.append('latitude', String(gps.latitude));
        formData.append('longitude', String(gps.longitude));

        // Only attach local (newly selected) photos — remote URLs are skipped
        photos.forEach((photo) => {
          if (!photo.uri.startsWith('http')) {
            formData.append('images', {
              uri: photo.uri,
              type: photo.type,
              name: photo.fileName,
            } as unknown as Blob);
          }
        });

        await api.updateListing(listingId, formData);
        Alert.alert('Success', 'Your listing has been updated.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Create mode: POST with FormData
        const formData = new FormData();
        formData.append('title', values.title);
        formData.append('description', values.description);
        formData.append('price', values.price);
        formData.append('condition', values.condition);
        formData.append('categoryId', values.categoryId);
        formData.append('latitude', String(gps.latitude));
        formData.append('longitude', String(gps.longitude));

        photos.forEach((photo) => {
          formData.append('images', {
            uri: photo.uri,
            type: photo.type,
            name: photo.fileName,
          } as unknown as Blob);
        });

        await api.createListing(formData);
        reset();
        setPhotos([]);
        setLocationAddress(null);
        Alert.alert('Listing Posted!', 'Your listing is now live.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } }; status?: number } };
      const serverMsg = axiosErr?.response?.data?.error?.message;
      const status = axiosErr?.response?.status;
      setApiError(
        serverMsg
          ? `Error ${status ?? ''}: ${serverMsg}`
          : 'Something went wrong. Please check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderPhotoThumbnail = ({
    item,
    index,
  }: {
    item: SelectedPhoto;
    index: number;
  }) => (
    <View style={styles.thumbnailWrapper}>
      <Image
        source={{ uri: item.uri }}
        style={styles.thumbnail}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        accessibilityLabel={`Photo ${index + 1}`}
      />
      <TouchableOpacity
        style={styles.removePhotoButton}
        onPress={() => removePhoto(index)}
        accessibilityRole="button"
        accessibilityLabel={`Remove photo ${index + 1}`}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Text style={styles.removePhotoIcon}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  if (loadingEdit) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </SafeAreaView>
    );
  }

  const categoryOptions = apiCategories.length > 0 ? apiCategories : CATEGORIES.map((c) => ({ id: c.slug, name: c.name, slug: c.slug }));

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <Text style={styles.heading} accessibilityRole="header">
            {isEditMode ? 'Edit Listing' : 'Post a Listing'}
          </Text>

          {/* ── API error banner ── */}
          {apiError ? (
            <View
              style={styles.errorBanner}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              <Text style={styles.errorBannerText}>{apiError}</Text>
              <TouchableOpacity
                onPress={handleSubmit(onSubmit)}
                accessibilityRole="button"
                accessibilityLabel="Retry submission"
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Photos ── */}
          <Text style={styles.sectionLabel}>PHOTOS</Text>
          <Text style={styles.photosHint}>
            {photos.length}/{MAX_PHOTOS} — At least 1 required
          </Text>

          <View style={styles.photoRow}>
            <FlatList
              data={photos}
              keyExtractor={(_, i) => String(i)}
              renderItem={renderPhotoThumbnail}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailList}
              ListFooterComponent={
                photos.length < MAX_PHOTOS ? (
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={showPhotoOptions}
                    accessibilityRole="button"
                    accessibilityLabel="Add photo"
                    accessibilityHint="Opens options to add a photo from your camera or library"
                  >
                    <Text style={styles.addPhotoIcon}>+</Text>
                    <Text style={styles.addPhotoLabel}>Add</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>

          {photosError ? (
            <Text
              style={styles.fieldError}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {photosError}
            </Text>
          ) : null}

          {/* ── Title ── */}
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Title"
                placeholder="e.g. Sony WH-1000XM5 Headphones"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.title?.message}
                maxLength={100}
                returnKeyType="next"
                accessibilityLabel="Listing title"
                accessibilityHint="Enter a short headline for your item, up to 100 characters"
              />
            )}
          />

          {/* ── Description ── */}
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Description"
                placeholder="Describe the item's condition, features, and any flaws…"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.description?.message}
                multiline
                numberOfLines={4}
                style={styles.textArea}
                maxLength={1000}
                returnKeyType="next"
                textAlignVertical="top"
                accessibilityLabel="Listing description"
                accessibilityHint="Describe the item in detail, up to 1000 characters"
              />
            )}
          />

          {/* ── Price ── */}
          <Controller
            control={control}
            name="price"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Price"
                placeholder="0.00"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.price?.message}
                keyboardType="decimal-pad"
                returnKeyType="next"
                accessibilityLabel="Listing price"
                accessibilityHint="Enter the asking price in your local currency"
              />
            )}
          />

          {/* ── Category ── */}
          <Text style={styles.sectionLabel}>CATEGORY</Text>
          <Controller
            control={control}
            name="categoryId"
            render={({ field: { onChange, value } }) => (
              <View style={styles.chipGroup} accessibilityRole="radiogroup">
                {categoryOptions.map((cat) => {
                  const selected = value === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => onChange(cat.id)}
                      accessibilityRole="radio"
                      accessibilityLabel={cat.name}
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
          {errors.categoryId ? (
            <Text
              style={styles.fieldError}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {errors.categoryId.message}
            </Text>
          ) : null}

          {/* ── Condition ── */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpacingTop]}>CONDITION</Text>
          <Controller
            control={control}
            name="condition"
            render={({ field: { onChange, value } }) => (
              <View style={styles.chipGroup} accessibilityRole="radiogroup">
                {CONDITIONS.map((cond) => {
                  const selected = value === cond.value;
                  return (
                    <TouchableOpacity
                      key={cond.value}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => onChange(cond.value)}
                      accessibilityRole="radio"
                      accessibilityLabel={cond.label}
                      accessibilityState={{ checked: selected }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {cond.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          />
          {errors.condition ? (
            <Text
              style={styles.fieldError}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {errors.condition.message}
            </Text>
          ) : null}

          {/* ── Location ── */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpacingTop]}>LOCATION</Text>
          {gpsLoading ? (
            <View style={styles.locationLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primaryDark} />
              <Text style={styles.locationLoadingText}>Getting your location...</Text>
            </View>
          ) : gps ? (
            <TouchableOpacity
              style={styles.mapPreviewContainer}
              onPress={() => navigation.navigate('LocationPicker', { latitude: gps.latitude, longitude: gps.longitude })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Change location on map"
            >
              <MapView
                style={styles.mapPreview}
                region={{
                  latitude: gps.latitude,
                  longitude: gps.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                pointerEvents="none"
              >
                <Marker coordinate={{ latitude: gps.latitude, longitude: gps.longitude }} />
              </MapView>
              <View style={styles.mapOverlayRow}>
                <View style={styles.mapAddressContainer}>
                  <Text style={styles.mapAddressText} numberOfLines={1}>
                    {locationAddress ?? `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`}
                  </Text>
                </View>
                <View style={styles.changeLocationBadge}>
                  <Text style={styles.changeLocationText}>Change</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.locationRow}>
              <View style={styles.locationInfo}>
                <Text style={styles.locationMissing}>Location not captured</Text>
                {gpsError ? (
                  <Text
                    style={styles.fieldError}
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                  >
                    {gpsError}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.locationRefreshButton}
                onPress={captureLocation}
                disabled={gpsLoading}
                accessibilityRole="button"
                accessibilityLabel="Use current location"
              >
                <Text style={styles.locationRefreshText}>Get Location</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Submit ── */}
          <View style={styles.submitContainer}>
            <PrimaryButton
              label={isEditMode ? 'Save Changes' : 'Post Listing'}
              loading={submitting}
              onPress={handleSubmit(onSubmit)}
              accessibilityLabel={isEditMode ? 'Save changes to listing' : 'Post listing'}
              accessibilityHint={
                isEditMode ? 'Updates the listing with new details' : 'Publishes your listing'
              }
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xxl,
  },
  heading: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  // Error banner
  errorBanner: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  errorBannerText: {
    ...typography.body,
    color: colors.error,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.error,
    borderRadius: radius.pill,
  },
  retryText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },

  // Photos
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  sectionLabelSpacingTop: {
    marginTop: spacing.sm,
  },
  photosHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  photoRow: {
    marginBottom: spacing.sm,
  },
  thumbnailList: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoIcon: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  addPhotoButton: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addPhotoIcon: {
    fontSize: 24,
    color: colors.primaryDark,
    lineHeight: 28,
  },
  addPhotoLabel: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  fieldError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },

  // Text area
  textArea: {
    minHeight: 112,
  },

  // Chip groups (category, condition)
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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

  // Location
  locationLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  locationLoadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  mapPreviewContainer: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  mapPreview: {
    height: 160,
    width: '100%',
  },
  mapOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  mapAddressContainer: {
    flex: 1,
  },
  mapAddressText: {
    ...typography.label,
    color: colors.textPrimary,
  },
  changeLocationBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  changeLocationText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  locationInfo: {
    flex: 1,
  },
  locationMissing: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  locationRefreshButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  locationRefreshText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },

  // Submit
  submitContainer: {
    marginTop: spacing.lg,
  },

  // Invite gate
  inviteGateContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  inviteGateTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  inviteGateDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
