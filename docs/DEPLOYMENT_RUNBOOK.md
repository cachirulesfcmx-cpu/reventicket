# Deployment runbook (initial)

## Vercel web
1. Import the repository into Vercel and set Root Directory to `apps/web` while preserving workspace installation from the repository root as required by Vercel's monorepo settings.
2. Build command: `npm run build:web` from the root, or the workspace-specific build command if the Vercel project is configured for the repository root. Confirm the chosen root/build setup in a Preview deployment.
3. Add only required environment variables in Vercel project settings. Public Supabase URL/key may be browser-visible; service-role key is server-only.
4. Deploy Preview first and run `/api/health`, `/api/games`, `/api/picks` smoke tests.
5. Promote to production only after authorization and successful checks.

## Supabase
1. Review SQL migration in a staging project.
2. Apply using Supabase CLI or SQL editor.
3. Verify tables, indexes, triggers and RLS policies.
4. Run anonymous and authenticated permission tests.
5. Configure backups and monitor logs before production use.

## Mobile
1. Run `npm run dev:mobile` from root.
2. Configure Expo/EAS project ID and signing credentials securely.
3. Build internal iOS and Android test builds before store submissions.
4. Store submission requires real-device QA, privacy details, screenshots and platform-policy review.

## Rollback
Revert the application deployment to the last known good commit. Database migrations should be forward-compatible; use a reviewed compensating migration rather than destructive rollback. Preserve audit records and prediction snapshots.
