import type { NextConfig } from 'next';

// Vercel injects its toolbar (vercel.live) into preview deployments only; allow it there and
// keep the production policy strict.
const preview = process.env.VERCEL_ENV === 'preview';
const live = preview ? ' https://vercel.live' : '';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${live}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com${live}`,
  `font-src 'self' https://fonts.gstatic.com${preview ? ' https://vercel.live https://assets.vercel.com' : ''}`,
  "img-src 'self' data: https:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${preview ? ' https://vercel.live wss://ws-us3.pusher.com' : ''}`,
  `frame-src${preview ? ' https://vercel.live' : " 'none'"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@vanta-edge/shared'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ],
    }];
  },
};

export default nextConfig;
