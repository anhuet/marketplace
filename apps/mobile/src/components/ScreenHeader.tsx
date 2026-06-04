import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/tokens';

interface ScreenHeaderProps {
  /** Screen title displayed in the centre of the header bar. */
  title: string;
  /**
   * When true (default), renders a back chevron on the left that calls
   * navigation.goBack(). Pass false to suppress it (e.g. root screens).
   */
  showBack?: boolean;
  /** Optional element rendered on the right side of the header. */
  rightElement?: React.ReactNode;
}

/**
 * Custom in-screen header bar that replaces the native UINavigationBar on
 * screens where iOS 26 UINavigationBar internals cause SIGABRT crashes during
 * push transitions (see iOS 26 UINavigationBar workaround in ARCHITECTURE.md).
 *
 * Uses useSafeAreaInsets() so the header sits correctly below the status bar
 * on both iOS (Dynamic Island, notch) and Android (status bar height varies).
 *
 * All interactive elements carry accessibilityLabel and accessibilityRole
 * per WCAG 2.1 AA mobile guidelines.
 */
export default function ScreenHeader({
  title,
  showBack = true,
  rightElement,
}: ScreenHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {/* Back button slot */}
        <View style={styles.sideSlot}>
          {showBack && navigation.canGoBack() ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Returns to the previous screen"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Title */}
        <Text
          style={styles.title}
          numberOfLines={1}
          accessibilityRole="header"
          accessibilityLabel={title}
        >
          {title}
        </Text>

        {/* Right slot */}
        <View style={styles.sideSlot}>{rightElement ?? null}</View>
      </View>
    </View>
  );
}

const HEADER_HEIGHT = 44;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  sideSlot: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...typography.title,
    color: colors.textPrimary,
  },
});
