import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';

export default function UserProfileScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>User Profile Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  text: { color: colors.textPrimary },
});
