import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, typography } from '../theme/tokens';

interface ChatHeaderTitleProps {
  otherUserName?: string;
  otherUserAvatarUrl?: string | null;
  listingTitle: string;
}

export default function ChatHeaderTitle({
  otherUserName,
  otherUserAvatarUrl,
  listingTitle,
}: ChatHeaderTitleProps): React.JSX.Element {
  const displayName = otherUserName ?? 'Chat';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Chat with ${displayName} about ${listingTitle}`}
    >
      {otherUserAvatarUrl ? (
        <Image
          source={{ uri: otherUserAvatarUrl }}
          style={styles.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityLabel={`${displayName}'s avatar`}
        />
      ) : (
        <View
          style={[styles.avatar, styles.avatarFallback]}
          accessibilityLabel={`${displayName}'s avatar`}
        >
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={styles.textContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.listing} numberOfLines={1}>
          {listingTitle}
        </Text>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: spacing.sm,
  },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.label,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  listing: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
