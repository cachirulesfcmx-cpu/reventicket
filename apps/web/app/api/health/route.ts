import { NextResponse } from 'next/server';
export async function GET(){return NextResponse.json({ok:true,service:'vanta-edge-web',mode:process.env.PREDICTIONS_ENABLED==='true'?'configured':'safe-demo',timestamp:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})}
