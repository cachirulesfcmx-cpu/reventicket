import type { Game, Sport } from './domain';

// Illustrative fixtures only: fictitious matchups and kickoff times relative to "now".
// Every record is flagged isDemo and the UI labels it "DEMO · partido ficticio".
const FIXTURES: [Sport, string, [string, string], [string, string], number][] = [
  ['LIGA_MX', 'Liga MX', ['Tigres UANL', 'TIG'], ['Pumas UNAM', 'PUM'], 3],
  ['LIGA_MX', 'Liga MX', ['Club América', 'AME'], ['Guadalajara', 'GDL'], 27],
  ['UCL', 'Champions League', ['Arsenal', 'ARS'], ['Inter', 'INT'], 24],
  ['UCL', 'Champions League', ['Real Madrid', 'RMA'], ['Bayern Múnich', 'BAY'], 50],
  ['LALIGA', 'LaLiga', ['Barcelona', 'BAR'], ['Atlético de Madrid', 'ATM'], 30],
  ['LALIGA', 'LaLiga', ['Real Sociedad', 'RSO'], ['Sevilla', 'SEV'], 54],
  ['NFL', 'NFL', ['Kansas City Chiefs', 'KC'], ['Buffalo Bills', 'BUF'], 48],
  ['NFL', 'NFL', ['Dallas Cowboys', 'DAL'], ['Philadelphia Eagles', 'PHI'], 72],
  ['MLB', 'MLB', ['Los Angeles Dodgers', 'LAD'], ['New York Mets', 'NYM'], 54],
  ['MLB', 'MLB', ['New York Yankees', 'NYY'], ['Boston Red Sox', 'BOS'], 78],
  ['NBA', 'NBA', ['Boston Celtics', 'BOS'], ['Golden State Warriors', 'GSW'], 60],
  ['NBA', 'NBA', ['Denver Nuggets', 'DEN'], ['Los Angeles Lakers', 'LAL'], 84],
];

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

export function demoGames(now: Date = new Date()): Game[] {
  const base = new Date(now);
  base.setUTCMinutes(0, 0, 0);
  return FIXTURES.map(([sport, competition, home, away, hours], i) => ({
    id: `demo-${sport.toLowerCase()}-${i + 1}`,
    sport,
    competition,
    home: { id: slug(home[0]), name: home[0], shortName: home[1] },
    away: { id: slug(away[0]), name: away[0], shortName: away[1] },
    startsAt: new Date(base.getTime() + hours * 3_600_000).toISOString(),
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    dataQuality: 'provisional',
    sourceUpdatedAt: null,
    isDemo: true,
  }));
}
