import { GamesQuerySchema } from '@vanta-edge/shared';
import { handler, json } from '@/lib/http';
import { getProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = GamesQuerySchema.safeParse(params);
  if (!parsed.success) {
    return json({ error: 'invalid_query', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }, 400);
  }
  const provider = getProvider();
  const data = await provider.listGames(parsed.data);
  return json({
    data, source: provider.id, isDemo: provider.isDemo,
    note: provider.isDemo ? 'Datos de demostración: partidos ficticios, no son calendarios confirmados.' : 'Datos del proveedor almacenados en la base.',
  });
});
