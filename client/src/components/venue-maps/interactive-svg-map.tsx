import React, { useEffect, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Move } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Zone {
  id: string;
  name: string;
  color: string;
  basePrice: number;
}

interface Props {
  svgUrl: string;
  zones: Zone[];
  selectedZoneId?: string | null;
  onSelectZone: (zoneId: string | null) => void;
  onHoverZone: (zoneId: string | null) => void;
}

export function InteractiveSVGMap({ svgUrl, zones, selectedZoneId, onSelectZone, onHoverZone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Load SVG content
  useEffect(() => {
    fetch(svgUrl)
      .then(res => res.text())
      .then(text => {
        let modifiedSvg = text;
        modifiedSvg = modifiedSvg.replace(/width="[^"]*"/g, 'width="100%"');
        modifiedSvg = modifiedSvg.replace(/height="[^"]*"/g, 'height="100%"');
        if (!modifiedSvg.includes('preserveAspectRatio')) {
          modifiedSvg = modifiedSvg.replace(/<svg/, '<svg preserveAspectRatio="xMidYMid meet"');
        }
        setSvgContent(modifiedSvg);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading SVG:", err);
        setLoading(false);
      });
  }, [svgUrl]);

  // Apply zone colors and selection styling
  useEffect(() => {
    if (!svgContainerRef.current || !svgContent || zones.length === 0) return;

    const container = svgContainerRef.current;
    const zonePaths = container.querySelectorAll(".zone, [id^='zone_']");
    
    zonePaths.forEach((path, index) => {
      const pathElement = path as SVGPathElement;
      const dbZoneIndex = index % zones.length;
      const zone = zones[dbZoneIndex];
      
      if (zone) {
        const isSelected = selectedZoneId === zone.id;
        pathElement.style.fillOpacity = isSelected ? "1" : "0.7";
        pathElement.style.strokeWidth = isSelected ? "4px" : "1px";
        pathElement.style.stroke = isSelected ? "#000" : "rgba(0,0,0,0.2)";
        pathElement.style.transition = "all 0.2s ease";
      }
    });
  }, [selectedZoneId, zones, svgContent]);

  // Mouse/touch drag handlers for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    const maxOffset = (scale - 1) * 150;
    setPosition({
      x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
      y: Math.max(-maxOffset, Math.min(maxOffset, newY))
    });
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for mobile pan and pinch-zoom
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches));
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      });
    }
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      if (distance && lastTouchDistance) {
        const delta = distance - lastTouchDistance;
        if (Math.abs(delta) > 5) {
          setScale(prev => {
            const newScale = prev + (delta > 0 ? 0.1 : -0.1);
            return Math.max(1, Math.min(4, newScale));
          });
          setLastTouchDistance(distance);
        }
      }
      e.preventDefault();
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      const maxOffset = (scale - 1) * 150;
      setPosition({
        x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
        y: Math.max(-maxOffset, Math.min(maxOffset, newY))
      });
      e.preventDefault();
    }
  }, [lastTouchDistance, isDragging, dragStart, scale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setLastTouchDistance(null);
    setIsDragging(false);
    
    // Reset position when scale returns to 1
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] bg-slate-50">
        <div className="animate-pulse text-muted-foreground text-sm">Cargando mapa...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-8 w-8 shadow-md"
          onClick={handleZoomIn}
          data-testid="zoom-in-btn"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-8 w-8 shadow-md"
          onClick={handleZoomOut}
          data-testid="zoom-out-btn"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button 
          variant="secondary" 
          size="icon" 
          className="h-8 w-8 shadow-md"
          onClick={handleReset}
          data-testid="zoom-reset-btn"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Container with pan support */}
      <div 
        className="overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ 
          maxHeight: "320px",
          touchAction: scale > 1 ? "none" : "auto"
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={svgContainerRef}
          className="w-full flex justify-center items-center min-h-[200px]"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.2s ease-out"
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {/* Pan hint when zoomed */}
      {scale > 1 && (
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <Move className="h-3 w-3" />
          <span>Arrastra para mover</span>
        </div>
      )}

      {/* Zoom indicator */}
      {scale !== 1 && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Selection indicator */}
      {selectedZoneId && (
        <div className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded font-medium">
          Filtro activo
        </div>
      )}
    </div>
  );
}
