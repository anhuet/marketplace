/**
 * CameraCaptureScreen — Full-screen multi-shot camera for the New Listing flow.
 *
 * The user stays inside this screen and snaps as many photos as the remaining
 * slot count allows.  A live thumbnail strip shows every captured photo; the
 * first thumbnail is labelled "Cover".  Tapping Done (or navigating back with a
 * gesture / hardware back) returns ALL captured photos to PostListingScreen via
 * the `onCapture` route-param callback.
 *
 * Every frame goes through `toJpegLocalPhoto` from `lib/imagePipeline` so the
 * wire format is identical to the gallery path (≤ 1600 px, JPEG quality 0.7).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type FlashMode } from 'expo-camera';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { toJpegLocalPhoto, type LocalPhoto } from '../../lib/imagePipeline';
import { useIsMounted } from '../../hooks/useIsMounted';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { SellStackParamList } from '../../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<SellStackParamList, 'CameraCapture'>;

// Flash cycle order: auto → on → off → auto …
const FLASH_CYCLE: FlashMode[] = ['auto', 'on', 'off'];

const FLASH_LABELS: Record<FlashMode, string> = {
  auto: '⚡ Auto',
  on: '⚡ On',
  off: '⚡ Off',
};

// Thumbnail dimensions in the strip
const THUMB_SIZE = 72;
const SHUTTER_SIZE = 72;
const PLACEHOLDER_COUNT = 3; // empty placeholder boxes shown before any capture

// ─── Component ────────────────────────────────────────────────────────────────

export default function CameraCaptureScreen({ route, navigation }: Props): React.JSX.Element {
  const { remaining, onCapture } = route.params;
  const insets = useSafeAreaInsets();
  const isMounted = useIsMounted();

  const [permission, requestPermission] = useCameraPermissions();
  const [flashMode, setFlashMode] = useState<FlashMode>('auto');
  const [capturing, setCapturing] = useState(false);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);

  // Keep a ref that always reflects the latest photos state so the
  // beforeRemove listener (which closes over the initial value) can
  // read current data without stale-closure issues.
  const photosRef = useRef<LocalPhoto[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const cameraRef = useRef<CameraView>(null);

  // ── Permission request on mount ───────────────────────────────────────────

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    // Only run once on mount — permission object identity changes each render
    // but canAskAgain / granted status is stable after the first check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fire onCapture on every exit path ─────────────────────────────────────
  // The `beforeRemove` event fires before any back navigation — hardware back,
  // swipe gesture, and goBack() calls.  We fire `onCapture` here so photos are
  // never lost regardless of how the screen is dismissed.

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      onCapture(photosRef.current);
    });
    return unsubscribe;
  }, [navigation, onCapture]);

  // ── Done button ───────────────────────────────────────────────────────────

  const handleDone = useCallback(() => {
    // onCapture will be called by the beforeRemove listener when goBack fires.
    navigation.goBack();
  }, [navigation]);

  // ── Flash toggle ──────────────────────────────────────────────────────────

  const cycleFlash = useCallback(() => {
    setFlashMode((current) => {
      const idx = FLASH_CYCLE.indexOf(current);
      return FLASH_CYCLE[(idx + 1) % FLASH_CYCLE.length];
    });
  }, []);

  // ── Capture ───────────────────────────────────────────────────────────────

  const canCapture = photos.length < remaining && !capturing;

  const handleCapture = useCallback(async () => {
    // Guard against double-tap while a capture is already in flight and
    // against a missing camera ref (possible on first render before Fabric
    // has attached the native view).
    if (!canCapture || !cameraRef.current) return;
    setCapturing(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        // skipProcessing: true on Android avoids the native JPEG post-processing
        // path that can throw on some Android camera HAL versions.
        skipProcessing: Platform.OS === 'android',
      });
      if (!isMounted()) return;
      if (!pic) return;
      const local = await toJpegLocalPhoto({
        uri: pic.uri,
        width: pic.width,
        height: pic.height,
        indexInBatch: photosRef.current.length,
      });
      if (!isMounted()) return;
      setPhotos((prev) => [...prev, local]);
    } catch {
      if (!isMounted()) return;
      Alert.alert('Không thể chụp ảnh', 'Đã xảy ra lỗi khi chụp ảnh. Vui lòng thử lại.', [
        { text: 'OK' },
      ]);
    } finally {
      if (isMounted()) setCapturing(false);
    }
  }, [canCapture, isMounted]);

  // ── Remove from strip ─────────────────────────────────────────────────────

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Render: permission states ─────────────────────────────────────────────

  if (!permission) {
    // Permissions API not yet resolved
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.permissionContainer,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.base },
        ]}
      >
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionBody}>Allow camera access to capture listing photos.</Text>
        {permission.canAskAgain ? (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            accessibilityRole="button"
            accessibilityLabel="Grant camera permission"
          >
            <Text style={styles.permissionButtonText}>Allow Camera</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open Settings to grant camera permission"
          >
            <Text style={styles.permissionButtonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.permissionCancelButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back without taking photos"
        >
          <Text style={styles.permissionCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: main camera UI ────────────────────────────────────────────────

  const atLimit = photos.length >= remaining;

  return (
    <View style={styles.root}>
      {/* Live camera preview — fills the whole screen */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} flash={flashMode} facing="back" />

      {/* Top bar — flash toggle + Done */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={cycleFlash}
          accessibilityRole="button"
          accessibilityLabel={`Flash: ${flashMode}. Tap to change.`}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.topBarButtonText}>{FLASH_LABELS[flashMode]}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={handleDone}
          accessibilityRole="button"
          accessibilityLabel="Done — return captured photos"
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom area: thumbnail strip + shutter */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + spacing.base }]}>
        {/* Thumbnail strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stripContent}
          style={styles.strip}
        >
          {/* Captured thumbnails */}
          {photos.map((photo, index) => (
            <View key={photo.uri} style={styles.thumbWrapper}>
              <Image
                source={{ uri: photo.uri }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory"
                accessibilityLabel={`Captured photo ${index + 1}`}
              />
              {/* Cover label on first photo */}
              {index === 0 ? (
                <View style={styles.coverBadge} accessibilityElementsHidden>
                  <Text style={styles.coverBadgeText}>Cover</Text>
                </View>
              ) : null}
              {/* Remove button */}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(index)}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Empty placeholder boxes (shown while under limit and count < PLACEHOLDER_COUNT) */}
          {!atLimit
            ? Array.from({ length: Math.max(0, PLACEHOLDER_COUNT - photos.length) }).map((_, i) => (
                <View
                  key={`placeholder-${i}`}
                  style={styles.placeholder}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              ))
            : null}
        </ScrollView>

        {/* Photo limit caption */}
        {atLimit ? (
          <Text
            style={styles.limitCaption}
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
          >
            Photo limit reached
          </Text>
        ) : null}

        {/* Shutter button */}
        <TouchableOpacity
          style={[styles.shutter, atLimit && styles.shutterDisabled]}
          onPress={handleCapture}
          disabled={!canCapture}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityHint={
            atLimit ? 'Photo limit reached' : `${remaining - photos.length} photos remaining`
          }
          accessibilityState={{ disabled: !canCapture }}
        >
          {capturing ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <View style={[styles.shutterInner, atLimit && styles.shutterInnerDisabled]} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const OVERLAY_BG = 'rgba(0,0,0,0.55)';
const OVERLAY_BG_LIGHT = 'rgba(0,0,0,0.35)';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // ── Permission screens ──────────────────────────────────────────────────
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  permissionTitle: {
    ...typography.title,
    color: colors.surface,
    textAlign: 'center',
  },
  permissionBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  permissionButtonText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
  permissionCancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  permissionCancelText: {
    ...typography.label,
    color: colors.textSecondary,
  },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    backgroundColor: OVERLAY_BG,
  },
  topBarButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: OVERLAY_BG_LIGHT,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  topBarButtonText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
  doneButton: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  doneButtonText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '700',
  },

  // ── Bottom area ──────────────────────────────────────────────────────────
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: spacing.base,
    backgroundColor: OVERLAY_BG,
    gap: spacing.sm,
  },

  // ── Thumbnail strip ──────────────────────────────────────────────────────
  strip: {
    maxHeight: THUMB_SIZE + spacing.base * 2,
    width: '100%',
  },
  stripContent: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  thumbWrapper: {
    // Extra padding gives the remove button room outside the image bounds.
    paddingTop: 8,
    paddingRight: 8,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  coverBadgeText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 13,
  },
  removeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  placeholder: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.05)',
    // Align vertically with thumbWrapper (which has paddingTop: 8)
    marginTop: 8,
  },

  // ── Limit caption ────────────────────────────────────────────────────────
  limitCaption: {
    ...typography.caption,
    color: colors.surface,
    opacity: 0.8,
  },

  // ── Shutter button ───────────────────────────────────────────────────────
  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
  shutterDisabled: {
    opacity: 0.35,
  },
  shutterInner: {
    width: SHUTTER_SIZE - 20,
    height: SHUTTER_SIZE - 20,
    borderRadius: (SHUTTER_SIZE - 20) / 2,
    backgroundColor: colors.surface,
  },
  shutterInnerDisabled: {
    backgroundColor: colors.textSecondary,
  },
});
