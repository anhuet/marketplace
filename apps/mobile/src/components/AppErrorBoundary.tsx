import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Top-level error boundary that catches unhandled JS render errors and
 * displays a Vietnamese-language recovery screen instead of a white screen.
 *
 * Placed inside SafeAreaProvider (in App.tsx) so the fallback UI respects
 * safe-area insets even on notched devices.
 *
 * Errors are logged via console.error (the only permitted production logger
 * in this project — intentional exception per CLAUDE.md rule 6).
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // Intentional console.error — approved error-reporting path for this project
    // (no Sentry; see crash-fix spec). eslint-disable-next-line is deliberate.
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary] Unhandled render error:', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
          ⚠️
        </Text>
        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel="Đã xảy ra lỗi không mong muốn"
        >
          Đã xảy ra lỗi
        </Text>
        <Text style={styles.body} accessibilityRole="text">
          Ứng dụng gặp sự cố không mong muốn. Vui lòng thử lại.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={this.handleRetry}
          accessibilityRole="button"
          accessibilityLabel="Thử lại"
          accessibilityHint="Khởi động lại màn hình ứng dụng"
        >
          <Text style={styles.buttonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  emoji: {
    fontSize: 48,
    lineHeight: 56,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  button: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '700',
  },
});
