import { handler, json } from '@/lib/http';
import { research } from '@/lib/research';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => json({ ...research, publicationEnabled: false }));
