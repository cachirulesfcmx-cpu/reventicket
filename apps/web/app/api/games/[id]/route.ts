import { GameIdSchema } from '@vanta-edge/shared';
import { handler, json } from '@/lib/http';
import { getProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = GameIdSchema.safeParse(id);
  if (!parsed.success) return json({ error: 'invalid_id' }, 400);
  const provider = getProvider();
  const game = await provider.getGame(parsed.data);
  if (!game) return json({ error: 'not_found' }, 404);
  return json({ data: game, source: provider.id, isDemo: provider.isDemo, prediction: null,
    predictionNote: 'Sin predicción publicada: ningún modelo validado para este deporte.' });
});
