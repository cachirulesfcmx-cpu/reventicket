/**
 * In-memory cache with TTL support
 * Falls back to in-memory when Redis is not available
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag: string;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private generateETag(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `"${Math.abs(hash).toString(16)}"`;
  }

  async get<T>(key: string): Promise<{ data: T; etag: string } | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    
    return { data: entry.data, etag: entry.etag };
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<string> {
    const etag = this.generateETag(data);
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      etag
    });
    return etag;
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }

  async invalidateKey(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys())
    };
  }
}

export const cache = new MemoryCache();

// Cache key generators (uses string IDs to match storage layer)
export const CacheKeys = {
  events: () => 'events:all',
  eventsByCategory: (category: string) => `events:category:${category}`,
  event: (id: string) => `event:${id}`,
  eventBySlug: (slug: string) => `event:slug:${slug}`,
  venues: () => 'venues:all',
  venue: (id: string) => `venue:${id}`,
  zones: (eventId: string) => `zones:event:${eventId}`,
  tickets: (eventId: string, zoneId?: string) => 
    zoneId ? `tickets:event:${eventId}:zone:${zoneId}` : `tickets:event:${eventId}`,
  availability: (eventId: string) => `availability:${eventId}`,
  popular: () => 'events:popular',
  trending: (city?: string) => city ? `events:trending:${city}` : 'events:trending',
  recommendations: (userId: string) => `reco:user:${userId}`,
  similar: (eventId: string) => `reco:similar:${eventId}`,
};

// TTL configurations (in seconds)
export const CacheTTL = {
  events: 60,           // 1 minute for active event lists
  eventDetail: 120,     // 2 minutes for event details
  venues: 300,          // 5 minutes for venue data
  zones: 30,            // 30 seconds for zone availability
  tickets: 15,          // 15 seconds for ticket availability (hot data)
  popular: 120,         // 2 minutes for popular events
  trending: 180,        // 3 minutes for trending
  recommendations: 300, // 5 minutes for recommendations
  historical: 1800,     // 30 minutes for historical data
};

// Invalidation helpers
export async function invalidateEventCache(eventId?: string): Promise<void> {
  await cache.invalidate('events:*');
  await cache.invalidateKey(CacheKeys.popular());
  await cache.invalidate('events:trending*');
  if (eventId) {
    await cache.invalidateKey(CacheKeys.event(eventId));
    await cache.invalidateKey(CacheKeys.zones(eventId));
    await cache.invalidate(`tickets:event:${eventId}*`);
    await cache.invalidateKey(CacheKeys.availability(eventId));
  }
}

export async function invalidateTicketCache(eventId: string, zoneId?: string): Promise<void> {
  await cache.invalidateKey(CacheKeys.availability(eventId));
  if (zoneId) {
    await cache.invalidateKey(CacheKeys.tickets(eventId, zoneId));
  } else {
    await cache.invalidate(`tickets:event:${eventId}*`);
  }
  await cache.invalidateKey(CacheKeys.zones(eventId));
}
