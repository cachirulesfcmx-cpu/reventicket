import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Loading } from '../components/States';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // Only the generic message is shown; details stay in the developer console.
  console.error('Unhandled screen error', error?.name);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', textAlign: 'center' }}>Algo salió mal</Text>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>Intenta de nuevo. Si el problema continúa, contáctanos.</Text>
      <Button label="Reintentar" onPress={retry} />
    </View>
  );
}

function RootStack() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }}><Loading /></View>;
  const signedIn = !!session;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="privacy" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tutor" />
        <Stack.Screen name="exam" />
        <Stack.Screen name="materials" />
        <Stack.Screen name="family" />
        <Stack.Screen name="plan/new" />
        <Stack.Screen name="plan/[id]" />
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
