import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

/**
 * InviteCodeInput — single TextInput that always shows the fixed "MKT-" prefix
 * inline with the editable body. The prefix cannot be deleted: any user edit
 * that would remove it is rewritten so the prefix is restored, and the caret
 * is kept at or after the prefix boundary.
 *
 * The `value` prop and `onChangeValue` callback operate on the full formatted
 * code including the prefix, e.g. `MKT-L8ST-EMYF`.
 */

const PREFIX = 'MKT-';
const MAX_BODY_LENGTH = 9; // "XXXX-XXXX"
const MAX_TOTAL_LENGTH = PREFIX.length + MAX_BODY_LENGTH; // "MKT-XXXX-XXXX"

interface InviteCodeInputProps {
  value: string;
  onChangeValue: (fullCode: string) => void;
  error?: string;
  testID?: string;
}

function formatBody(raw: string): string {
  const stripped = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
  if (stripped.length <= 4) {
    return stripped;
  }
  return `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
}

export default function InviteCodeInput({
  value,
  onChangeValue,
  error,
  testID,
}: InviteCodeInputProps): React.JSX.Element {
  const inputRef = useRef<TextInput>(null);

  // Display value always carries the prefix.
  const displayValue = value.startsWith(PREFIX) ? value : PREFIX;

  const handleChangeText = (text: string) => {
    // If user deleted into the prefix, treat body as empty.
    const body = text.startsWith(PREFIX) ? text.slice(PREFIX.length) : '';
    const formatted = formatBody(body);
    onChangeValue(formatted.length > 0 ? `${PREFIX}${formatted}` : `${PREFIX}`);
  };

  // Keep the caret from entering the prefix region.
  const handleSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    const { start, end } = e.nativeEvent.selection;
    if (start < PREFIX.length || end < PREFIX.length) {
      inputRef.current?.setNativeProps({
        selection: {
          start: Math.max(start, PREFIX.length),
          end: Math.max(end, PREFIX.length),
        },
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="text">
        INVITE CODE
      </Text>
      <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={displayValue}
          onChangeText={handleChangeText}
          onSelectionChange={handleSelectionChange}
          placeholder={`${PREFIX}XXXX-XXXX`}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          keyboardType="default"
          maxLength={MAX_TOTAL_LENGTH}
          accessibilityLabel="Invite code — enter the 8 character code after MKT dash"
          accessibilityRole="text"
          accessibilityHint="Type the 8 alphanumeric characters. A dash is inserted automatically after the first 4."
          testID={testID}
        />
      </View>
      {error ? (
        <Text
          style={styles.error}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    letterSpacing: 2,
    paddingVertical: spacing.md,
    margin: 0,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
