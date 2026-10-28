import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** null while unknown; false only when the OS reports no connectivity. */
export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)), []);
  return online;
}
