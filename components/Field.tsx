import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii } from '../lib/theme';

type Props = TextInputProps & { label: string; error?: string | null; help?: string };

export function Field({ label, error, help, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label} nativeID={`${label}-label`}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${label}-label`}
        placeholderTextColor={colors.faint}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...input}
      />
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : help ? <Text style={styles.help}>{help}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    minHeight: 50, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.text, fontSize: 16, paddingHorizontal: 16, paddingVertical: 12,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  help: { color: colors.faint, fontSize: 13, marginTop: 6 },
});
