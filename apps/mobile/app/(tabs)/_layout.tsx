import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { colors } from '../../lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} color={typeof color === 'string' ? color : colors.muted} size={size} />;
  };

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0B1712', borderTopColor: colors.line },
      tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="games" options={{ title: 'Partidos', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="picks" options={{ title: 'Picks', tabBarIcon: icon('analytics-outline') }} />
      <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Cuenta', tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
