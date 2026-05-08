/**
 * Event recommendation system
 * Hybrid approach: popularity, content-based, and co-visitation
 */

interface EventData {
  id: string;
  title: string;
  category: string;
  city: string;
  venueId: string;
  date: Date;
  tags?: string[];
  artistName?: string;
}

interface UserSignals {
  viewedEvents: string[];
  cartedEvents: string[];
  purchasedEvents: string[];
  preferredCity?: string;
  preferredCategories: string[];
}

interface RecommendationResult {
  eventId: string;
  score: number;
  reason: string;
  reasonCode: 'popular' | 'trending' | 'similar' | 'same_venue' | 'same_category' | 'personalized' | 'cold_start';
}

// In-memory stores (would be Redis/DB in production)
const eventViews = new Map<string, number>();
const eventCarts = new Map<string, number>();
const eventPurchases = new Map<string, number>();
const coVisitation = new Map<string, number>(); // "eventA:eventB" -> count
const categoryPopularity = new Map<string, number>();
const cityPopularity = new Map<string, number>();

// Track event view
export function trackEventView(eventId: string, category: string, city: string): void {
  eventViews.set(eventId, (eventViews.get(eventId) || 0) + 1);
  categoryPopularity.set(category, (categoryPopularity.get(category) || 0) + 1);
  cityPopularity.set(city, (cityPopularity.get(city) || 0) + 1);
}

// Track add to cart
export function trackAddToCart(eventId: string): void {
  eventCarts.set(eventId, (eventCarts.get(eventId) || 0) + 1);
}

// Track purchase
export function trackPurchase(eventId: string): void {
  eventPurchases.set(eventId, (eventPurchases.get(eventId) || 0) + 1);
}

// Track co-visitation (within same session)
export function trackCoVisitation(eventIds: string[]): void {
  for (let i = 0; i < eventIds.length; i++) {
    for (let j = i + 1; j < eventIds.length; j++) {
      const key = eventIds[i] < eventIds[j] 
        ? `${eventIds[i]}:${eventIds[j]}`
        : `${eventIds[j]}:${eventIds[i]}`;
      coVisitation.set(key, (coVisitation.get(key) || 0) + 1);
    }
  }
}

// Calculate popularity score
function getPopularityScore(eventId: string): number {
  const views = eventViews.get(eventId) || 0;
  const carts = eventCarts.get(eventId) || 0;
  const purchases = eventPurchases.get(eventId) || 0;
  
  // Weighted score: purchases > carts > views
  return (views * 1) + (carts * 5) + (purchases * 10);
}

// Get popular events
export function getPopularEvents(limit: number = 10): RecommendationResult[] {
  const scores: Array<{ eventId: string; score: number }> = [];
  
  for (const [eventId, views] of eventViews.entries()) {
    scores.push({ eventId, score: getPopularityScore(eventId) });
  }
  
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => ({
      eventId: item.eventId,
      score: item.score,
      reason: 'Evento popular',
      reasonCode: 'popular' as const
    }));
}

// Get trending events (recent velocity)
export function getTrendingEvents(
  events: EventData[],
  city?: string,
  limit: number = 10
): RecommendationResult[] {
  const now = new Date();
  const results: RecommendationResult[] = [];
  
  for (const event of events) {
    // Filter by city if specified
    if (city && event.city !== city) continue;
    
    // Skip past events
    if (new Date(event.date) < now) continue;
    
    const popularity = getPopularityScore(event.id);
    const daysToEvent = Math.max(1, Math.ceil((new Date(event.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Boost score for events happening soon with high popularity
    const urgencyBoost = Math.max(0.5, 2 - (daysToEvent / 30));
    const score = popularity * urgencyBoost;
    
    results.push({
      eventId: event.id,
      score,
      reason: city ? `Tendencia en ${city}` : 'En tendencia',
      reasonCode: 'trending'
    });
  }
  
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Get similar events (content-based)
export function getSimilarEvents(
  sourceEvent: EventData,
  allEvents: EventData[],
  limit: number = 6
): RecommendationResult[] {
  const results: RecommendationResult[] = [];
  
  for (const event of allEvents) {
    if (event.id === sourceEvent.id) continue;
    if (new Date(event.date) < new Date()) continue;
    
    let similarityScore = 0;
    let reason = '';
    
    // Same category
    if (event.category === sourceEvent.category) {
      similarityScore += 30;
      reason = `Más ${sourceEvent.category}`;
    }
    
    // Same venue
    if (event.venueId === sourceEvent.venueId) {
      similarityScore += 25;
      reason = reason || 'En el mismo recinto';
    }
    
    // Same city
    if (event.city === sourceEvent.city) {
      similarityScore += 15;
    }
    
    // Tag overlap (if available)
    if (sourceEvent.tags && event.tags) {
      const overlap = sourceEvent.tags.filter(t => event.tags!.includes(t)).length;
      similarityScore += overlap * 10;
    }
    
    // Same artist
    if (sourceEvent.artistName && event.artistName === sourceEvent.artistName) {
      similarityScore += 40;
      reason = `Más de ${sourceEvent.artistName}`;
    }
    
    // Title similarity (simple word overlap)
    const sourceWords = new Set(sourceEvent.title.toLowerCase().split(/\s+/));
    const eventWords = event.title.toLowerCase().split(/\s+/);
    const wordOverlap = eventWords.filter(w => sourceWords.has(w)).length;
    similarityScore += wordOverlap * 5;
    
    if (similarityScore > 0) {
      results.push({
        eventId: event.id,
        score: similarityScore,
        reason: reason || 'Evento similar',
        reasonCode: 'similar'
      });
    }
  }
  
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Get events in same venue
export function getEventsInVenue(
  venueId: string,
  allEvents: EventData[],
  excludeEventId?: string,
  limit: number = 4
): RecommendationResult[] {
  const now = new Date();
  
  return allEvents
    .filter(e => e.venueId === venueId && e.id !== excludeEventId && new Date(e.date) > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit)
    .map(e => ({
      eventId: e.id,
      score: 50,
      reason: 'En este recinto',
      reasonCode: 'same_venue' as const
    }));
}

// Co-visitation based recommendations
export function getCoVisitationRecommendations(
  viewedEventIds: string[],
  allEvents: EventData[],
  limit: number = 6
): RecommendationResult[] {
  const scores = new Map<string, number>();
  
  for (const viewedId of viewedEventIds) {
    for (const [key, count] of coVisitation.entries()) {
      const [a, b] = key.split(':');
      if (a === viewedId) {
        scores.set(b, (scores.get(b) || 0) + count);
      } else if (b === viewedId) {
        scores.set(a, (scores.get(a) || 0) + count);
      }
    }
  }
  
  // Remove already viewed
  for (const id of viewedEventIds) {
    scores.delete(id);
  }
  
  const now = new Date();
  const validEventIds = new Set(allEvents.filter(e => new Date(e.date) > now).map(e => e.id));
  
  return Array.from(scores.entries())
    .filter(([id]) => validEventIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([eventId, score]) => ({
      eventId,
      score,
      reason: 'Porque viste eventos similares',
      reasonCode: 'personalized' as const
    }));
}

// Cold start recommendations
export function getColdStartRecommendations(
  allEvents: EventData[],
  city?: string,
  limit: number = 10
): RecommendationResult[] {
  const now = new Date();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  
  let events = allEvents.filter(e => new Date(e.date) > now);
  
  // Prefer events in user's city
  if (city) {
    const cityEvents = events.filter(e => e.city === city);
    if (cityEvents.length >= limit / 2) {
      events = [...cityEvents, ...events.filter(e => e.city !== city)];
    }
  }
  
  // Score by proximity + popularity
  const scored = events.map(e => {
    const daysToEvent = Math.ceil((new Date(e.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const proximityScore = Math.max(0, 100 - daysToEvent);
    const popularity = getPopularityScore(e.id);
    const catPopularity = categoryPopularity.get(e.category) || 0;
    
    return {
      eventId: e.id,
      score: proximityScore + (popularity * 0.5) + (catPopularity * 0.1),
      reason: daysToEvent <= 7 ? 'Próximamente' : 'Recomendado para ti',
      reasonCode: 'cold_start' as const
    };
  });
  
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// Main recommendation function
export function getHomeRecommendations(
  allEvents: EventData[],
  userSignals?: UserSignals,
  city?: string
): {
  forYou: RecommendationResult[];
  trending: RecommendationResult[];
  popular: RecommendationResult[];
  upcoming: RecommendationResult[];
} {
  const now = new Date();
  const futureEvents = allEvents.filter(e => new Date(e.date) > now);
  
  // Trending in city or overall
  const trending = getTrendingEvents(futureEvents, city, 8);
  
  // Popular overall
  const popular = getPopularEvents(8);
  
  // Upcoming (next 2 weeks)
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;
  const upcoming = futureEvents
    .filter(e => new Date(e.date).getTime() - now.getTime() < twoWeeks)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 8)
    .map(e => ({
      eventId: e.id,
      score: 50,
      reason: 'Próximamente',
      reasonCode: 'cold_start' as const
    }));
  
  // Personalized or cold start
  let forYou: RecommendationResult[];
  
  if (userSignals && userSignals.viewedEvents.length > 0) {
    forYou = getCoVisitationRecommendations(userSignals.viewedEvents, futureEvents, 8);
    if (forYou.length < 4) {
      // Supplement with category-based
      const preferredCats = userSignals.preferredCategories;
      const categoryRecs = futureEvents
        .filter(e => preferredCats.includes(e.category) && !userSignals.viewedEvents.includes(e.id))
        .slice(0, 8 - forYou.length)
        .map(e => ({
          eventId: e.id,
          score: 30,
          reason: `Más ${e.category}`,
          reasonCode: 'same_category' as const
        }));
      forYou = [...forYou, ...categoryRecs];
    }
  } else {
    forYou = getColdStartRecommendations(futureEvents, city, 8);
  }
  
  return { forYou, trending, popular, upcoming };
}

// Diversity filter - avoid too many similar recommendations
export function applyDiversity(
  recommendations: RecommendationResult[],
  events: EventData[],
  maxPerCategory: number = 3
): RecommendationResult[] {
  const eventMap = new Map(events.map(e => [e.id, e]));
  const categoryCounts = new Map<string, number>();
  const diverse: RecommendationResult[] = [];
  
  for (const rec of recommendations) {
    const event = eventMap.get(rec.eventId);
    if (!event) continue;
    
    const count = categoryCounts.get(event.category) || 0;
    if (count < maxPerCategory) {
      diverse.push(rec);
      categoryCounts.set(event.category, count + 1);
    }
  }
  
  return diverse;
}
