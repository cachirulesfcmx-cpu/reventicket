import { NextResponse } from 'next/server';
import { demoGames } from '@/lib/demo';
export async function GET(){return NextResponse.json({data:demoGames,source:'demo',isDemo:true,note:'Demo records only; connect a licensed provider before production.'},{headers:{'Cache-Control':'no-store'}})}
