import { Layout } from "@/components/layout";
import { useEvents, useVenues, type Event as APIEvent } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useSearch } from "wouter";
import { Search, MapPin, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  
  const { data: events, isLoading } = useEvents();
  const { data: venues } = useVenues();

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    
    let result = events;
    
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.tags as string[])?.some(t => t.toLowerCase().includes(q))
      );
    }
    
    if (category) {
      result = result.filter(e => e.category === category);
    }
    
    return result;
  }, [events, query, category]);

  const categories = ["Concierto", "Deportes", "F1"];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Search header */}
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold mb-4">Buscar Eventos</h1>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar artista, evento, equipo..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
          </div>
          
          {/* Category filters */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            <Button 
              variant={category === null ? "default" : "outline"} 
              size="sm"
              onClick={() => setCategory(null)}
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat}
                variant={category === cat ? "default" : "outline"} 
                size="sm"
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {filteredEvents.length} eventos encontrados
            {query && ` para "${query}"`}
          </p>
          
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No se encontraron eventos.</p>
              <Button variant="link" onClick={() => { setQuery(""); setCategory(null); }}>
                Ver todos los eventos
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredEvents.map(event => {
                const venue = venues?.find(v => v.id === event.venueId);
                return (
                  <Link key={event.id} href={`/event/${event.id}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" data-testid={`search-result-${event.id}`}>
                      <div className="flex">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0">
                          <img 
                            src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=200"} 
                            alt={event.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardContent className="p-3 sm:p-4 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Badge variant="secondary" className="text-[10px] mb-1">{event.category}</Badge>
                              <h3 className="font-bold text-sm sm:text-base line-clamp-2">{event.title}</h3>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(event.date), "d MMM yyyy", { locale: es })}</span>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{venue?.name || "Cargando..."}</span>
                              </div>
                            </div>
                            {event.minPrice && (
                              <div className="text-right shrink-0">
                                <div className="text-xs text-muted-foreground">Desde</div>
                                <div className="font-bold text-primary text-sm sm:text-lg">
                                  ${Math.round(parseFloat(event.minPrice)).toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
