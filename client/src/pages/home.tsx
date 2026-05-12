import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { MapPin, ChevronRight, X, Flame, Star, RefreshCw, Zap } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEvents, useVenues, type Event as APIEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback, useEffect } from "react";
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

// Category color map for neon badges
const CATEGORY_COLORS: Record<string, { bg: string; text: string; glow: string; border: string }> = {
  "Concert": { bg: "rgba(168,85,247,0.2)", text: "#c084fc", glow: "rgba(168,85,247,0.4)", border: "rgba(168,85,247,0.5)" },
  "Sports":  { bg: "rgba(34,197,94,0.2)",  text: "#4ade80", glow: "rgba(34,197,94,0.4)",  border: "rgba(34,197,94,0.5)" },
  "Theater": { bg: "rgba(251,191,36,0.2)", text: "#fbbf24", glow: "rgba(251,191,36,0.4)", border: "rgba(251,191,36,0.5)" },
  "F1":      { bg: "rgba(239,68,68,0.2)",  text: "#f87171", glow: "rgba(239,68,68,0.4)",  border: "rgba(239,68,68,0.5)" },
  "Family":  { bg: "rgba(96,165,250,0.2)", text: "#60a5fa", glow: "rgba(96,165,250,0.4)", border: "rgba(96,165,250,0.5)" },
};

const getCatColors = (category: string) =>
  CATEGORY_COLORS[category] || { bg: "rgba(74,222,128,0.2)", text: "#4ade80", glow: "rgba(74,222,128,0.4)", border: "rgba(74,222,128,0.5)" };

// ── HERO SLIDER ───────────────────────────────────────────────────────────────
function HeroSlider({ events, venues, onEventClick }: {
  events: APIEvent[];
  venues: any[];
  onEventClick: (e: APIEvent) => void;
}) {
  const [current, setCurrent] = useState(0);
  const featured = events.filter(e => (e as any).isFeatured).slice(0, 5);
  const slides = featured.length > 0 ? featured : events.slice(0, 5);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setCurrent(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  const ev = slides[current];
  const venue = venues?.find(v => v.id === ev.venueId);
  const colors = getCatColors(ev.category);

  return (
    <div className="relative w-full overflow-hidden" style={{ height: "420px" }}>
      <AnimatePresence mode="sync">
        <motion.div
          key={ev.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Background image */}
          <img
            src={ev.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=900"}
            alt={ev.title}
            className="w-full h-full object-cover"
          />

          {/* Gradient overlay — strong bottom fade */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.15) 40%, rgba(12,12,12,0.92) 80%, rgb(12,12,12) 100%)"
          }} />

          {/* Date pill top-left */}
          <div className="absolute top-4 left-4 z-10">
            <div style={{
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              borderRadius: "12px",
              padding: "6px 12px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
                {format(new Date(ev.date), "dd")}
              </div>
              <div style={{ fontSize: "12px", color: "#ccc", textTransform: "uppercase" }}>
                {format(new Date(ev.date), "MMM", { locale: es })}
              </div>
            </div>
          </div>

          {/* Content bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-10 p-5 pb-6">
            {/* Category + Trending badges */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                background: colors.bg, color: colors.text,
                border: `1px solid ${colors.border}`,
                boxShadow: `0 0 10px ${colors.glow}`,
                borderRadius: "999px", padding: "3px 10px",
                fontSize: "12px", fontWeight: 700,
              }}>
                {ev.category === "Concert" ? "🎤" : ev.category === "Sports" ? "⚽" : ev.category === "F1" ? "🏎️" : ev.category === "Theater" ? "🎭" : "🎪"}
                {" "}{ev.category === "Concert" ? "Concierto" : ev.category === "Sports" ? "Deportes" : ev.category}
              </span>
              {(ev as any).isFeatured && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  background: "rgba(74,222,128,0.15)", color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.4)",
                  boxShadow: "0 0 10px rgba(74,222,128,0.3)",
                  borderRadius: "999px", padding: "3px 10px",
                  fontSize: "12px", fontWeight: 700,
                }}>
                  <Zap className="h-3 w-3" /> Trending
                </span>
              )}
            </div>

            {/* Title with gradient */}
            <h2 style={{
              fontSize: "clamp(22px,5vw,32px)",
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: "8px",
              background: "linear-gradient(135deg, #ffffff 40%, #a3e635 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontFamily: "'Oswald', sans-serif",
              letterSpacing: "-0.01em",
            }}>
              {ev.title}
            </h2>

            {/* Location */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "rgba(255,255,255,0.7)", fontSize: "13px", marginBottom: "4px" }}>
              <MapPin className="h-3.5 w-3.5" style={{ flexShrink: 0 }} />
              {venue?.name || venue?.city || "México"}
            </div>

            {/* Date + Price row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>
                {format(new Date(ev.date), "dd 'de' MMMM yyyy - HH:mm", { locale: es })} hrs
              </span>
              {ev.minPrice && (
                <span style={{ color: "#4ade80", fontWeight: 700, fontSize: "18px" }}>
                  Desde ${Math.round(parseFloat(ev.minPrice)).toLocaleString()}
                </span>
              )}
            </div>

            {/* CTA button */}
            <motion.button
              onClick={() => onEventClick(ev)}
              whileTap={{ scale: 0.97 }}
              style={{
                width: "100%", marginTop: "14px",
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "#000", fontWeight: 800, fontSize: "15px",
                padding: "12px", borderRadius: "12px", border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(34,197,94,0.35)",
              }}
            >
              Ver boletos
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      {slides.length > 1 && (
        <div style={{
          position: "absolute", bottom: "130px", left: "50%",
          transform: "translateX(-50%)", display: "flex", gap: "6px", zIndex: 20,
        }}>
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? "22px" : "8px",
                height: "8px",
                borderRadius: "999px",
                background: i === current ? "#4ade80" : "rgba(255,255,255,0.4)",
                border: "none", cursor: "pointer", padding: 0,
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── EVENT CARD (horizontal scroll) ────────────────────────────────────────────
interface EventCardProps {
  event: APIEvent;
  venues?: any[];
  onClick?: () => void;
  large?: boolean;
  index?: number;
}

function EventCard({ event, venues, onClick, large, index = 0 }: EventCardProps) {
  const venue = venues?.find(v => v.id === event.venueId);
  const [imageLoaded, setImageLoaded] = useState(false);
  const colors = getCatColors(event.category);

  return (
    <motion.div
      onClick={onClick}
      className={cn("flex-shrink-0 cursor-pointer scroll-snap-start", large ? "w-64" : "w-40")}
      data-testid={`event-card-${event.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Card style={{
        overflow: "hidden",
        border: `1px solid ${colors.border}`,
        background: "#1a1a1a",
        boxShadow: `0 0 16px ${colors.glow}, 0 4px 20px rgba(0,0,0,0.4)`,
        transition: "all 0.3s ease",
      }}>
        <div className={cn("relative overflow-hidden", large ? "aspect-[4/3]" : "aspect-[3/4]")}>
          {!imageLoaded && <SkeletonShimmer className="absolute inset-0" />}
          <img
            src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"}
            alt={event.title}
            className={cn("w-full h-full object-cover transition-all duration-500", imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105")}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {event.minPrice && (
            <motion.div
              style={{
                position: "absolute", top: "8px", right: "8px",
                background: colors.bg, color: colors.text,
                border: `1px solid ${colors.border}`,
                boxShadow: `0 0 8px ${colors.glow}`,
                borderRadius: "6px", padding: "2px 8px",
                fontSize: "12px", fontWeight: 700,
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 + index * 0.05, type: "spring", stiffness: 300 }}
            >
              ${Math.round(parseFloat(event.minPrice))}
            </motion.div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-bold text-white text-sm leading-tight line-clamp-2 mb-1">{event.title}</h3>
            <p className="text-white/70 text-xs">{venue?.city || "México"}</p>
            <p className="text-xs font-medium mt-1" style={{ color: colors.text }}>
              {format(new Date(event.date), "dd MMM yyyy - HH:mm", { locale: es })} hrs
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function HorizontalScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 pb-2 scroll-snap-x">
      {children}
    </div>
  );
}

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: events, isLoading, refetch, isFetching } = useEvents();
  const { data: venues } = useVenues();
  const [, navigate] = useLocation();
  const [selectedEventGroup, setSelectedEventGroup] = useState<{
    title: string; image: string | null; events: APIEvent[];
  } | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const eventsByTitle = useMemo(() => {
    if (!events) return new Map<string, APIEvent[]>();
    const grouped = new Map<string, APIEvent[]>();
    events.forEach(event => {
      const baseTitle = event.title.replace(/ - (Viernes|Sábado|Domingo|Paquete 3 Días|Zona Verde VIP|Domingo Carrera).*$/i, "").trim();
      const existing = grouped.get(baseTitle) || [];
      existing.push(event);
      grouped.set(baseTitle, existing);
    });
    return grouped;
  }, [events]);

  const popularEvents = useMemo(() => events ? [...events].slice(0, 8) : [], [events]);
  const featuredEvents = useMemo(() => events ? [...events].slice(8, 16) : [], [events]);

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
    const baseTitle = event.title.replace(/ - (Viernes|Sábado|Domingo|Paquete 3 Días|Zona Verde VIP|Domingo Carrera).*$/i, "").trim();
    const relatedEvents = eventsByTitle.get(baseTitle) || [event];
    if (relatedEvents.length > 1) {
      setSelectedEventGroup({ title: baseTitle, image: event.image, events: relatedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) });
    } else {
      navigate(`/event/${event.id}`);
    }
  }, [eventsByTitle, navigate]);

  const handleTouchStart = useCallback(() => { if (window.scrollY === 0) setIsPulling(true); }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPulling && window.scrollY === 0) setPullDistance(Math.min(e.touches[0].clientY / 3, 80));
  }, [isPulling]);
  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 60) await refetch();
    setPullDistance(0); setIsPulling(false);
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
        {/* Pull to refresh */}
        <AnimatePresence>
          {pullDistance > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: pullDistance }} exit={{ opacity: 0, height: 0 }} className="flex items-center justify-center overflow-hidden">
              <motion.div animate={{ rotate: pullDistance > 60 ? 360 : pullDistance * 3 }} transition={{ duration: 0.2 }}>
                <RefreshCw className={cn("h-6 w-6 text-primary", isFetching && "animate-spin")} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HERO SLIDER ── */}
        {events && events.length > 0 && (
          <HeroSlider
            events={events}
            venues={venues || []}
            onEventClick={handleEventClick}
          />
        )}

        {/* ── POPULARES ── */}
        <motion.section className="py-6" data-testid="section-popular" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="px-4 flex items-center gap-2 mb-4">
            <Flame className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-bold text-foreground">Populares</h2>
            <Link href="/search" className="ml-auto flex items-center gap-1 text-primary text-sm font-medium" data-testid="link-popular-ver-mas">
              Ver más <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <HorizontalScroll>
            {popularEvents.map((event, index) => (
              <EventCard key={event.id} event={event} venues={venues} onClick={() => handleEventClick(event)} large index={index} />
            ))}
          </HorizontalScroll>
        </motion.section>

        {/* ── DESTACADOS ── */}
        <motion.section className="py-6" data-testid="section-featured" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="px-4 flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-foreground">Destacados</h2>
            <Link href="/search" className="ml-auto flex items-center gap-1 text-primary text-sm font-medium" data-testid="link-featured-ver-mas">
              Ver más <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <HorizontalScroll>
            {featuredEvents.map((event, index) => (
              <EventCard key={event.id} event={event} venues={venues} onClick={() => handleEventClick(event)} index={index} />
            ))}
          </HorizontalScroll>
        </motion.section>

        {/* ── CATEGORÍAS ── */}
        {CATEGORIES.map((cat, catIndex) => {
          const catEvents = getEventsByCategory(cat);
          if (!catEvents.length) return null;
          return (
            <motion.section key={cat.key} className="py-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 + catIndex * 0.05 }}>
              <div className="px-4 flex items-center gap-2 mb-4">
                <span className="text-xl">{cat.emoji}</span>
                <h2 className="text-lg font-bold text-foreground">{cat.label}</h2>
                <Link href={`/search?category=${cat.category || ""}`} className="ml-auto flex items-center gap-1 text-primary text-sm font-medium">
                  Ver más <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <HorizontalScroll>
                {catEvents.map((event, index) => (
                  <EventCard key={event.id} event={event} venues={venues} onClick={() => handleEventClick(event)} index={index} />
                ))}
              </HorizontalScroll>
            </motion.section>
          );
        })}

        {/* RevenProtect banner */}
        <motion.section className="px-4 py-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <div style={{ background: "linear-gradient(135deg,rgba(74,222,128,0.08),rgba(34,197,94,0.04))", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "16px", padding: "20px" }}>
            <div className="flex items-start gap-3">
              <div style={{ width: 40, height: 40, borderRadius: "10px", background: "rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div className="font-bold text-foreground mb-1">RevenProtect™ — Tu garantía de compra</div>
                <div className="text-sm text-muted-foreground">Boletos verificados · Soporte 24/7 vía WhatsApp · Reembolso garantizado</div>
              </div>
            </div>
          </div>
        </motion.section>
      </motion.div>

      {/* Date selection modal */}
      <AnimatePresence>
        {selectedEventGroup && (
          <motion.div className="fixed inset-0 z-50 bg-background flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <motion.div className="relative h-56 sm:h-72 overflow-hidden flex-shrink-0" initial={{ y: -20 }} animate={{ y: 0 }} transition={{ duration: 0.3 }}>
              <img src={selectedEventGroup.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"} alt={selectedEventGroup.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <motion.button onClick={() => setSelectedEventGroup(null)} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors" data-testid="close-dates-modal" whileTap={{ scale: 0.9 }}>
                <X className="h-6 w-6" />
              </motion.button>
              <div className="absolute bottom-6 left-4 right-4">
                <h3 className="text-white font-heading font-bold text-2xl sm:text-3xl line-clamp-2">{selectedEventGroup.title}</h3>
                <p className="text-white/70 text-sm mt-2">{selectedEventGroup.events.length} fechas disponibles</p>
              </div>
            </motion.div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-muted-foreground mb-4 font-medium">Selecciona una fecha:</p>
              <div className="space-y-3">
                {selectedEventGroup.events.map((event, index) => {
                  const venue = venues?.find(v => v.id === event.venueId);
                  const dateLabel = event.title.includes("Viernes") ? "Viernes - Práctica Libre" : event.title.includes("Sábado") ? "Sábado - Clasificación" : event.title.includes("Domingo") || event.title.includes("Carrera") ? "Domingo - Carrera" : event.title.includes("Paquete") || event.title.includes("3 Días") ? "Paquete 3 Días" : event.title.includes("VIP") ? "Experiencia VIP" : format(new Date(event.date), "EEEE d 'de' MMMM", { locale: es });
                  const colors = getCatColors(event.category);
                  return (
                    <motion.button key={event.id} onClick={() => { setSelectedEventGroup(null); navigate(`/event/${event.id}`); }} className="w-full p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group bg-card" data-testid={`date-option-${event.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileTap={{ scale: 0.98 }}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-base capitalize text-foreground">{dateLabel}</div>
                          <div className="text-sm text-muted-foreground mt-1">{format(new Date(event.date), "d 'de' MMMM yyyy • h:mm a", { locale: es })}</div>
                          {venue && <div className="text-sm text-muted-foreground flex items-center gap-1 mt-2"><MapPin className="h-4 w-4" />{venue.name}</div>}
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          {event.minPrice && (
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Desde</div>
                              <span className="text-lg font-bold" style={{ color: colors.text }}>${Math.round(parseFloat(event.minPrice)).toLocaleString()}</span>
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
