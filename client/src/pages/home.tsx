import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { MapPin, ChevronRight, X, RefreshCw, Heart, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEvents, useVenues, type Event as APIEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkeletonShimmer, CarouselSkeleton } from "@/components/skeleton-shimmer";

// ─── Neon colors per category ─────────────────────────────────────────────────

const NEON: Record<string, { text: string; glow: string; border: string; bg: string }> = {
  Concert: { text: "#c084fc", glow: "rgba(192,132,252,0.5)", border: "rgba(192,132,252,0.4)", bg: "rgba(192,132,252,0.15)" },
  Sports:  { text: "#4ade80", glow: "rgba(74,222,128,0.5)",  border: "rgba(74,222,128,0.4)",  bg: "rgba(74,222,128,0.15)" },
  Theater: { text: "#fb923c", glow: "rgba(251,146,60,0.5)",  border: "rgba(251,146,60,0.4)",  bg: "rgba(251,146,60,0.15)" },
  F1:      { text: "#f87171", glow: "rgba(248,113,113,0.5)", border: "rgba(248,113,113,0.4)", bg: "rgba(248,113,113,0.15)" },
  default: { text: "#4ade80", glow: "rgba(74,222,128,0.5)",  border: "rgba(74,222,128,0.4)",  bg: "rgba(74,222,128,0.15)" },
};
const nc = (cat: string) => NEON[cat] || NEON.default;

// ─── Category circles (Boleto Móvil style) ───────────────────────────────────

const CIRCLES = [
  { key: "all",     label: "Explorar",     emoji: "🚀", color: "#22c55e" },
  { key: "Sports",  label: "Deportes",     emoji: "🏅", color: "#4ade80" },
  { key: "Concert", label: "Música",       emoji: "🎵", color: "#c084fc" },
  { key: "Theater", label: "Espectáculos", emoji: "🎭", color: "#fb923c" },
  { key: "F1",      label: "F1 / Motor",   emoji: "🏎️", color: "#f87171" },
  { key: "Family",  label: "Familia",      emoji: "👨‍👩‍👧", color: "#60a5fa" },
];

const SPORT_CIRCLES = [
  { key: "futbol",     label: "Fútbol",     emoji: "⚽" },
  { key: "basquetbol", label: "Básquetbol", emoji: "🏀" },
  { key: "beisbol",    label: "Béisbol",    emoji: "⚾" },
  { key: "tenis",      label: "Tenis",      emoji: "🎾" },
  { key: "golf",       label: "Golf",       emoji: "⛳" },
];

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({ children, color = "#4ade80" }: { children: string; color?: string }) {
  return (
    <h2 style={{
      fontFamily: "'Oswald', sans-serif",
      fontSize: "clamp(17px,3.5vw,20px)",
      fontWeight: 800,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      background: `linear-gradient(90deg, ${color} 0%, #a855f7 100%)`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      margin: 0,
    }}>
      {children}
    </h2>
  );
}

// ─── Hero Slider ──────────────────────────────────────────────────────────────

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
    const t = setInterval(() => setCurrent(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;
  const ev = slides[current];
  const colors = nc(ev.category);
  const venue = venues?.find(v => v.id === ev.venueId);

  return (
    <div style={{ padding: "8px 12px 0" }}>
      <div
        onClick={() => onEventClick(ev)}
        style={{
          position: "relative",
          borderRadius: 22,
          overflow: "hidden",
          height: "clamp(380px, 52vw, 520px)",
          cursor: "pointer",
        }}
      >
        <AnimatePresence mode="sync">
          <motion.img
            key={ev.id}
            src={ev.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=900"}
            alt={ev.title}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
          />
        </AnimatePresence>

        {/* Gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 20%, rgba(0,0,0,0.88) 100%)" }} />

        {/* Date pill */}
        <div style={{ position: "absolute", top: 14, left: 14, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)", borderRadius: 14, padding: "7px 13px", textAlign: "center", zIndex: 2 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{format(new Date(ev.date), "dd")}</div>
          <div style={{ fontSize: 11, color: "#ccc", textTransform: "uppercase", letterSpacing: 1 }}>{format(new Date(ev.date), "MMM", { locale: es })}</div>
        </div>

        {/* Heart */}
        <button
          onClick={e => e.stopPropagation()}
          style={{ position: "absolute", top: 14, right: 14, width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          <Heart style={{ width: 18, height: 18, color: "#fff" }} />
        </button>

        {/* Bottom content */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 16px 18px", zIndex: 2 }}>
          {/* Badges */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700 }}>
              {ev.category === "Concert" ? "🎵" : ev.category === "Sports" ? "⚽" : ev.category === "F1" ? "🏎️" : "🎭"}
              {" "}{ev.category === "Concert" ? "Música" : ev.category === "Sports" ? "Deportes" : ev.category}
            </span>
            {(ev as any).isFeatured && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(250,204,21,0.15)", color: "#fbbf24", border: "1px solid rgba(250,204,21,0.4)", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700 }}>
                ⚡ Trending
              </span>
            )}
          </div>

          {/* Title */}
          <h2 style={{
            fontFamily: "'Oswald', sans-serif",
            fontSize: "clamp(20px, 5vw, 30px)",
            fontWeight: 800,
            color: colors.text,
            letterSpacing: "-0.01em",
            marginBottom: 6,
            lineHeight: 1.1,
            textShadow: `0 0 30px ${colors.glow}`,
          }}>
            {ev.title.toUpperCase()}
          </h2>

          {/* Meta */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 3 }}>
            <Calendar style={{ width: 13, height: 13 }} />
            {format(new Date(ev.date), "dd 'de' MMMM yyyy - HH:mm", { locale: es })} hrs
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 14 }}>
            <MapPin style={{ width: 13, height: 13 }} />
            {venue?.name || "México"}
          </div>

          {/* Price + CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {ev.minPrice && (
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                Desde: <strong style={{ color: "#4ade80", fontSize: 20 }}>${Math.round(parseFloat(ev.minPrice)).toLocaleString()}</strong>
              </span>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={e => { e.stopPropagation(); onEventClick(ev); }}
              style={{
                background: "#22c55e", color: "#000", fontWeight: 800, fontSize: 14,
                padding: "11px 22px", borderRadius: 999, border: "none", cursor: "pointer",
                boxShadow: "0 4px 18px rgba(34,197,94,0.45)",
                display: "flex", alignItems: "center", gap: 6,
              }}>
              Compra ahora →
            </motion.button>
          </div>
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 10, paddingBottom: 10 }}>
            {slides.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i); }}
                style={{ width: i === current ? 26 : 8, height: 8, borderRadius: 999, background: i === current ? "#fff" : "rgba(255,255,255,0.35)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s" }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category circles row ─────────────────────────────────────────────────────

function CategoryCircles({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 20, overflowX: "auto", padding: "14px 14px 6px", scrollbarWidth: "none" }}>
      {CIRCLES.map(c => {
        const isOn = active === c.key;
        return (
          <button key={c.key} onClick={() => onChange(c.key)}
            style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", transition: "transform 0.15s" }}>
            <div style={{
              width: 58, height: 58, borderRadius: "50%",
              background: isOn ? `${c.color}22` : "rgba(255,255,255,0.07)",
              border: isOn ? `2px solid ${c.color}` : "1.5px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, transition: "all 0.2s",
              boxShadow: isOn ? `0 0 14px ${c.color}55` : "none",
            }}>
              {c.emoji}
            </div>
            <span style={{ fontSize: 11, fontWeight: isOn ? 700 : 500, color: isOn ? c.color : "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Horizontal carousel wrapper ─────────────────────────────────────────────

function HScroll({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "4px 14px 8px", scrollbarWidth: "none", scrollSnapType: "x mandatory" }}>
      {children}
    </div>
  );
}

// ─── Event card (carousel, vertical poster) ───────────────────────────────────

function EventCard({ event, venues, onClick, wide }: { event: APIEvent; venues?: any[]; onClick?: () => void; wide?: boolean }) {
  const venue = venues?.find(v => v.id === event.venueId);
  const colors = nc(event.category);
  const [liked, setLiked] = useState(false);

  return (
    <motion.div
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      style={{
        flexShrink: 0, cursor: "pointer", scrollSnapAlign: "start",
        width: wide ? 200 : 158,
        borderRadius: 16, overflow: "hidden",
        background: "#111",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", aspectRatio: wide ? "16/10" : "3/4", overflow: "hidden" }}>
        <img
          src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400"}
          alt={event.title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)" }} />

        {/* Date */}
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", borderRadius: 9, padding: "3px 9px", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{format(new Date(event.date), "dd")}</div>
          <div style={{ fontSize: 9, color: "#ccc", textTransform: "uppercase" }}>{format(new Date(event.date), "MMM", { locale: es })}</div>
        </div>

        {/* Heart */}
        <button onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
          style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Heart style={{ width: 13, height: 13, color: liked ? "#f87171" : "#fff", fill: liked ? "#f87171" : "none" }} />
        </button>

        {/* Price badge */}
        {event.minPrice && (
          <div style={{ position: "absolute", bottom: 8, right: 8, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 7, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
            ${Math.round(parseFloat(event.minPrice)).toLocaleString()}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "9px 10px 11px" }}>
        <div style={{ color: colors.text, fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {event.title}
        </div>
        {venue && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
            <MapPin style={{ width: 9, height: 9 }} />{venue.city || venue.name}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── List event card (Próximos eventos) ──────────────────────────────────────

function EventCardList({ event, venues, onClick }: { event: APIEvent; venues?: any[]; onClick?: () => void }) {
  const venue = venues?.find(v => v.id === event.venueId);
  const colors = nc(event.category);
  const [liked, setLiked] = useState(false);

  return (
    <motion.div onClick={onClick} whileTap={{ scale: 0.985 }}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 14, cursor: "pointer", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ width: 70, height: 70, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
        <img src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=200"} alt={event.title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1.3, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 3 }}>
          <span style={{ background: "rgba(255,255,255,0.09)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
            {format(new Date(event.date), "dd")} {format(new Date(event.date), "MMM", { locale: es }).toUpperCase()}
          </span>
        </div>
        {venue && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#4ade80", fontSize: 11 }}>
            <MapPin style={{ width: 10, height: 10 }} />{venue.city || venue.name}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        {event.minPrice && (
          <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>
            ${Math.round(parseFloat(event.minPrice)).toLocaleString()}
          </span>
        )}
        <button onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
          style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Heart style={{ width: 13, height: 13, color: liked ? "#f87171" : "rgba(255,255,255,0.4)", fill: liked ? "#f87171" : "none" }} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, color, href }: { title: string; color?: string; href: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", marginBottom: 10 }}>
      <SectionTitle color={color}>{title}</SectionTitle>
      <Link href={href}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 2 }}>
          Ver más <ChevronRight style={{ width: 14, height: 14 }} />
        </span>
      </Link>
    </div>
  );
}

// ─── Home page ────────────────────────────────────────────────────────────────

export default function Home() {
  const { data: events, isLoading, refetch, isFetching } = useEvents();
  const { data: venues } = useVenues();
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState("all");
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [selectedEventGroup, setSelectedEventGroup] = useState<{
    title: string; image: string | null; events: APIEvent[];
  } | null>(null);

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

  const handleEventClick = useCallback((event: APIEvent) => {
    const baseTitle = event.title.replace(/ - (Viernes|Sábado|Domingo|Paquete 3 Días|Zona Verde VIP|Domingo Carrera).*$/i, "").trim();
    const related = eventsByTitle.get(baseTitle) || [event];
    if (related.length > 1) {
      setSelectedEventGroup({ title: baseTitle, image: event.image, events: related.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) });
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

  const filtered = useMemo(() => {
    if (!events) return [];
    if (activeCategory === "all") return events;
    return events.filter(e => e.category === activeCategory);
  }, [events, activeCategory]);

  const popular   = useMemo(() => filtered.slice(0, 10), [filtered]);
  const featured  = useMemo(() => filtered.slice(10, 20), [filtered]);
  const upcoming  = useMemo(() => filtered.slice(0, 8),  [filtered]);
  const sports    = useMemo(() => events?.filter(e => e.category === "Sports").slice(0, 10) || [], [events]);
  const music     = useMemo(() => events?.filter(e => e.category === "Concert").slice(0, 10) || [], [events]);

  if (isLoading) {
    return (
      <Layout>
        <div style={{ padding: "8px 12px 0" }}>
          <SkeletonShimmer style={{ height: "clamp(380px,52vw,520px)", borderRadius: 22 }} />
        </div>
        <div style={{ padding: "16px 14px", display: "flex", gap: 12, overflowX: "hidden" }}>
          {[1,2,3].map(i => <SkeletonShimmer key={i} style={{ width: 158, height: 240, borderRadius: 16, flexShrink: 0 }} />)}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <motion.div className="min-h-screen pb-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}>

        {/* Pull to refresh */}
        <AnimatePresence>
          {pullDistance > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: pullDistance }} exit={{ opacity: 0, height: 0 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <RefreshCw style={{ width: 22, height: 22, color: "#22c55e" }} className={cn(isFetching && "animate-spin")} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HERO SLIDER ── */}
        {events && events.length > 0 && (
          <HeroSlider events={events} venues={venues || []} onEventClick={handleEventClick} />
        )}

        {/* ── CATEGORY CIRCLES ── */}
        <CategoryCircles active={activeCategory} onChange={setActiveCategory} />

        {/* ── POPULARES ── */}
        {popular.length > 0 && (
          <motion.section style={{ marginTop: 18 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <SectionHeader title="Populares" color="#4ade80" href="/search" />
            <HScroll>
              {popular.map((ev, i) => (
                <EventCard key={ev.id} event={ev} venues={venues} onClick={() => handleEventClick(ev)} />
              ))}
            </HScroll>
          </motion.section>
        )}

        {/* ── EVENTOS DESTACADOS ── */}
        {featured.length > 0 && (
          <motion.section style={{ marginTop: 22 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
            <SectionHeader title="Eventos Destacados" color="#a855f7" href="/search" />
            <HScroll>
              {featured.map(ev => (
                <EventCard key={ev.id} event={ev} venues={venues} onClick={() => handleEventClick(ev)} />
              ))}
            </HScroll>
          </motion.section>
        )}

        {/* ── DEPORTES ── */}
        {sports.length > 0 && (
          <motion.section style={{ marginTop: 22 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
            <SectionHeader title="Deportes" color="#4ade80" href="/search?category=Sports" />
            {/* Sport sub-circles */}
            <div style={{ display: "flex", gap: 18, overflowX: "auto", padding: "0 14px 12px", scrollbarWidth: "none" }}>
              {SPORT_CIRCLES.map(s => (
                <button key={s.key} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(74,222,128,0.08)", border: "1.5px solid rgba(74,222,128,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                    {s.emoji}
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{s.label}</span>
                </button>
              ))}
            </div>
            <HScroll>
              {sports.map(ev => (
                <EventCard key={ev.id} event={ev} venues={venues} onClick={() => handleEventClick(ev)} />
              ))}
            </HScroll>
          </motion.section>
        )}

        {/* ── MÚSICA ── */}
        {music.length > 0 && (
          <motion.section style={{ marginTop: 22 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <SectionHeader title="Música" color="#c084fc" href="/search?category=Concert" />
            <HScroll>
              {music.map(ev => (
                <EventCard key={ev.id} event={ev} venues={venues} onClick={() => handleEventClick(ev)} />
              ))}
            </HScroll>
          </motion.section>
        )}

        {/* ── PRÓXIMOS EVENTOS (lista) ── */}
        {upcoming.length > 0 && (
          <motion.section style={{ marginTop: 22 }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }}>
            <SectionHeader title="Próximos eventos" color="#fb923c" href="/search" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 14px" }}>
              {upcoming.map(ev => (
                <EventCardList key={ev.id} event={ev} venues={venues} onClick={() => handleEventClick(ev)} />
              ))}
            </div>
            <div style={{ textAlign: "center", padding: "14px 0" }}>
              <Link href="/search">
                <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  Ver más <ChevronRight style={{ width: 15, height: 15 }} />
                </span>
              </Link>
            </div>
          </motion.section>
        )}

        {/* ── SELL BANNER ── */}
        <motion.section style={{ margin: "22px 14px 8px" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.07), rgba(168,85,247,0.05))",
            border: "1px solid rgba(74,222,128,0.14)",
            borderRadius: 20, padding: "22px 18px", textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'Oswald', sans-serif", fontSize: "clamp(16px,4vw,20px)", fontWeight: 800,
              background: "linear-gradient(90deg,#4ade80,#a855f7)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              letterSpacing: "0.02em", marginBottom: 8, lineHeight: 1.2,
            }}>
              ¿QUIERES VENDER TU EVENTO CON NOSOTROS?
            </div>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Únete a la plataforma de reventa de boletos en México.
            </p>
            <motion.button whileTap={{ scale: 0.97 }}
              style={{ background: "#22c55e", color: "#000", fontWeight: 800, fontSize: 14, padding: "11px 26px", borderRadius: 999, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(34,197,94,0.3)" }}>
              Contáctanos →
            </motion.button>
          </div>
        </motion.section>

      </motion.div>

      {/* ── DATE MODAL ── */}
      <AnimatePresence>
        {selectedEventGroup && (
          <motion.div className="fixed inset-0 z-50 bg-background flex flex-col"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <motion.div className="relative overflow-hidden flex-shrink-0" style={{ height: "clamp(200px,40vw,280px)" }}
              initial={{ y: -20 }} animate={{ y: 0 }} transition={{ duration: 0.3 }}>
              <img src={selectedEventGroup.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800"} alt={selectedEventGroup.title}
                className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <motion.button onClick={() => setSelectedEventGroup(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white" whileTap={{ scale: 0.9 }}>
                <X className="h-6 w-6" />
              </motion.button>
              <div className="absolute bottom-6 left-4 right-4">
                <h3 className="text-white font-heading font-bold text-2xl line-clamp-2">{selectedEventGroup.title}</h3>
                <p className="text-white/70 text-sm mt-1">{selectedEventGroup.events.length} fechas disponibles</p>
              </div>
            </motion.div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-muted-foreground mb-4 font-medium">Selecciona una fecha:</p>
              <div className="space-y-3">
                {selectedEventGroup.events.map((event, index) => {
                  const venue = venues?.find(v => v.id === event.venueId);
                  const colors = nc(event.category);
                  const dateLabel = event.title.includes("Viernes") ? "Viernes - Práctica Libre"
                    : event.title.includes("Sábado") ? "Sábado - Clasificación"
                    : event.title.includes("Domingo") || event.title.includes("Carrera") ? "Domingo - Carrera"
                    : event.title.includes("Paquete") ? "Paquete 3 Días"
                    : event.title.includes("VIP") ? "Experiencia VIP"
                    : format(new Date(event.date), "EEEE d 'de' MMMM", { locale: es });
                  return (
                    <motion.button key={event.id}
                      onClick={() => { setSelectedEventGroup(null); navigate(`/event/${event.id}`); }}
                      className="w-full p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left group bg-card"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                      whileTap={{ scale: 0.98 }}>
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
