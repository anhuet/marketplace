import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

/**
 * InviteCodeInput — renders a fixed "MKT-" prefix label alongside an editable
 * TextInput that accepts exactly 8 alphanumeric characters and auto-inserts a
 * dash after the 4th character (producing `XXXX-XXXX`).
 *
 * The `value` prop and `onChangeValue` callback operate on the **full**
 * formatted code including the prefix, e.g. `MKT-L8ST-EMYF`.
 * Pass the returned value directly to the API — no further transformation needed.
 */

const PREFIX = 'MKT-';
const MAX_BODY_LENGTH = 9; // 4 chars + dash + 4 chars = "XXXX-XXXX"

interface InviteCodeInputProps {
  /** Full formatted value including the MKT- prefix, e.g. "MKT-L8ST-EMYF" */
  value: string;
  /** Called with the full formatted code, e.g. "MKT-L8ST-EMYF" */
  onChangeValue: (fullCode: string) => void;
  error?: string;
  testID?: string;
}

/**
 * Given raw user input, strips all non-alphanumeric chars, uppercases,
 * truncates to 8 chars, then re-inserts the dash after position 4.
 * Returns the body portion only (no MKT- prefix), e.g. "L8ST-EMYF".
 */
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

  // Derive the body portion that lives inside the TextInput (without "MKT-").
  // value is expected to be "" or "MKT-XXXX-XXXX".
  const bodyValue = value.startsWith(PREFIX) ? value.slice(PREFIX.length) : value;

  const handleChangeText = (text: string) => {
    const formatted = formatBody(text);
    onChangeValue(formatted.length > 0 ? `${PREFIX}${formatted}` : '');
  };

  // Prevent the user from deleting into the prefix region by blocking backspace
  // when the editable region is already empty.
  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Backspace' && bodyValue.length === 0) {
      e.preventDefault?.();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label} accessibilityRole="text">
        INVITE CODE
      </Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        {/* Static non-editable prefix */}
        <View style={styles.prefixContainer} pointerEvents="none">
          <Text style={styles.prefixText} accessibilityElementsHidden>
            {PREFIX}
          </Text>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={bodyValue}
          onChangeText={handleChangeText}
          onKeyPress={handleKeyPress}
          placeholder="XXXX-XXXX"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          keyboardType="default"
          maxLength={MAX_BODY_LENGTH}
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 56,
    overflow: 'hidden',
  },
  inputRowError: {
    borderColor: colors.error,
  },
  prefixContainer: {
    paddingLeft: spacing.base,
    paddingRight: spacing.xs,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  prefixText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    paddingRight: spacing.base,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
