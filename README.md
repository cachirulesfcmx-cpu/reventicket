# VANTA EDGE — Sports Intelligence Platform

Monorepo starter for a mobile-first sports analytics product covering Liga MX, UEFA Champions League, LaLiga, NFL, MLB and NBA. Includes Expo mobile app, Next.js web dashboard/API, Supabase schema with RLS, and a Python prediction-service baseline.

> Important: this is a functional development baseline, not a claim of production-grade predictive edge. Demo data is explicitly labeled. No betting transactions, wallets, or wagering integrations are implemented. Probabilities must be validated out-of-sample before being presented as reliable.

## Stack
- `apps/mobile`: Expo + React Native + TypeScript
- `apps/web`: Next.js App Router + TypeScript
- `packages/shared`: shared sports domain types
- `services/predictor`: FastAPI + scikit-learn baseline probability service
- `supabase/migrations`: PostgreSQL schema, RLS, indexes, audit-safe prediction records
- `.github/workflows`: CI checks

## Prerequisites
Node.js 20+, npm 10+, Python 3.11+, Git. Supabase project and Vercel account are needed for hosted deployment.

## Run locally
1. `cp .env.example .env.local` and fill in Supabase URL/public key when available. The web dashboard can render demo mode without credentials.
2. `npm install`
3. `npm run dev:web` (web at http://localhost:3000)
4. In another terminal: `npm run dev:mobile` (Expo QR; use Expo Go or simulator)
5. Predictor: `cd services/predictor && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app:app --reload --port 8001`

## Supabase setup
Use Supabase SQL Editor or Supabase CLI to apply migrations in lexical order. Never commit service-role keys. The app uses anon/publishable credentials in clients and RLS for user data. Server-only secrets belong in Vercel environment variables.

## Important release gates
- Configure a licensed data provider and confirm rights for commercial display, historical storage, logos, player photos and odds.
- Implement provider adapters and monitor freshness; never fabricate injuries, lineups, odds or live scores.
- Run chronological walk-forward backtests, compare against baselines and market-implied probabilities, calibrate, and preserve immutable prediction snapshots.
- `PREDICTIONS_ENABLED` defaults to false. Keep it false until model validation is approved.
- Verify Apple/Google policies, privacy, subscription and applicable legal requirements before store submission.

See `docs/CLAUDE_CODE_DEPLOYMENT_PROMPT.md` for the deployment and verification handoff.
