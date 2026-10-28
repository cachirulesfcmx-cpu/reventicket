import { env, supabaseConfigured } from '@/lib/env';
import { handler, json } from '@/lib/http';
import { getProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

// Public liveness check: reports modes only, never configuration values.
export const GET = handler(async () => {
  const provider = getProvider();
  return json({
    ok: true,
    service: 'vanta-edge-web',
    dataMode: provider.isDemo ? 'demo' : 'live-database',
    predictionsFlag: env.predictionsEnabled,
    publicationRequiresApprovedModel: true,
    databaseConfigured: supabaseConfigured(),
    timestamp: new Date().toISOString(),
  });
}, { limit: 120 });
