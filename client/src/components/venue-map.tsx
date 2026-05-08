import { cn } from "@/lib/utils";
import { useState } from "react";
import { InteractiveSVGMap } from "./venue-maps/interactive-svg-map";

interface Zone {
  id: string;
  name: string;
  color: string;
  basePrice: number;
}

interface VenueMapProps {
  zones: Zone[];
  selectedZoneId?: string | null;
  onSelectZone: (zoneId: string | null) => void;
  className?: string;
  venueName?: string;
  eventCategory?: string;
}

export function VenueMap({ zones, selectedZoneId, onSelectZone, className, venueName = "", eventCategory = "" }: VenueMapProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  
  if (!zones || zones.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-muted/20 rounded-xl p-4 min-h-[250px]", className)}>
        <p className="text-muted-foreground text-sm">Cargando mapa del recinto...</p>
      </div>
    );
  }

  // Detect venue type from name AND category
  const venueNameLower = venueName.toLowerCase();
  const categoryLower = eventCategory.toLowerCase();
  const isAutodromo = (venueNameLower.includes("autódromo") || venueNameLower.includes("autodromo")) && 
                      (categoryLower.includes("f1") || categoryLower.includes("formula") || categoryLower.includes("motorsport"));

  // Use the correct SVG map based on venue type
  const svgUrl = isAutodromo ? "/maps/f1-map.svg" : "/maps/arena-map.svg";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* SVG Map based on venue */}
      <div className="relative bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden border">
        <InteractiveSVGMap
          svgUrl={svgUrl}
          zones={zones}
          selectedZoneId={selectedZoneId}
          onSelectZone={onSelectZone}
          onHoverZone={setHoveredZone}
        />
      </div>
      
      {/* Zonas y Precios */}
      <div className="bg-background border rounded-lg p-2">
        <h4 className="font-bold text-xs mb-1.5">ZONAS Y PRECIOS</h4>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {zones.map(zone => (
            <button
              key={zone.id}
              data-testid={`zone-btn-${zone.id}`}
              onClick={() => {
                console.log("[VenueMap] Zone button clicked:", zone.id, zone.name);
                onSelectZone(zone.id);
              }}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              className={cn(
                "flex items-center justify-between text-left py-1 px-1.5 rounded transition-all text-[10px]",
                selectedZoneId === zone.id 
                  ? "bg-primary/10 ring-1 ring-primary" 
                  : "hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span 
                  className="w-2 h-2 rounded-sm shrink-0" 
                  style={{ backgroundColor: zone.color }}
                />
                <span className="truncate">{zone.name}</span>
              </div>
              <span className="font-bold ml-1">${zone.basePrice.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>
      
      {selectedZoneId && (
        <button 
          onClick={() => onSelectZone(null)}
          className="text-[10px] text-primary underline text-center w-full"
        >
          Limpiar filtro - Ver todos los boletos
        </button>
      )}
      
      <p className="text-[10px] text-muted-foreground text-center">
        Toca una zona para ver boletos disponibles.
      </p>
    </div>
  );
}
