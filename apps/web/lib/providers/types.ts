import type { Game, Sport } from '@vanta-edge/shared';

export type GamesQuery = { sport?: Sport; from?: string; to?: string; limit: number };

/** Every data source (demo, database, licensed feed) implements this contract. */
export interface SportsDataProvider {
  readonly id: string;
  readonly isDemo: boolean;
  listGames(query: GamesQuery): Promise<Game[]>;
  getGame(id: string): Promise<Game | null>;
}
