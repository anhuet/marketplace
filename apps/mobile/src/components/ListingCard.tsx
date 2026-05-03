import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AccessibilityRole,
} from 'react-native';
import { Image } from 'expo-image';
import { ListingWithDetails, ListingImage } from '@marketplace/shared';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface ListingCardProps {
  listing: ListingWithDetails;
  onPress: (listing: ListingWithDetails) => void;
}

function formatPrice(price: string): string {
  const numericPrice = parseFloat(price);
  if (isNaN(numericPrice)) return price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericPrice);
}

function formatDistance(distanceKm: number | undefined): string {
  if (distanceKm === undefined || distanceKm === null) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

function ListingCard({ listing, onPress }: ListingCardProps): React.JSX.Element {
  const coverImageUrl: string | undefined =
    (listing as { coverImageUrl?: string }).coverImageUrl ??
    (listing.images?.find((img: ListingImage) => img.order === 0) ?? listing.images?.[0])?.url;
  const priceFormatted = formatPrice(listing.price);
  const distanceText = formatDistance(listing.distanceKm);
  const accessibilityLabel = [
    listing.title,
    priceFormatted,
    distanceText,
    listing.category?.name,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(listing)}
      activeOpacity={0.85}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens listing details"
    >
      <View style={styles.imageContainer}>
        {coverImageUrl ? (
          <Image
            source={{ uri: coverImageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            accessibilityLabel={`Photo of ${listing.title}`}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderText}>No image</Text>
          </View>
        )}
        {listing.category ? (
          <View style={styles.categoryBadge} accessibilityRole="text">
            <Text style={styles.categoryText} numberOfLines={1}>
              {listing.category.name}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={2}>
          {listing.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.price}>{priceFormatted}</Text>
          {distanceText ? (
            <Text style={styles.distance}>{distanceText}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(ListingCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    // Shadow — iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    // Elevation — Android
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: colors.border,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  imagePlaceholderText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  categoryBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: 140,
  },
  categoryText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: '600',
  },
  details: {
    padding: spacing.md,
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    ...typography.title,
    color: colors.primaryDark,
  },
  distance: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
