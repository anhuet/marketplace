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
import { useFocusEffect } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import MapView, { Marker } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api } from '../../lib/api';
import { toJpegLocalPhoto, type LocalPhoto } from '../../lib/imagePipeline';
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import type { SellStackParamList } from '../../navigation/types';
import type { Condition, ListingWithDetails } from '@marketplace/shared';
import { CATEGORIES } from '@marketplace/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<SellStackParamList, 'PostListing'>;

/** A photo that already exists on the server and has a DB id. */
interface RemotePhoto {
  kind: 'remote';
  id: string;
  uri: string; // presigned URL — used for display only
}

type EditablePhoto = RemotePhoto | LocalPhoto;

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

  const [photos, setPhotos] = useState<EditablePhoto[]>([]);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

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
    // In edit mode, GPS comes from the existing listing — never override it
    // with the device's current location.
    if (isEditMode) return;
    captureLocation();
  }, [captureLocation, isEditMode]);

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
        // Map existing server images to RemotePhoto so we track their DB ids
        const existingPhotos: RemotePhoto[] = listing.images.map((img) => ({
          kind: 'remote',
          id: img.id,
          uri: img.url,
        }));
        setPhotos(existingPhotos);
      })
      .catch(() => {
        setApiError('Failed to load listing details. Please go back and try again.');
      })
      .finally(() => setLoadingEdit(false));
  }, [isEditMode, listingId, setValue]);

  // ── Reset form when navigating to Sell tab fresh (no listingId) ──────────
  // The tab navigator keeps this screen alive. If the user previously opened
  // edit mode (which sets route.params.listingId), then taps the "+" Sell tab
  // directly, the screen refocuses with the old listingId still in params.
  // Resetting on focus when there is no listingId gives a clean blank form.

  useFocusEffect(
    useCallback(() => {
      if (!listingId) {
        reset({
          title: '',
          description: '',
          price: '',
          categoryId: '',
          condition: undefined,
        });
        setPhotos([]);
        setApiError(null);
        setPhotosError(null);
        setLocationAddress(null);
        setUploadingPhoto(false);
        setDeletingPhotoId(null);
        captureLocation();
      }
    }, [listingId, reset, captureLocation]),
  );

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

  // Re-encode every picked asset to JPEG via the shared pipeline in
  // lib/imagePipeline.  iPhone gallery returns HEIC by default, which sharp on
  // the backend (built without libheif) cannot decode — we normalise to JPEG
  // client-side.  The pipeline also caps the longest edge at 1 600 px.
  const toJpeg = (
    asset: ImagePicker.ImagePickerAsset,
    indexInBatch: number,
  ): Promise<LocalPhoto> =>
    toJpegLocalPhoto({
      uri: asset.uri,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
      indexInBatch,
    });

  /**
   * In edit mode, immediately upload the local photos to the server and
   * convert them to RemotePhotos in state. In create mode, just append
   * LocalPhotos — they will be uploaded on submit.
   */
  const appendPhotos = async (locals: LocalPhoto[]) => {
    if (!isEditMode || !listingId) {
      // Create mode: append as-is; upload happens on submit
      setPhotos((prev) => [...prev, ...locals].slice(0, MAX_PHOTOS));
      setPhotosError(null);
      return;
    }

    // Edit mode: upload immediately
    setUploadingPhoto(true);
    setPhotosError(null);
    try {
      const formData = new FormData();
      locals.forEach((p) => {
        formData.append('images', {
          uri: p.uri,
          type: p.type,
          name: p.fileName,
        } as unknown as Blob);
      });
      const res = await api.addListingImages(listingId, formData);
      const uploaded: RemotePhoto[] = res.data.images.map((img) => ({
        kind: 'remote',
        id: img.id,
        uri: img.url,
      }));
      setPhotos((prev) => [...prev, ...uploaded].slice(0, MAX_PHOTOS));
    } catch {
      Alert.alert('Upload Failed', 'Could not upload the photo(s). Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
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
      try {
        const locals = await Promise.all(result.assets.map((a, i) => toJpeg(a, i)));
        await appendPhotos(locals);
      } catch {
        setPhotosError('Could not process one of the selected photos. Please try again.');
      }
    }
  };

  const pickFromCamera = () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Photo Limit', `You can only add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    // Permission is handled inside CameraCaptureScreen via useCameraPermissions().
    // The screen calls onCapture with the array of LocalPhotos when the user
    // taps Done or navigates back.
    navigation.navigate('CameraCapture', {
      remaining: MAX_PHOTOS - photos.length,
      onCapture: (locals: LocalPhoto[]) => {
        if (locals.length > 0) {
          void appendPhotos(locals);
        }
      },
    });
  };

  const showPhotoOptions = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Photo Library', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = (index: number) => {
    const photo = photos[index];

    if (photo.kind === 'remote') {
      // Edit mode: confirm then call DELETE endpoint
      Alert.alert('Remove Photo?', 'Are you sure you want to remove this photo?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDeletingPhotoId(photo.id);
            try {
              await api.deleteListingImage(listingId!, photo.id);
              setPhotos((prev) => prev.filter((_, i) => i !== index));
            } catch (err: unknown) {
              const status = (err as { response?: { status?: number } })?.response?.status;
              if (status === 422) {
                Alert.alert(
                  'Cannot Remove',
                  'Listing must have at least one image. Add another photo first.',
                );
              } else {
                Alert.alert('Error', 'Could not remove the photo. Please try again.');
              }
            } finally {
              setDeletingPhotoId(null);
            }
          },
        },
      ]);
    } else {
      // Create mode (local photo): just remove from state
      setPhotos((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // ── Voice fill (Whisper + GPT) ────────────────────────────────────────────
  // Records audio, sends to backend, fills form fields from the parsed result.
  // Available in create mode only — we don't want to overwrite an existing
  // listing's fields with new transcription output.

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 250);

  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const startVoiceRecording = async () => {
    setVoiceError(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setVoiceError('Microphone permission is required. Please enable it in Settings.');
        return;
      }
      // Configure audio session so recording works on iOS even with mute switch on.
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      setVoiceError('Could not start the recording. Please try again.');
    }
  };

  const stopVoiceRecordingAndParse = async () => {
    try {
      await audioRecorder.stop();
    } catch {
      setVoiceError('Could not stop the recording. Please try again.');
      return;
    }

    const uri = audioRecorder.uri;
    if (!uri) {
      setVoiceError('No recording captured. Please try again.');
      return;
    }

    setVoiceProcessing(true);
    setVoiceError(null);

    try {
      // The file extension on iOS is .m4a (AAC). Some recorders return MIME
      // type video/mp4 for m4a — the backend accepts both audio/* and video/*.
      const isM4a = uri.toLowerCase().endsWith('.m4a');
      const filename = isM4a ? 'voice.m4a' : 'voice.mp4';
      const mime = isM4a ? 'audio/m4a' : 'audio/mp4';

      const formData = new FormData();
      formData.append('audio', {
        uri,
        name: filename,
        type: mime,
      } as unknown as Blob);

      const res = await api.parseVoiceListing(formData);
      const parsed = res.data;

      if (parsed.title) setValue('title', parsed.title, { shouldValidate: true });
      if (parsed.description) setValue('description', parsed.description, { shouldValidate: true });
      if (parsed.price) setValue('price', parsed.price, { shouldValidate: true });
      if (parsed.condition) setValue('condition', parsed.condition, { shouldValidate: true });

      // Match the API-supplied category id against the loaded category options.
      if (parsed.categoryId) {
        const opts = apiCategories.length > 0 ? apiCategories : null;
        const match = opts?.find((c) => c.id === parsed.categoryId);
        if (match) {
          setValue('categoryId', match.id, { shouldValidate: true });
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setVoiceError(
        axiosErr?.response?.data?.error?.message ??
          'Voice parsing failed. Please try again or fill the fields manually.',
      );
    } finally {
      setVoiceProcessing(false);
    }
  };

  const handleVoiceButtonPress = () => {
    if (voiceProcessing) return;
    if (recorderState.isRecording) {
      stopVoiceRecordingAndParse();
    } else {
      startVoiceRecording();
    }
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
        // Edit mode: PUT sends metadata only — images are already managed via
        // POST /images (on add) and DELETE /images/:id (on remove).
        // GPS coordinates are intentionally NOT sent — the listing's location
        // is fixed at creation and cannot be edited.
        await api.updateListing(listingId, {
          title: values.title,
          description: values.description,
          price: values.price,
          condition: values.condition,
          categoryId: values.categoryId,
        });
        Alert.alert('Success', 'Your listing has been updated.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Create mode: POST with FormData — all photos are LocalPhoto at this point
        const formData = new FormData();
        formData.append('title', values.title);
        formData.append('description', values.description);
        formData.append('price', values.price);
        formData.append('condition', values.condition);
        formData.append('categoryId', values.categoryId);
        formData.append('latitude', String(gps.latitude));
        formData.append('longitude', String(gps.longitude));

        photos.forEach((photo) => {
          if (photo.kind === 'local') {
            formData.append('images', {
              uri: photo.uri,
              type: photo.type,
              name: photo.fileName,
            } as unknown as Blob);
          }
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
    item: EditablePhoto;
    index: number;
  }) => {
    const isDeleting = item.kind === 'remote' && deletingPhotoId === item.id;
    return (
      <View style={styles.thumbnailWrapper}>
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          accessibilityLabel={`Photo ${index + 1}`}
        />
        {isDeleting ? (
          <View style={styles.thumbnailOverlay}>
            <ActivityIndicator size="small" color={colors.surface} />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.removePhotoButton}
            onPress={() => removePhoto(index)}
            accessibilityRole="button"
            accessibilityLabel={`Remove photo ${index + 1}`}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Text style={styles.removePhotoIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

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
              keyExtractor={(item) =>
                item.kind === 'remote' ? `remote-${item.id}` : `local-${item.uri}`
              }
              renderItem={renderPhotoThumbnail}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailList}
              ListFooterComponent={
                photos.length < MAX_PHOTOS ? (
                  <TouchableOpacity
                    style={[styles.addPhotoButton, uploadingPhoto && styles.addPhotoButtonDisabled]}
                    onPress={uploadingPhoto ? undefined : showPhotoOptions}
                    accessibilityRole="button"
                    accessibilityLabel="Add photo"
                    accessibilityHint="Opens options to add a photo from your camera or library"
                    accessibilityState={{ disabled: uploadingPhoto }}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color={colors.primaryDark} />
                    ) : (
                      <>
                        <Text style={styles.addPhotoIcon}>+</Text>
                        <Text style={styles.addPhotoLabel}>Add</Text>
                      </>
                    )}
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

          {/* ── Voice Fill (create mode only) ── */}
          {!isEditMode ? (
            <View style={styles.voiceContainer}>
              <Text style={styles.sectionLabel}>VOICE FILL</Text>
              <Text style={styles.voiceHint}>
                Describe your item in English or German — title, price and category will be filled in automatically.
              </Text>
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  recorderState.isRecording && styles.voiceButtonRecording,
                  voiceProcessing && styles.voiceButtonDisabled,
                ]}
                onPress={handleVoiceButtonPress}
                disabled={voiceProcessing}
                accessibilityRole="button"
                accessibilityLabel={
                  recorderState.isRecording
                    ? 'Stop recording and fill listing fields'
                    : 'Start voice recording to fill listing fields'
                }
                accessibilityState={{ disabled: voiceProcessing, busy: voiceProcessing }}
              >
                {voiceProcessing ? (
                  <>
                    <ActivityIndicator size="small" color={colors.surface} />
                    <Text style={styles.voiceButtonText}>Transcribing…</Text>
                  </>
                ) : recorderState.isRecording ? (
                  <>
                    <View style={styles.voiceRecordingDot} />
                    <Text style={styles.voiceButtonText}>
                      {`Stop  ·  ${Math.floor((recorderState.durationMillis ?? 0) / 1000)}s`}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.voiceButtonText}>Tap to describe by voice</Text>
                )}
              </TouchableOpacity>
              {voiceError ? (
                <Text
                  style={styles.fieldError}
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                >
                  {voiceError}
                </Text>
              ) : null}
            </View>
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
            <View
              style={styles.mapPreviewContainer}
              accessibilityRole="image"
              accessibilityLabel="Listing location (read-only)"
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
              </View>
            </View>
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
    // Padding gives the absolutely-positioned X button room to render above
    // and to the right of the image without being clipped by the FlatList.
    paddingTop: 8,
    paddingRight: 8,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 0,
    right: 0,
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
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
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
  addPhotoButtonDisabled: {
    opacity: 0.6,
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

  // Voice fill
  voiceContainer: {
    marginBottom: spacing.base,
  },
  voiceHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryDark,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
  },
  voiceButtonRecording: {
    backgroundColor: colors.error,
  },
  voiceButtonDisabled: {
    opacity: 0.7,
  },
  voiceButtonText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
  voiceRecordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
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
