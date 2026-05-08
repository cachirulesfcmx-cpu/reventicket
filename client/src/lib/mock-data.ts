import { addDays, format } from "date-fns";

export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string;
  image: string;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  basePrice: number;
}

export interface Event {
  id: string;
  title: string;
  category: "Concert" | "Sports" | "Theater" | "Family" | "F1";
  date: Date;
  venueId: string;
  image: string;
  minPrice: number;
  tags: string[];
}

export interface Ticket {
  id: string;
  eventId: string;
  zoneId: string;
  row: string;
  seat: string;
  price: number;
  sellerId: string;
}

export const VENUES: Venue[] = [
  {
    id: "v1",
    name: "Estadio Azteca",
    city: "CDMX",
    address: "Tlalpan, CDMX",
    image: "/assets/cat-soccer.jpg"
  },
  {
    id: "v2",
    name: "Foro Sol",
    city: "CDMX",
    address: "Iztacalco, CDMX",
    image: "/assets/hero-concert.jpg"
  },
  {
    id: "v3",
    name: "Autódromo Hermanos Rodríguez",
    city: "CDMX",
    address: "Iztacalco, CDMX",
    image: "/assets/cat-f1.jpg"
  }
];

export const ZONES: Zone[] = [
  { id: "vip", name: "VIP / Cancha", color: "#FCD34D", basePrice: 5000 }, // yellow-300
  { id: "lower", name: "Grada Baja", color: "#60A5FA", basePrice: 2500 }, // blue-400
  { id: "middle", name: "Grada Media", color: "#A78BFA", basePrice: 1500 }, // violet-400
  { id: "upper", name: "General / Alta", color: "#F87171", basePrice: 800 }, // red-400
];

export const EVENTS: Event[] = [
  {
    id: "e1",
    title: "Gran Final: América vs Chivas",
    category: "Sports",
    date: addDays(new Date(), 5),
    venueId: "v1",
    image: "/assets/cat-soccer.jpg",
    minPrice: 800,
    tags: ["Popular", "Selling Fast", "Liga MX"]
  },
  {
    id: "e2",
    title: "Bad Bunny - World Tour",
    category: "Concert",
    date: addDays(new Date(), 12),
    venueId: "v2",
    image: "/assets/hero-concert.jpg",
    minPrice: 2500,
    tags: ["Global Top Seller", "Music"]
  },
  {
    id: "e3",
    title: "Formula 1 Gran Premio de México",
    category: "F1",
    date: addDays(new Date(), 45),
    venueId: "v3",
    image: "/assets/cat-f1.jpg",
    minPrice: 15000,
    tags: ["F1", "Premium"]
  },
  {
    id: "e4",
    title: "El Fantasma de la Ópera",
    category: "Theater",
    date: addDays(new Date(), 2),
    venueId: "v1", // Using v1 for demo
    image: "/assets/cat-theater.jpg",
    minPrice: 1200,
    tags: ["Culture", "Last Tickets"]
  },
  {
    id: "e5",
    title: "Metallica: M72 World Tour",
    category: "Concert",
    date: addDays(new Date(), 20),
    venueId: "v2",
    image: "https://images.unsplash.com/photo-1543716091-a840c05249ec?ixlib=rb-4.0.3",
    minPrice: 1800,
    tags: ["Rock", "Metal"]
  },
  {
    id: "e6",
    title: "NBA Mexico City Game",
    category: "Sports",
    date: addDays(new Date(), 30),
    venueId: "v1",
    image: "https://images.unsplash.com/photo-1504454172868-958378462371?ixlib=rb-4.0.3",
    minPrice: 3000,
    tags: ["NBA", "International"]
  }
];

export const POPULAR_TAGS = [
  "BTS", "Super Bowl LX", "Bruno Mars", "Mundial 2026",
  "Backstreet Boys", "Champions League", "Real Madrid",
  "La Liga", "Bad Bunny", "NBA", "Premier League", "Eagles",
  "My Chemical Romance", "Zoé"
];

// Helper to get venue
export const getVenue = (id: string) => VENUES.find(v => v.id === id);

// Generate some mock tickets for an event
export const generateTickets = (eventId: string): Ticket[] => {
  const tickets: Ticket[] = [];
  ZONES.forEach(zone => {
    // Generate 3-8 listings per zone
    const count = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < count; i++) {
      tickets.push({
        id: `t-${eventId}-${zone.id}-${i}`,
        eventId,
        zoneId: zone.id,
        row: String.fromCharCode(65 + Math.floor(Math.random() * 10)), // A-J
        seat: `${Math.floor(Math.random() * 20) + 1}`,
        price: zone.basePrice + Math.floor(Math.random() * 500),
        sellerId: "user-1"
      });
    }
  });
  return tickets.sort((a, b) => a.price - b.price);
};
