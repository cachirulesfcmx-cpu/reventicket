import { useEffect, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Zone {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  svgUrl: string;
  zones?: Zone[];
  tickets?: { zoneId: string }[];
  selectedZone?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
}

export function SimpleMapViewer({ svgUrl, zones, tickets, selectedZone, onZoneSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);

  const zonesWithTickets = new Set(
    tickets?.map(t => t.zoneId) || []
  );

  useEffect(() => {
    fetch(svgUrl)
      .then(res => res.text())
      .then(text => {
        let modifiedSvg = text;
        modifiedSvg = modifiedSvg.replace(/width="[^"]*"/g, 'width="100%"');
        modifiedSvg = modifiedSvg.replace(/height="[^"]*"/g, 'height="100%"');
        setSvgContent(modifiedSvg);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [svgUrl]);

  const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.5, 1));
  const handleReset = useCallback(() => {
    setScale(1);
    if (onZoneSelect) onZoneSelect(null);
  }, [onZoneSelect]);

  const handleMapClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!zones || !onZoneSelect) return;
    
    const target = e.target as HTMLElement;
    const zoneElement = target.closest('.zone') as HTMLElement | null;
    
    if (zoneElement) {
      e.preventDefault();
      e.stopPropagation();
      
      const svgZoneId = zoneElement.id;
      const zoneIndex = parseInt(svgZoneId.replace('zone_', ''), 10) - 1;
      
      if (zoneIndex >= 0 && zoneIndex < zones.length) {
        const zone = zones[zoneIndex];
        
        if (zonesWithTickets.has(zone.id)) {
          if (selectedZone === zone.id) {
            onZoneSelect(null);
          } else {
            onZoneSelect(zone.id);
          }
        }
      }
    }
  }, [zones, onZoneSelect, selectedZone, zonesWithTickets]);

  useEffect(() => {
    if (!containerRef.current || !zones) return;
    
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;
    
    const zoneElements = svgElement.querySelectorAll('.zone');
    
    zoneElements.forEach((el, index) => {
      const pathEl = el as SVGPathElement;
      
      if (index < zones.length) {
        const zone = zones[index];
        const hasTickets = zonesWithTickets.has(zone.id);
        const isSelected = selectedZone === zone.id;
        
        if (hasTickets) {
          pathEl.style.fill = zone.color || '#6366f1';
          pathEl.style.fillOpacity = isSelected ? '0.8' : '0.5';
          pathEl.style.cursor = 'pointer';
          pathEl.style.stroke = isSelected ? '#000' : '#333';
          pathEl.style.strokeWidth = isSelected ? '3' : '1';
        } else {
          pathEl.style.fill = '#9ca3af';
          pathEl.style.fillOpacity = '0.3';
          pathEl.style.cursor = 'not-allowed';
          pathEl.style.stroke = '#6b7280';
          pathEl.style.strokeWidth = '0.5';
        }
      }
    });
  }, [svgContent, zones, selectedZone, zonesWithTickets]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[200px] bg-slate-50 animate-pulse text-sm text-muted-foreground">Cargando mapa...</div>;
  }

  return (
    <div className="relative h-full">
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <Button variant="secondary" size="icon" className="h-8 w-8 shadow-md" onClick={handleZoomIn}><ZoomIn className="h-4 w-4" /></Button>
        <Button variant="secondary" size="icon" className="h-8 w-8 shadow-md" onClick={handleZoomOut}><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="secondary" size="icon" className="h-8 w-8 shadow-md" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
      </div>

      <div 
        ref={containerRef}
        className="overflow-auto h-full"
        style={{ cursor: 'default' }}
        onClick={handleMapClick}
        onTouchEnd={handleMapClick}
      >
        <div
          className="w-full min-h-[200px]"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "center top",
            transition: "transform 0.15s ease-out"
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {selectedZone && zones && (
        <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs px-3 py-2 rounded-lg shadow-lg">
          <span className="font-medium">
            {zones.find(z => z.id === selectedZone)?.name}
          </span>
          <span className="ml-2 opacity-70">(toca otra vez para quitar)</span>
        </div>
      )}
      
      {scale !== 1 && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{Math.round(scale * 100)}%</div>
      )}
    </div>
  );
}
