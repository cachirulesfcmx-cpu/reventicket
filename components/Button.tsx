import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, gradients, radii, TOUCH } from '../lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, hint, style, testID }: Props) {
  const inactive = disabled || loading;
  const content = loading ? (
    <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.text} />
  ) : (
    <Text style={[styles.label, variant === 'danger' && { color: colors.danger }]}>{label}</Text>
  );
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      aria-disabled={!!inactive} aria-busy={!!loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill}>
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: TOUCH + 8, borderRadius: radii.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { alignSelf: 'stretch', minHeight: TOUCH + 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondary: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: 20 },
  danger: { borderWidth: 1, borderColor: 'rgba(255,122,133,0.5)', backgroundColor: colors.dangerFill, paddingHorizontal: 20 },
  ghost: { paddingHorizontal: 12 },
  label: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
