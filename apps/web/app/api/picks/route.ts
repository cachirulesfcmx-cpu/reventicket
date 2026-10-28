import { handler, json } from '@/lib/http';
import { getPicks } from '@/lib/picks';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => json(await getPicks()));
