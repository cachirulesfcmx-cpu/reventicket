import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { MapPin, ChevronRight, X, Flame, Star, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEvents, useVenues, type Event as APIEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkeletonShimmer, CarouselSkeleton } from "@/components/skeleton-shimmer";

const CATEGORIES = [
  { key: "festivals", label: "Festivales", emoji: "🎪", category: null, tags: ["festival", "edm", "rock"] },
  { key: "concerts", label: "Conciertos", emoji: "🎤", category: "Concert" },
  { key: "theater", label: "Teatro", emoji: "🎭", category: "Theater" },
  { key: "soccer", label: "Fútbol", emoji: "⚽", category: "Sports", tags: ["futbol", "soccer", "liga mx"] },
  { key: "baseball", label: "Béisbol", emoji: "⚾", category: "Sports", tags: ["beisbol", "baseball"] },
  { key: "basketball", label: "Basquetbol", emoji: "🏀", category: "Sports", tags: ["basquetbol", "basketball"] },
];

export default function Home() {
  const { data: events, isLoading, refetch, isFetching } = useEvents();
  const { data: venues } = useVenues();
  const [, navigate] = useLocation();
  const [selectedEventGroup, setSelectedEventGroup] = useState<{
    title: string;
    image: string | null;
    events: APIEvent[];
  } | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const eventsByTitle = useMemo(() => {
    if (!events) return new Map<string, APIEvent[]>();
    const grouped = new Map<string, APIEvent[]>();
    events.forEach(event => {
      const baseTitle = event.title.replace(/ - (Viernes|Sábado|Domingo|Paquete 3 Días|Zona Verde VIP|Domingo Carrera).*$/i, '').trim();
      const existing = grouped.get(baseTitle) || [];
      existing.push(event);
      grouped.set(baseTitle, existing);
    });
    return grouped;
  }, [events]);

  const popularEvents = useMemo(() => {
    if (!events) return [];
    return [...events].slice(0, 8);
  }, [events]);

  const featuredEvents = useMemo(() => {
    if (!events) return [];
    return [...events].slice(8, 16);
  }, [events]);

  const getEventsByCategory = (cat: typeof CATEGORIES[0]) => {
    if (!events) return [];
    return events.filter(e => {
      if (cat.category && e.category !== cat.category) return false;
      if (cat.tags) {
        const titleLower = e.title.toLowerCase();
        const tagsMatch = cat.tags.some(t => titleLower.includes(t));
        if (!tagsMatch && cat.category) return true;
        return tagsMatch || !cat.tags;
      }
      return true;
    }).slice(0, 10);
  };

  const handleEventClick = useCallback((event: APIEvent) => {
    const baseTitle = event.title.replace(/ - (Viernes|Sábado|Domingo|Paquete 3 Días|Zona Verde VIP|Domingo Carrera).*$/i, '').trim();
    const relatedEvents = eventsByTitle.get(baseTitle) || [event];
    
    if (relatedEvents.length > 1) {
      setSelectedEventGroup({
        title: baseTitle,
        image: event.image,
        events: relatedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      });
    } else {
      navigate(`/event/${event.id}`);
    }
  }, [eventsByTitle, navigate]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPulling && window.scrollY === 0) {
      const touch = e.touches[0];
      const distance = Math.min(touch.clientY / 3, 80);
      setPullDistance(distance);
    }
  }, [isPulling]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 60) {
      await refetch();
    }
    setPullDistance(0);
    setIsPulling(false);
  }, [pullDistance, refetch]);

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 pt-6 pb-8 space-y-8">
          <SkeletonShimmer className="h-48 w-full rounded-xl" />
          <div className="space-y-4">
            <SkeletonShimmer className="h-6 w-32" />
            <CarouselSkeleton count={4} large />
          </div>
          <div className="space-y-4">
            <SkeletonShimmer className="h-6 w-32" />
            <CarouselSkeleton count={5} />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div 
        className="min-h-screen"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to refresh indicator */}
        <AnimatePresence>
          {pullDistance > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: pullDistance }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center overflow-hidden"
            >
              <motion.div
                animate={{ rotate: pullDistance > 60 ? 360 : pullDistance * 3 }}
                transition={{ duration: 0.2 }}
              >
                <RefreshCw className={cn(
                  "h-6 w-6 text-primary",
                  isFetching && "animate-spin"
                )} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Popular Section */}
        <motion.section 
          className="py-6" 
          data-testid="section-popular"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="px-4 flex items-center gap-2 mb-4">
            <Flame className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-bold text-foreground">Populares</h2>
            <Link href="/search" className="ml-auto flex items-center gap-1 text-primary text-sm font-medium" data-testid="link-popular-ver-mas">
              Ver más <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <HorizontalScroll>
            {popularEvents.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                venues={venues}
                onClick={() => handleEventClick(event)}
                large
                index={index}
              />
            ))}
          </HorizontalScroll>
        </motion.section>

        {/* Featured Section */}
        <motion.section 
          className="py-6" 
          data-testid="section-featured"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="px-4 flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-foreground">Destacados</h2>
            <Link href="/search" className="ml-auto flex items-center gap-1 text-primary text-sm font-medium" data-testid="link-featured-ver-mas">
              Ver más <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <HorizontalScroll>
            {featuredEvents.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                venues={venues}
                onClick={() => handleEventClick(event)}
                index={index}
              />
            ))}
          </HorizontalScroll>
        </motion.section>

        {/* Category Sections */}
        {CATEGORIES.map((cat, catIndex) => {
          const catEvents = getEventsByCategory(cat);
          if (catEvents.length === 0) return null;
          
          return (
            <motion.section 
              key={cat.key} 
              className="py-6" 
              data-testid={`section-${cat.key}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + catIndex * 0.05 }}
            >
              <div className="px-4 flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-foreground">{cat.label}</h2>
                <Link 
                  href={`/search?category=${cat.category || ''}`} 
                  className="ml-auto flex items-center gap-1 text-primary text-sm font-medium"
                  data-testid={`link-${cat.key}-ver-mas`}
                >
                  Ver más <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <HorizontalScroll>
                {catEvents.map((event, index) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    venues={venues}
                    onClick={() => handleEventClick(event)}
                    index={index}
                  />
                ))}
              </HorizontalScroll>
            </motion.section>
          );
        })}

        {/* RevenProtect Section */}
        <motion.section 
          className="py-8 px-4" 
          data-testid="section-revenprotect"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-primary/20 rounded-xl">
                <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold text-primary">RevenProtect</h2>
                <p className="text-sm text-muted-foreground">Tu garantía de compra segura</p>
              </div>
            </div>
            <div className="grid gap-4">
              {[
                { icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", text: "Compra y vende con seguridad" },
                { icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z", text: "Soporte 24/7 vía WhatsApp" },
                { icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", text: "Pedidos garantizados al 100%" }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                >
                  <div className="p-2 bg-primary/10 rounded-full">
                    <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      </motion.div>

      {/* Dates Selection Modal */}
      <AnimatePresence>
        {selectedEventGroup && (
          <motion.div 
            className="fixed inset-0 z-50 bg-background flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="relative h-56 sm:h-72 overflow-hidden flex-shrink-0"
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <img 
                src={selectedEventGroup.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"} 
                alt={selectedEventGroup.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              
              <motion.button 
                onClick={() => setSelectedEventGroup(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                data-testid="close-dates-modal"
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-6 w-6" />
              </motion.button>
              
              <div className="absolute bottom-6 left-4 right-4">
                <h3 className="text-white font-heading font-bold text-2xl sm:text-3xl line-clamp-2">
                  {selectedEventGroup.title}
                </h3>
                <p className="text-white/70 text-sm mt-2">
                  {selectedEventGroup.events.length} fechas disponibles
                </p>
              </div>
            </motion.div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-muted-foreground mb-4 font-medium">
                Selecciona una fecha:
              </p>
              <div className="space-y-3">
                {selectedEventGroup.events.map((event, index) => {
                  const venue = venues?.find(v => v.id === event.venueId);
                  const dateLabel = event.title.includes("Viernes") ? "Viernes - Práctica Libre" :
                                   event.title.includes("Sábado") ? "Sábado - Clasificación" :
                                   event.title.includes("Domingo") || event.title.includes("Carrera") ? "Domingo - Carrera" :
                                   event.title.includes("Paquete") || event.title.includes("3 Días") ? "Paquete 3 Días" :
                                   event.title.includes("VIP") ? "Experiencia VIP" :
                                   format(new Date(event.date), "EEEE d 'de' MMMM", { locale: es });
                  
                  return (
                    <motion.button
                      key={event.id}
                      onClick={() => {
                        setSelectedEventGroup(null);
                        navigate(`/event/${event.id}`);
                      }}
                      className="w-full p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group bg-card"
                      data-testid={`date-option-${event.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-base capitalize text-foreground">
                            {dateLabel}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {format(new Date(event.date), "d 'de' MMMM yyyy • h:mm a", { locale: es })}
                          </div>
                          {venue && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-2">
                              <MapPin className="h-4 w-4" />
                              {venue.name}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          {event.minPrice && (
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Desde</div>
                              <span className="text-lg font-bold text-primary">
                                ${Math.round(parseFloat(event.minPrice)).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function HorizontalScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-2 scroll-snap-x">
      {children}
    </div>
  );
}

interface EventCardProps {
  event: APIEvent;
  venues?: Array<{ id: string; name: string; city: string; address: string | null; capacity: number | null; mapData: any; image: string | null }>;
  onClick?: () => void;
  large?: boolean;
  index?: number;
}

function EventCard({ event, venues, onClick, large, index = 0 }: EventCardProps) {
  const venue = venues?.find(v => v.id === event.venueId);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  return (
    <motion.div 
      onClick={onClick} 
      className={cn(
        "flex-shrink-0 cursor-pointer scroll-snap-start",
        large ? "w-64" : "w-40"
      )}
      data-testid={`event-card-${event.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className="overflow-hidden border-border bg-card shadow-lg hover:shadow-xl hover:shadow-primary/10 transition-all duration-300">
        <div className={cn(
          "relative overflow-hidden",
          large ? "aspect-[4/3]" : "aspect-[3/4]"
        )}>
          {!imageLoaded && (
            <SkeletonShimmer className="absolute inset-0" />
          )}
          <img 
            src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"} 
            alt={event.title} 
            className={cn(
              "w-full h-full object-cover transition-all duration-500",
              imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
            )}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {event.minPrice && (
            <motion.div 
              className="absolute top-2 right-2 bg-primary px-2 py-1 rounded text-xs font-bold text-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 + index * 0.05, type: "spring", stiffness: 300 }}
            >
              ${Math.round(parseFloat(event.minPrice))}
            </motion.div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-bold text-white text-sm leading-tight line-clamp-2 mb-1">
              {event.title}
            </h3>
            <p className="text-white/70 text-xs">
              {venue?.city || "México"}
            </p>
            <p className="text-primary text-xs font-medium mt-1">
              {format(new Date(event.date), "dd MMM yyyy - HH:mm", { locale: es })} hrs
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
