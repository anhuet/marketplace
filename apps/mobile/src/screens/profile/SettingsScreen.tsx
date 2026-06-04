import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '../../theme/tokens';
import ScreenHeader from '../../components/ScreenHeader';

export default function SettingsScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScreenHeader title="Settings" />
      <View style={styles.content}>
        <Text style={styles.placeholder}>Settings coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
