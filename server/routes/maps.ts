import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/maps', async (_req: Request, res: Response) => {
  try {
    const mapsDir = path.join(process.cwd(), 'client', 'public', 'maps');
    
    let files: string[] = [];
    try {
      files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.svg'));
    } catch {
      files = ['arena-map.svg', 'f1-map.svg', 'estadio-azteca.svg'];
    }
    
    const maps = files.map(file => {
      const id = file.replace('.svg', '');
      const name = id
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      return {
        id,
        name,
        svgUrl: `/maps/${file}`
      };
    });
    
    res.json({ maps });
  } catch (error) {
    console.error('Error loading maps:', error);
    res.status(500).json({ error: 'Failed to load maps' });
  }
});

router.get('/inventory', async (req: Request, res: Response) => {
  try {
    const mapId = req.query.map as string;
    
    if (!mapId) {
      return res.status(400).json({ error: 'Map ID required' });
    }
    
    const inventoryPath = path.join(process.cwd(), 'data', 'inventory', `${mapId}.json`);
    
    try {
      const data = fs.readFileSync(inventoryPath, 'utf-8');
      const inventory = JSON.parse(data);
      return res.json(inventory);
    } catch {
      const defaultZones = generateDefaultInventory(mapId);
      return res.json({ zones: defaultZones, mapId });
    }
  } catch (error) {
    console.error('Error loading inventory:', error);
    res.status(500).json({ error: 'Failed to load inventory' });
  }
});

router.post('/checkout-map', async (req: Request, res: Response) => {
  try {
    const { items, total, mapId } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    console.log('Map checkout:', { orderId, mapId, items, total });
    
    res.json({
      success: true,
      orderId,
      items,
      total,
      mapId,
      message: 'Checkout completed successfully'
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

function generateDefaultInventory(mapId: string) {
  const baseZones = [
    { id: 'zone_vip', label: 'VIP Floor', price: 8500, status: 'available' as const },
    { id: 'zone_platea_baja', label: 'Platea Baja', price: 5500, status: 'available' as const },
    { id: 'zone_platea_alta', label: 'Platea Alta', price: 4500, status: 'available' as const },
    { id: 'zone_general_a', label: 'General A', price: 3500, status: 'available' as const },
    { id: 'zone_general_b', label: 'General B', price: 2500, status: 'available' as const },
    { id: 'zone_sold_example', label: 'Zona Agotada (Ejemplo)', price: 4000, status: 'sold' as const }
  ];
  
  if (mapId === 'f1-map') {
    return [
      { id: 'zone_verde_vip', label: 'Zona Verde VIP', price: 30500, status: 'available' as const },
      { id: 'zone_verde', label: 'Zona Verde', price: 12000, status: 'available' as const },
      { id: 'zone_azul', label: 'Zona Azul', price: 6500, status: 'available' as const },
      { id: 'zone_naranja', label: 'Zona Naranja', price: 3900, status: 'available' as const },
      { id: 'zone_grada_15', label: 'Grada 15 (Agotada)', price: 5000, status: 'sold' as const }
    ];
  }
  
  if (mapId === 'estadio-azteca') {
    return [
      { id: 'cancha-vip', label: 'Cancha VIP', price: 45000, status: 'available' as const },
      { id: 'platea-baja', label: 'Platea Baja', price: 25000, status: 'available' as const },
      { id: 'platea-alta', label: 'Platea Alta', price: 18000, status: 'available' as const },
      { id: 'cabecera-norte', label: 'Cabecera Norte', price: 12000, status: 'available' as const },
      { id: 'cabecera-sur', label: 'Cabecera Sur', price: 12000, status: 'available' as const },
      { id: 'general-oriente', label: 'General Oriente', price: 9000, status: 'available' as const },
      { id: 'general-poniente', label: 'General Poniente', price: 9000, status: 'sold' as const }
    ];
  }
  
  return baseZones;
}

export default router;
