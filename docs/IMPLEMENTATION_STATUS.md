# Implementation status — initial package

| Area | Status | Evidence / limitation |
|---|---|---|
| Web dashboard | Starter implemented | Next.js page with responsive dark/glass UI and clearly labeled demo records |
| Mobile app | Starter implemented | Expo/React Native single-screen demo dashboard; device builds not yet run |
| Shared domain types | Implemented | Sport/game/pick TypeScript types |
| Web health route | Implemented | `/api/health` reports safe demo/configuration mode |
| Games and picks API | Demo only | No live sports provider connected |
| Supabase schema | Initial migration prepared | Must be applied and RLS tested against a real staging project |
| Predictor API | Baseline utility | Arithmetic helpers only; no trained predictive models or production picks |
| Model validation | Policy documented | No empirical model performance claims made |
| CI | Workflow prepared | Must be executed by GitHub Actions after repository push |
| Vercel/Supabase deployment | Not verified | Requires account/project access and explicit authorization |
| App Store/Google Play | Not published | Requires EAS credentials, device QA and store review |

This document reflects the starter source, not a completed deployment or production certification.
