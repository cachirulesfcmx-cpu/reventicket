import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Layout } from '@/components/layout';
import { SvgMapViewer, type ZoneConfig, type CartItem } from '@/components/svg-map-viewer';
import { MapCartPanel } from '@/components/map-cart-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Map, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/csrf';

interface MapInfo {
  id: string;
  name: string;
  svgUrl: string;
}

const STORAGE_KEY = 'reventicket_map_cart';

export default function MapViewer() {
  const [, navigate] = useLocation();
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [selectedMap, setSelectedMap] = useState<MapInfo | null>(null);
  const [inventory, setInventory] = useState<ZoneConfig[]>([]);
  const [selectedZones, setSelectedZones] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  useEffect(() => {
    loadMaps();
    restoreCart();
  }, []);

  useEffect(() => {
    if (selectedMap) {
      loadInventory(selectedMap.id);
    }
  }, [selectedMap]);

  useEffect(() => {
    saveCart();
  }, [selectedZones]);

  const loadMaps = async () => {
    try {
      const response = await fetch('/api/maps');
      if (response.ok) {
        const data = await response.json();
        setMaps(data.maps || []);
        if (data.maps?.length > 0) {
          setSelectedMap(data.maps[0]);
        }
      }
    } catch (error) {
      console.error('Error loading maps:', error);
      setMaps([
        { id: 'arena-map', name: 'Arena General', svgUrl: '/maps/arena-map.svg' },
        { id: 'f1-map', name: 'Circuito F1', svgUrl: '/maps/f1-map.svg' },
        { id: 'estadio-azteca', name: 'Estadio Azteca', svgUrl: '/maps/estadio-azteca.svg' }
      ]);
      setSelectedMap({ id: 'arena-map', name: 'Arena General', svgUrl: '/maps/arena-map.svg' });
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async (mapId: string) => {
    try {
      const response = await fetch(`/api/inventory?map=${mapId}`);
      if (response.ok) {
        const data = await response.json();
        setInventory(data.zones || []);
      } else {
        generateFallbackInventory();
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      generateFallbackInventory();
    }
  };

  const generateFallbackInventory = () => {
    const fallbackZones: ZoneConfig[] = [
      { id: 'zone_vip', label: 'VIP Floor', price: 8500, status: 'available' },
      { id: 'zone_platea', label: 'Platea', price: 5500, status: 'available' },
      { id: 'zone_general_a', label: 'General A', price: 3500, status: 'available' },
      { id: 'zone_general_b', label: 'General B', price: 2500, status: 'available' },
      { id: 'zone_sold_1', label: 'Zona Agotada', price: 0, status: 'sold' }
    ];
    setInventory(fallbackZones);
  };

  const saveCart = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: selectedZones,
        mapId: selectedMap?.id,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const restoreCart = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          setSelectedZones(data.items || []);
        }
      }
    } catch (error) {
      console.error('Error restoring cart:', error);
    }
  };

  const handleZoneClick = useCallback((zone: ZoneConfig) => {
    console.log('Zone clicked:', zone);
  }, []);

  const handleZoneSelect = useCallback((zones: CartItem[]) => {
    setSelectedZones(zones);
  }, []);

  const handleRemoveItem = (id: string) => {
    setSelectedZones(prev => prev.filter(item => item.id !== id));
  };

  const handleClearCart = () => {
    setSelectedZones([]);
  };

  const handleExportJson = () => {
    const total = selectedZones.reduce((sum, item) => sum + item.price, 0);
    const exportData = {
      items: selectedZones,
      total,
      mapId: selectedMap?.id,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cart-${selectedMap?.id || 'export'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCheckout = async () => {
    if (selectedZones.length === 0) return;
    
    setIsCheckingOut(true);
    try {
      const total = selectedZones.reduce((sum, item) => sum + item.price, 0);
      const result = await apiRequest('POST', '/api/checkout-map', {
        items: selectedZones,
        total,
        mapId: selectedMap?.id
      });
      
      alert(`Checkout exitoso! Order ID: ${result.orderId}\nTotal: $${result.total.toLocaleString()} MXN`);
      handleClearCart();
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(error.message || 'Error en el checkout. Por favor intenta de nuevo.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-2xl font-heading font-bold">Visor de Mapas SVG</h1>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {maps.map((map) => (
            <Button
              key={map.id}
              variant={selectedMap?.id === map.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMap(map)}
              data-testid={`map-select-${map.id}`}
            >
              <Map className="h-4 w-4 mr-2" />
              {map.name}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <CardContent className="p-0 h-[600px]">
                {selectedMap && (
                  <SvgMapViewer
                    svgUrl={selectedMap.svgUrl}
                    inventory={inventory}
                    selectedZones={selectedZones}
                    onZoneClick={handleZoneClick}
                    onZoneSelect={handleZoneSelect}
                  />
                )}
              </CardContent>
            </Card>
            
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <h3 className="font-medium mb-2">Leyenda</h3>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500 opacity-80"></div>
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-purple-500"></div>
                  <span>Seleccionado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-400 opacity-50"></div>
                  <span>Agotado</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 h-[600px]">
            <MapCartPanel
              items={selectedZones}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              onExportJson={handleExportJson}
              onCheckout={handleCheckout}
              isCheckingOut={isCheckingOut}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
