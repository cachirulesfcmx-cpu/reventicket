/**
 * SEO utilities for generating slugs, metadata, and structured data
 */

export function generateSlug(parts: string[]): string {
  return parts
    .map(part => 
      part
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with dashes
        .replace(/^-+|-+$/g, '')          // Trim leading/trailing dashes
    )
    .filter(Boolean)
    .join('-');
}

export function generateEventSlug(
  title: string, 
  venueName: string, 
  date: Date
): string {
  const year = date.getFullYear();
  return generateSlug([title, venueName, year.toString()]);
}

export interface EventMetadata {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: 'summary' | 'summary_large_image';
  canonicalUrl: string;
}

export function generateEventMetadata(event: {
  id: string;
  title: string;
  description?: string;
  category: string;
  date: Date;
  venueName: string;
  city: string;
  image?: string;
  slug: string;
  minPrice?: number;
}): EventMetadata {
  const formattedDate = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(event.date));

  const priceText = event.minPrice 
    ? ` desde $${event.minPrice.toLocaleString('es-MX')} MXN` 
    : '';

  const description = event.description || 
    `Compra boletos para ${event.title} en ${event.venueName}, ${event.city}. ${formattedDate}${priceText}. Entrega digital segura.`;

  return {
    title: `${event.title} - Boletos ${event.venueName} | RevenTicket`,
    description,
    ogTitle: `${event.title} | RevenTicket`,
    ogDescription: description,
    ogImage: event.image || '/og-default.jpg',
    twitterCard: 'summary_large_image',
    canonicalUrl: `/event/${event.id}`
  };
}

export interface EventJsonLd {
  '@context': string;
  '@type': string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  eventStatus: string;
  eventAttendanceMode: string;
  location: {
    '@type': string;
    name: string;
    address: {
      '@type': string;
      addressLocality: string;
      addressCountry: string;
    };
  };
  image?: string;
  offers?: {
    '@type': string;
    priceCurrency: string;
    lowPrice?: number;
    highPrice?: number;
    availability: string;
    url: string;
    validFrom: string;
  };
  organizer?: {
    '@type': string;
    name: string;
    url: string;
  };
  performer?: {
    '@type': string;
    name: string;
  };
}

export function generateEventJsonLd(event: {
  id: string;
  title: string;
  description?: string;
  date: Date;
  endDate?: Date;
  venueName: string;
  city: string;
  image?: string;
  slug: string;
  category: string;
  minPrice?: number;
  maxPrice?: number;
  ticketsAvailable?: number;
  artistName?: string;
}): EventJsonLd {
  const baseUrl = process.env.BASE_URL || 'https://reventicket.replit.app';
  const eventUrl = `${baseUrl}/event/${event.id}`;

  const jsonLd: EventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate: new Date(event.date).toISOString(),
    endDate: event.endDate ? new Date(event.endDate).toISOString() : undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venueName,
      address: {
        '@type': 'PostalAddress',
        addressLocality: event.city,
        addressCountry: 'MX'
      }
    },
    image: event.image,
    organizer: {
      '@type': 'Organization',
      name: 'RevenTicket',
      url: baseUrl
    }
  };

  if (event.minPrice !== undefined) {
    jsonLd.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'MXN',
      lowPrice: event.minPrice,
      highPrice: event.maxPrice,
      availability: event.ticketsAvailable && event.ticketsAvailable > 0 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/SoldOut',
      url: eventUrl,
      validFrom: new Date().toISOString()
    };
  }

  if (event.artistName) {
    jsonLd.performer = {
      '@type': 'PerformingGroup',
      name: event.artistName
    };
  }

  return jsonLd;
}

export function generateSitemapXml(events: Array<{
  id: string;
  slug: string;
  category: string;
  updatedAt?: Date;
  priority?: number;
}>): string {
  const baseUrl = process.env.BASE_URL || 'https://reventicket.replit.app';
  
  const staticPages = [
    { loc: '/', priority: 1.0, changefreq: 'daily' },
    { loc: '/search', priority: 0.9, changefreq: 'hourly' },
    { loc: '/category/conciertos', priority: 0.8, changefreq: 'daily' },
    { loc: '/category/deportes', priority: 0.8, changefreq: 'daily' },
    { loc: '/category/teatro', priority: 0.8, changefreq: 'daily' },
    { loc: '/category/f1', priority: 0.8, changefreq: 'daily' },
  ];

  const eventPages = events.map(event => ({
    loc: `/event/${event.id}`,
    priority: event.priority || 0.7,
    changefreq: 'hourly',
    lastmod: event.updatedAt ? new Date(event.updatedAt).toISOString().split('T')[0] : undefined
  }));

  const allPages = [...staticPages, ...eventPages];

  const urls = allPages.map(page => `
  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    ${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
