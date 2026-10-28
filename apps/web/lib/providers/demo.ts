import { demoGames, type Game } from '@vanta-edge/shared';
import type { GamesQuery, SportsDataProvider } from './types';

export { demoGames };

// Fixtures live in @vanta-edge/shared so web and mobile show identical, labelled demo data.
export class DemoProvider implements SportsDataProvider {
  readonly id = 'demo';
  readonly isDemo = true;
  constructor(private readonly now: () => Date = () => new Date()) {}

  async listGames(q: GamesQuery): Promise<Game[]> {
    return demoGames(this.now())
      .filter((g) => !q.sport || g.sport === q.sport)
      .filter((g) => !q.from || g.startsAt >= new Date(q.from).toISOString())
      .filter((g) => !q.to || g.startsAt <= new Date(q.to).toISOString())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, q.limit);
  }

  async getGame(id: string): Promise<Game | null> {
    return demoGames(this.now()).find((g) => g.id === id) ?? null;
  }
}
