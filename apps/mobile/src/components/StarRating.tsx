import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

interface StarRatingProps {
  rating: number;
  count?: number;
  size?: number;
  showNumeric?: boolean;
}

/**
 * Displays a row of star glyphs reflecting the given rating (0–5).
 * Half-stars are approximated by rounding to the nearest 0.5.
 * Optionally shows the numeric value and review count alongside the stars.
 */
export default function StarRating({
  rating,
  count,
  size = 16,
  showNumeric = true,
}: StarRatingProps): React.JSX.Element {
  // Round to nearest 0.5
  const rounded = Math.round(rating * 2) / 2;

  const stars = Array.from({ length: 5 }, (_, i) => {
    const index = i + 1;
    if (rounded >= index) {
      return 'full';
    }
    if (rounded >= index - 0.5) {
      return 'half';
    }
    return 'empty';
  });

  return (
    <View style={styles.row} accessibilityLabel={`${rating.toFixed(1)} out of 5 stars`}>
      {stars.map((type, i) => (
        <Text
          key={i}
          style={[styles.star, { fontSize: size, lineHeight: size + 4 }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {type === 'full' ? '★' : type === 'half' ? '⯨' : '☆'}
        </Text>
      ))}
      {showNumeric && (
        <Text style={styles.numeric}>
          {rating.toFixed(1)}
          {count !== undefined && count > 0 ? ` (${count})` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  star: {
    color: '#F6AD55',
  },
  numeric: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
});
