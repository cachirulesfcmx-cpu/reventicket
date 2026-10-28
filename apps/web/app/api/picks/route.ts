import { NextResponse } from 'next/server';
import { demoPicks } from '@/lib/demo';
export async function GET(){const enabled=process.env.PREDICTIONS_ENABLED==='true';return NextResponse.json({data:enabled?[]:demoPicks,source:enabled?'model-service-not-configured':'demo',isDemo:!enabled,publicationEnabled:enabled,note:enabled?'Prediction provider still must be configured and health-checked.':'Real picks disabled until out-of-sample validation and licensed data are configured.'},{headers:{'Cache-Control':'no-store'}})}
