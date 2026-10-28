import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Loading, Notice } from '../../components/States';
import { supabase } from '../../lib/supabase';

// Landing route for email confirmation and password recovery links (PKCE code exchange).
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; next?: string; error_description?: string }>();
  const invalidLink = !supabase || !params.code || !!params.error_description;
  const [exchangeFailed, setExchangeFailed] = useState(false);

  useEffect(() => {
    if (!supabase || !params.code || params.error_description) return;
    supabase.auth.exchangeCodeForSession(params.code).then(({ error: e }) => {
      if (e) setExchangeFailed(true);
      else router.replace(params.next === 'reset' ? '/reset-password' : '/(tabs)');
    });
  }, [params.code, params.next, params.error_description]);

  const error = invalidLink || exchangeFailed ? 'El enlace no es válido o expiró.' : null;
  if (!error) return <Screen><Loading label="Verificando enlace…" /></Screen>;
  return (
    <Screen title="No pudimos verificar el enlace">
      <Notice tone="error">{error}</Notice>
      <Button label="Ir a iniciar sesión" variant="secondary" onPress={() => router.replace('/login')} />
    </Screen>
  );
}
