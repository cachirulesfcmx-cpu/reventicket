import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={{ headerShown: true, title: 'Ficha', headerStyle: { backgroundColor: colors.bg }, headerTintColor: colors.text }} />
      </Stack>
    </SafeAreaProvider>
  );
}
