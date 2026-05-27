/**
 * Shared image-preprocessing pipeline for listing photos.
 *
 * Every user-supplied image — whether picked from the gallery, captured via the
 * system camera (ImagePicker), or captured via the in-app CameraCapture screen —
 * must pass through `toJpegLocalPhoto` before upload.  This ensures a consistent
 * wire format and file-size budget regardless of the capture path.
 *
 * Invariants (documented in ARCHITECTURE.md "Image Preprocessing"):
 *   - Longest edge resized to ≤ 1 600 px (aspect ratio preserved)
 *   - JPEG quality 0.7
 *   - Output MIME type: image/jpeg
 */

import * as ImageManipulator from 'expo-image-manipulator';

// ─── Shared type ──────────────────────────────────────────────────────────────

/** A photo that was captured/picked on device and has not yet been uploaded. */
export interface LocalPhoto {
  kind: 'local';
  uri: string;
  type: string;
  fileName: string;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

const MAX_DIM = 1600;
const JPEG_QUALITY = 0.7;

/**
 * Resize (if needed) and re-encode an image URI to JPEG.
 *
 * @param opts.uri          - Absolute local URI of the source image.
 * @param opts.width        - Source image pixel width (used to decide whether to resize).
 * @param opts.height       - Source image pixel height.
 * @param opts.indexInBatch - Position in the current upload batch; used to produce
 *                            a unique file name.
 */
export async function toJpegLocalPhoto(opts: {
  uri: string;
  width?: number;
  height?: number;
  indexInBatch: number;
}): Promise<LocalPhoto> {
  const { uri, width, height, indexInBatch } = opts;

  const actions: ImageManipulator.Action[] = [];
  if (width && height) {
    if (width >= height && width > MAX_DIM) {
      actions.push({ resize: { width: MAX_DIM } });
    } else if (height > width && height > MAX_DIM) {
      actions.push({ resize: { height: MAX_DIM } });
    }
  }

  const manipulated = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    kind: 'local',
    uri: manipulated.uri,
    type: 'image/jpeg',
    fileName: `photo-${Date.now()}-${indexInBatch}.jpg`,
  };
}
