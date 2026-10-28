import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '../lib/theme';

/** Translucent card. Blur is decorative (iOS only); the fill alone keeps text readable. */
export function Glass({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.glass, style]}>
      {Platform.OS === 'ios' ? <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    padding: 18,
  },
});
