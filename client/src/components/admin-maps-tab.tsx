// client/src/components/admin-maps-tab.tsx
// Pega este componente y agrégalo al admin.tsx

import { useState } from "react";
import { useEvents, useVenues } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Map, Plus, Trash2, Eye, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EventMap {
  id: string;
  eventId: string;
  name: string;
  imageUrl?: string;
  sections: Array<{ id: string; name: string; color: string; price: number; capacity: number }>;
  createdAt: string;
}

// Mock local state (replace with real API hooks when backend ready)
function useEventMaps() {
  const [maps, setMaps] = useState<EventMap[]>([]);
  const addMap = (m: EventMap) => setMaps(prev => [...prev, m]);
  const deleteMap = (id: string) => setMaps(prev => prev.filter(m => m.id !== id));
  return { maps, addMap, deleteMap };
}

export function AdminMapsTab() {
  const { data: events = [] } = useEvents();
  const { data: venues = [] } = useVenues();
  const { maps, addMap, deleteMap } = useEventMaps();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [previewMap, setPreviewMap] = useState<EventMap | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [mapName, setMapName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sections, setSections] = useState([
    { id: "1", name: "General", color: "#22c55e", price: 800, capacity: 5000 },
    { id: "2", name: "VIP",     color: "#a855f7", price: 3500, capacity: 500  },
  ]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addSection = () =>
    setSections(s => [...s, { id: Date.now().toString(), name: "Nueva sección", color: "#60a5fa", price: 0, capacity: 0 }]);

  const updateSection = (id: string, key: string, value: string | number) =>
    setSections(s => s.map(sec => sec.id === id ? { ...sec, [key]: value } : sec));

  const removeSection = (id: string) =>
    setSections(s => s.filter(sec => sec.id !== id));

  const handleSave = () => {
    if (!selectedEventId || !mapName) {
      toast({ title: "Completa los campos requeridos", variant: "destructive" });
      return;
    }
    const newMap: EventMap = {
      id: Date.now().toString(),
      eventId: selectedEventId,
      name: mapName,
      imageUrl: imagePreview || undefined,
      sections,
      createdAt: new Date().toISOString(),
    };
    addMap(newMap);
    toast({ title: "✅ Mapa guardado", description: `"${mapName}" agregado correctamente.` });
    setOpen(false);
    setSelectedEventId(""); setMapName(""); setImagePreview(null); setImageFile(null);
    setSections([
      { id: "1", name: "General", color: "#22c55e", price: 800, capacity: 5000 },
      { id: "2", name: "VIP",     color: "#a855f7", price: 3500, capacity: 500  },
    ]);
  };

  const getEventTitle = (id: string) => events.find(e => e.id === id)?.title || id;
  const getVenueName = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    return venues.find(v => v.id === event?.venueId)?.name || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Mapas de Recintos</h2>
          <p className="text-sm text-muted-foreground mt-1">Sube el mapa específico de cada evento — cada artista puede tener una distribución diferente en el mismo recinto.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Agregar mapa
        </Button>
      </div>

      {maps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Map className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Sin mapas todavía</p>
              <p className="text-sm text-muted-foreground mt-1">Agrega el mapa de un evento para que los compradores vean la distribución de secciones.</p>
            </div>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Agregar primer mapa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {maps.map(m => (
            <Card key={m.id} className="overflow-hidden">
              {/* Map image */}
              <div className="relative h-40 bg-muted flex items-center justify-center overflow-hidden">
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => setPreviewMap(m)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => deleteMap(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold leading-tight line-clamp-1">{m.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-1">{getEventTitle(m.eventId)}</CardDescription>
              </CardHeader>

              <CardContent className="pt-0 pb-3">
                <div className="text-xs text-muted-foreground mb-2">{getVenueName(m.eventId)}</div>
                <div className="flex flex-wrap gap-1">
                  {m.sections.map(s => (
                    <span key={s.id} style={{ background: s.color + "22", color: s.color, border: `1px solid ${s.color}55` }}
                      className="text-xs px-2 py-0.5 rounded-full font-medium">
                      {s.name} · ${s.price.toLocaleString()}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Map Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar mapa de evento</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Event selector */}
            <div className="space-y-1.5">
              <Label>Evento *</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger><SelectValue placeholder="Selecciona el evento..." /></SelectTrigger>
                <SelectContent>
                  {events.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title} — {format(new Date(e.date), "dd MMM yyyy", { locale: es })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Nombre del mapa *</Label>
              <Input placeholder="Ej. Distribución Bad Bunny — Foro Sol" value={mapName} onChange={e => setMapName(e.target.value)} />
              <p className="text-xs text-muted-foreground">Ayuda a identificar mapas del mismo recinto con distintos artistas.</p>
            </div>

            {/* Image upload */}
            <div className="space-y-1.5">
              <Label>Imagen del mapa</Label>
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => document.getElementById("map-upload")?.click()}>
                <input id="map-upload" type="file" accept="image/*,.svg" className="hidden" onChange={handleImageChange} />
                {imagePreview ? (
                  <div className="space-y-3">
                    <img src={imagePreview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                    <p className="text-xs text-muted-foreground">Haz clic para cambiar la imagen</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Arrastra o <span className="text-primary">haz clic</span> para subir</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, SVG · máx 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Secciones y precios</Label>
                <Button variant="outline" size="sm" onClick={addSection}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Agregar sección
                </Button>
              </div>

              <div className="space-y-2">
                {sections.map(sec => (
                  <div key={sec.id} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
                    {/* Color */}
                    <input type="color" value={sec.color} onChange={e => updateSection(sec.id, "color", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" title="Color de sección" />
                    {/* Name */}
                    <Input value={sec.name} onChange={e => updateSection(sec.id, "name", e.target.value)}
                      placeholder="Nombre" className="flex-1 h-8 text-sm" />
                    {/* Price */}
                    <Input type="number" value={sec.price} onChange={e => updateSection(sec.id, "price", parseFloat(e.target.value) || 0)}
                      placeholder="Precio" className="w-24 h-8 text-sm" />
                    {/* Capacity */}
                    <Input type="number" value={sec.capacity} onChange={e => updateSection(sec.id, "capacity", parseInt(e.target.value) || 0)}
                      placeholder="Lugares" className="w-24 h-8 text-sm" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeSection(sec.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground px-1">
                <span className="ml-10">Nombre</span>
                <span>Precio (MXN)</span>
                <span>Capacidad</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar mapa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewMap} onOpenChange={() => setPreviewMap(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewMap?.name}</DialogTitle>
          </DialogHeader>
          {previewMap?.imageUrl && (
            <img src={previewMap.imageUrl} alt={previewMap.name} className="w-full rounded-lg object-contain max-h-[60vh]" />
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {previewMap?.sections.map(s => (
              <Badge key={s.id} style={{ background: s.color + "22", color: s.color, border: `1px solid ${s.color}55` }}>
                {s.name} · ${s.price.toLocaleString()} · {s.capacity.toLocaleString()} lugares
              </Badge>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
