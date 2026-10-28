import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  right?: ReactNode;
  disabled?: boolean;
  testID?: string;
};

/** Large glass selection card. Selection is shown by border, fill AND a check mark (not color alone). */
export function Choice({ title, subtitle, selected, onPress, right, disabled, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      aria-selected={selected} aria-checked={selected} aria-disabled={!!disabled}
      style={({ pressed }) => [styles.card, selected && styles.selected, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      <View style={[styles.check, selected && styles.checkOn]} importantForAccessibility="no-hide-descendants">
        {selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 84, paddingHorizontal: 18, paddingVertical: 16, borderRadius: radii.lg, borderWidth: 1,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.045)', flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  selected: { borderColor: colors.selectedBorder, backgroundColor: colors.selected, borderWidth: 2 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  text: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: '500' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.violet, borderColor: colors.lilac },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
