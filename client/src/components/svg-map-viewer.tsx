import { useEffect, useRef, useState, useCallback } from 'react';

interface ZoneConfig {
  id: string;
  label: string;
  price: number;
  status: 'available' | 'sold' | 'selected';
}

interface CartItem {
  id: string;
  label: string;
  price: number;
}

interface SvgMapViewerProps {
  svgUrl: string;
  inventory: ZoneConfig[];
  selectedZones: CartItem[];
  onZoneClick?: (zone: ZoneConfig) => void;
  onZoneSelect?: (zones: CartItem[]) => void;
}

export function SvgMapViewer({ 
  svgUrl, 
  inventory, 
  selectedZones,
  onZoneClick, 
  onZoneSelect 
}: SvgMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const inventoryRef = useRef(inventory);
  const selectedZonesRef = useRef(selectedZones);
  const onZoneClickRef = useRef(onZoneClick);
  const onZoneSelectRef = useRef(onZoneSelect);
  
  useEffect(() => {
    inventoryRef.current = inventory;
    selectedZonesRef.current = selectedZones;
    onZoneClickRef.current = onZoneClick;
    onZoneSelectRef.current = onZoneSelect;
  }, [inventory, selectedZones, onZoneClick, onZoneSelect]);

  const loadSvg = useCallback(async () => {
    if (!containerRef.current || !svgUrl) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(svgUrl);
      if (!response.ok) throw new Error('Failed to load SVG');
      
      const svgText = await response.text();
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');
      
      if (!svgElement) throw new Error('Invalid SVG');
      
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      svgElement.style.maxWidth = '100%';
      svgElement.style.display = 'block';
      
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(document.importNode(svgElement, true));
      
      applyInventoryToSvg();
      setupZoneListeners();
      
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading SVG');
      setLoading(false);
    }
  }, [svgUrl]);

  const applyInventoryToSvg = useCallback(() => {
    if (!containerRef.current) return;
    
    const zones = containerRef.current.querySelectorAll('[id^="zone_"], [data-zone]');
    
    zones.forEach((zone) => {
      const zoneId = zone.id || zone.getAttribute('data-zone') || '';
      const config = inventory.find(z => z.id === zoneId);
      const isSelected = selectedZones.some(s => s.id === zoneId);
      
      if (config) {
        zone.setAttribute('data-price', config.price.toString());
        zone.setAttribute('data-status', isSelected ? 'selected' : config.status);
        zone.setAttribute('data-label', config.label);
        
        const el = zone as SVGElement;
        el.style.cursor = config.status === 'sold' ? 'not-allowed' : 'pointer';
        el.style.transition = 'all 0.2s ease';
        
        if (config.status === 'sold') {
          el.style.fill = '#6b7280';
          el.style.opacity = '0.5';
        } else if (isSelected) {
          el.style.fill = '#8b5cf6';
          el.style.opacity = '1';
        } else {
          el.style.opacity = '0.8';
        }
      }
    });
  }, [inventory, selectedZones]);

  const setupZoneListeners = useCallback(() => {
    if (!containerRef.current) return;
    
    const zones = containerRef.current.querySelectorAll('[id^="zone_"], [data-zone]');
    
    zones.forEach((zone) => {
      const el = zone as SVGElement;
      
      el.addEventListener('mouseenter', () => {
        const status = el.getAttribute('data-status');
        if (status !== 'sold') {
          el.style.opacity = '1';
          el.style.filter = 'brightness(1.2)';
        }
      });
      
      el.addEventListener('mouseleave', () => {
        const status = el.getAttribute('data-status');
        if (status !== 'sold' && status !== 'selected') {
          el.style.opacity = '0.8';
          el.style.filter = 'none';
        }
      });
      
      el.addEventListener('click', () => {
        const zoneId = el.id || el.getAttribute('data-zone') || '';
        const currentInventory = inventoryRef.current;
        const currentSelectedZones = selectedZonesRef.current;
        const config = currentInventory.find(z => z.id === zoneId);
        
        if (config && config.status !== 'sold') {
          onZoneClickRef.current?.(config);
          
          const isCurrentlySelected = currentSelectedZones.some(s => s.id === zoneId);
          let newSelection: CartItem[];
          
          if (isCurrentlySelected) {
            newSelection = currentSelectedZones.filter(s => s.id !== zoneId);
          } else {
            newSelection = [...currentSelectedZones, { id: zoneId, label: config.label, price: config.price }];
          }
          
          onZoneSelectRef.current?.(newSelection);
        }
      });
    });
  }, []);

  useEffect(() => {
    loadSvg();
  }, [svgUrl]);

  useEffect(() => {
    applyInventoryToSvg();
  }, [inventory, selectedZones, applyInventoryToSvg]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 3));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800 rounded-lg p-8">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button 
            onClick={loadSvg}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-900 rounded-lg">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-900/80 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}
      
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <button
          onClick={() => setScale(prev => Math.min(prev * 1.2, 3))}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-slate-700"
          data-testid="zoom-in"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={() => setScale(prev => Math.max(prev * 0.8, 0.5))}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-slate-700"
          data-testid="zoom-out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={resetView}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-slate-700"
          data-testid="reset-view"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
      
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          data-testid="svg-container"
        />
      </div>
    </div>
  );
}

export type { ZoneConfig, CartItem };
