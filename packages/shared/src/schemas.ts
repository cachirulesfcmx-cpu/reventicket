import { z } from 'zod';
import { SPORTS } from './domain';

export const SportSchema = z.enum(SPORTS);

export const GamesQuerySchema = z.object({
  sport: SportSchema.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'from must be before to' });

export const GameIdSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);

/** Validates and sanitises a provider event before it reaches storage or the UI. */
export const ProviderGameSchema = z.object({
  providerEventId: z.string().trim().min(1).max(120),
  sport: SportSchema,
  competition: z.string().trim().min(1).max(80),
  season: z.string().trim().max(20).nullable().optional(),
  home: z.object({ providerTeamId: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(80), shortName: z.string().trim().min(1).max(8) }),
  away: z.object({ providerTeamId: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(80), shortName: z.string().trim().min(1).max(8) }),
  startsAt: z.iso.datetime({ offset: true }),
  status: z.enum(['scheduled', 'live', 'final', 'postponed', 'cancelled']),
  homeScore: z.number().int().min(0).max(300).nullable().optional(),
  awayScore: z.number().int().min(0).max(300).nullable().optional(),
  sourceUpdatedAt: z.iso.datetime({ offset: true }),
}).refine((g) => g.home.providerTeamId !== g.away.providerTeamId, { message: 'home and away must differ' })
  .refine((g) => g.status !== 'final' || (g.homeScore != null && g.awayScore != null), { message: 'final games need scores' });
export type ProviderGame = z.infer<typeof ProviderGameSchema>;

export const OddsSchema = z.object({
  market: z.string().trim().min(1).max(40),
  selection: z.string().trim().min(1).max(60),
  decimalOdds: z.number().gt(1).lt(1000),
  capturedAt: z.iso.datetime({ offset: true }),
});
