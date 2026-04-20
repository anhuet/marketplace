import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { api } from '../../lib/api';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import InteractiveStarRating from '../../components/InteractiveStarRating';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';

// ─── Types ────────────────────────────────────────────────────────────────────

type WriteReviewRouteParams = {
  listingId: string;
  revieweeId: string;
  revieweeName: string;
  listingTitle: string;
};

// ─── Validation schema ────────────────────────────────────────────────────────

const reviewSchema = z.object({
  rating: z.number().min(1, 'Please select a rating').max(5),
  comment: z
    .string()
    .max(1000, 'Comment must be 1000 characters or less')
    .optional()
    .or(z.literal('')),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

// ─── Error mapping ────────────────────────────────────────────────────────────

function resolveApiError(err: unknown): string {
  const axiosErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
  const status = axiosErr?.response?.status;

  if (status === 409) {
    return 'You have already reviewed this transaction.';
  }
  if (status === 422) {
    return 'This listing must be marked as sold before you can leave a review.';
  }
  if (status === 403) {
    return 'You are not authorized to review this transaction.';
  }

  const serverMsg = axiosErr?.response?.data?.error?.message;
  return serverMsg ?? 'Something went wrong. Please try again.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WriteReviewScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ WriteReview: WriteReviewRouteParams }, 'WriteReview'>>();
  const { listingId, revieweeId, revieweeName, listingTitle } = route.params;

  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: '',
    },
  });

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (values: ReviewFormValues) => {
    setSubmitting(true);
    setApiError(null);

    try {
      await api.createReview({
        listingId,
        revieweeId,
        rating: values.rating,
        comment: values.comment || undefined,
      });

      Alert.alert('Review Submitted', 'Thank you for your feedback!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      setApiError(resolveApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
          <View style={styles.headerSection}>
            <Text style={styles.listingTitle} numberOfLines={2}>
              {listingTitle}
            </Text>
            <Text style={styles.revieweeLabel}>
              Review for{' '}
              <Text style={styles.revieweeName}>{revieweeName}</Text>
            </Text>
          </View>

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

          {/* ── Star rating ── */}
          <Text style={styles.sectionLabel}>YOUR RATING</Text>
          <Controller
            control={control}
            name="rating"
            render={({ field: { onChange, value } }) => (
              <View
                style={styles.starRow}
                accessibilityLabel="Select star rating"
                accessibilityHint="Tap a star to set your rating from 1 to 5"
              >
                <InteractiveStarRating
                  rating={value}
                  onRatingChange={onChange}
                  size={40}
                />
              </View>
            )}
          />
          {errors.rating ? (
            <Text
              style={styles.fieldError}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {errors.rating.message}
            </Text>
          ) : null}

          {/* ── Comment ── */}
          <Controller
            control={control}
            name="comment"
            render={({ field: { onChange, onBlur, value } }) => (
              <FormInput
                label="Comment"
                placeholder="Share your experience (optional)"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.comment?.message}
                multiline
                numberOfLines={5}
                style={styles.commentInput}
                maxLength={1000}
                textAlignVertical="top"
                returnKeyType="default"
                accessibilityLabel="Review comment"
                accessibilityHint="Optional text feedback, up to 1000 characters"
              />
            )}
          />

          {/* ── Submit ── */}
          <View style={styles.submitContainer}>
            <PrimaryButton
              label="Submit Review"
              loading={submitting}
              onPress={handleSubmit(onSubmit)}
              accessibilityLabel="Submit review"
              accessibilityHint="Submits your rating and feedback"
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
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xxl,
  },

  // Header
  headerSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  listingTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  revieweeLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  revieweeName: {
    ...typography.body,
    color: colors.primaryDark,
    fontWeight: '600',
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

  // Star rating
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  starRow: {
    marginBottom: spacing.sm,
  },
  fieldError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },

  // Comment
  commentInput: {
    minHeight: 120,
  },

  // Submit
  submitContainer: {
    marginTop: spacing.lg,
  },
});
