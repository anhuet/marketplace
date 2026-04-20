import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/tokens';

interface InteractiveStarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  size?: number;
}

/**
 * Interactive star rating input for review forms.
 * Renders 5 tappable stars; tapping star i sets the rating to i (1–5).
 * Filled stars (★) are shown for indices <= current rating; empty stars (☆) for the rest.
 */
export default function InteractiveStarRating({
  rating,
  onRatingChange,
  size = 32,
}: InteractiveStarRatingProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {Array.from({ length: 5 }, (_, i) => {
        const index = i + 1;
        const filled = index <= rating;

        return (
          <TouchableOpacity
            key={index}
            onPress={() => onRatingChange(index)}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${index} out of 5 stars`}
            accessibilityState={{ selected: filled }}
            hitSlop={{ top: spacing.xs, bottom: spacing.xs, left: spacing.xs, right: spacing.xs }}
          >
            <Text
              style={[
                styles.star,
                { fontSize: size, lineHeight: size + 4 },
                filled ? styles.starFilled : styles.starEmpty,
              ]}
            >
              {filled ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        );
      })}
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
    // base star text style — size applied inline
  },
  starFilled: {
    color: '#F6AD55',
  },
  starEmpty: {
    color: colors.border,
  },
});
