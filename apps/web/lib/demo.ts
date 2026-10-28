import type { Game, Pick, Sport } from '@vanta-edge/shared';
const now = Date.now();
export const demoGames: Game[] = [
 {id:'demo-lmx-001',sport:'LIGA_MX',competition:'Liga MX',home:{id:'tigres',name:'Tigres UANL',shortName:'TIG'},away:{id:'pumas',name:'Pumas UNAM',shortName:'PUM'},startsAt:new Date(now+3*3600_000).toISOString(),status:'scheduled',dataQuality:'provisional'},
 {id:'demo-ucl-001',sport:'UCL',competition:'Champions League',home:{id:'arsenal',name:'Arsenal',shortName:'ARS'},away:{id:'inter',name:'Inter',shortName:'INT'},startsAt:new Date(now+24*3600_000).toISOString(),status:'scheduled',dataQuality:'provisional'},
 {id:'demo-laliga-001',sport:'LALIGA',competition:'LaLiga',home:{id:'barcelona',name:'Barcelona',shortName:'BAR'},away:{id:'atletico',name:'Atlético de Madrid',shortName:'ATM'},startsAt:new Date(now+30*3600_000).toISOString(),status:'scheduled',dataQuality:'provisional'},
 {id:'demo-nfl-001',sport:'NFL',competition:'NFL',home:{id:'chiefs',name:'Kansas City Chiefs',shortName:'KC'},away:{id:'bills',name:'Buffalo Bills',shortName:'BUF'},startsAt:new Date(now+48*3600_000).toISOString(),status:'scheduled',dataQuality:'provisional'},
 {id:'demo-mlb-001',sport:'MLB',competition:'MLB',home:{id:'dodgers',name:'Los Angeles Dodgers',shortName:'LAD'},away:{id:'mets',name:'New York Mets',shortName:'NYM'},startsAt:new Date(now+54*3600_000).toISOString(),status:'scheduled',dataQuality:'provisional'},
 {id:'demo-nba-001',sport:'NBA',competition:'NBA',home:{id:'celtics',name:'Boston Celtics',shortName:'BOS'},away:{id:'warriors',name:'Golden State Warriors',shortName:'GSW'},startsAt:new Date(now+60*3600_000).toISOString(),status:'scheduled',dataQuality:'provisional'}
];
export const demoPicks: Pick[] = demoGames.map((g,i)=>({id:`demo-pick-${i+1}`,gameId:g.id,sport:g.sport,market:'Ejemplo de mercado',selection:'Sin recomendación publicada',probability:0.5,confidenceLabel:'not_available',explanation:'Vista demostrativa. No hay datos de proveedor ni un modelo validado conectado; no es un pronóstico real.',publishedAt:new Date().toISOString(),isDemo:true}));
export function isSport(s: string): s is Sport { return ['LIGA_MX','UCL','LALIGA','NFL','MLB','NBA'].includes(s); }
