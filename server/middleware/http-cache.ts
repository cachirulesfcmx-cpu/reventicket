/**
 * HTTP Caching middleware with ETags and Cache-Control
 */
import { Request, Response, NextFunction } from 'express';
import { cache, CacheKeys, CacheTTL } from '../lib/cache';

interface CacheOptions {
  ttl: number;
  key: string;
  staleWhileRevalidate?: number;
}

export function httpCache(options: CacheOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = options.key;
    const cached = await cache.get<unknown>(cacheKey);

    if (cached) {
      // Check If-None-Match header
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag === cached.etag) {
        return res.status(304).end();
      }

      // Set cache headers
      const staleTime = options.staleWhileRevalidate || 60;
      res.setHeader('ETag', cached.etag);
      res.setHeader('Cache-Control', `public, max-age=${options.ttl}, stale-while-revalidate=${staleTime}`);
      res.setHeader('X-Cache', 'HIT');
      
      return res.json(cached.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);
    
    res.json = function(data: unknown) {
      // Cache the response
      cache.set(cacheKey, data, options.ttl).then(etag => {
        res.setHeader('ETag', etag);
      });
      
      const staleTime = options.staleWhileRevalidate || 60;
      res.setHeader('Cache-Control', `public, max-age=${options.ttl}, stale-while-revalidate=${staleTime}`);
      res.setHeader('X-Cache', 'MISS');
      
      return originalJson(data);
    };

    next();
  };
}

// Pre-configured cache middleware for common routes
export const cacheEvents = httpCache({
  key: CacheKeys.events(),
  ttl: CacheTTL.events,
  staleWhileRevalidate: 120
});

export const cacheVenues = httpCache({
  key: CacheKeys.venues(),
  ttl: CacheTTL.venues,
  staleWhileRevalidate: 300
});

export function cacheEventDetail(eventId: number) {
  return httpCache({
    key: CacheKeys.event(eventId),
    ttl: CacheTTL.eventDetail,
    staleWhileRevalidate: 60
  });
}

export function cacheZones(eventId: number) {
  return httpCache({
    key: CacheKeys.zones(eventId),
    ttl: CacheTTL.zones,
    staleWhileRevalidate: 30
  });
}

export function cacheTickets(eventId: number, zoneId?: number) {
  return httpCache({
    key: CacheKeys.tickets(eventId, zoneId),
    ttl: CacheTTL.tickets,
    staleWhileRevalidate: 15
  });
}
