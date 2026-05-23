// client/src/components/admin-maps-tab.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEvents } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Map, Plus, Trash2, Eye, ImageIcon, Loader2, Pencil, Check, X, MousePointer, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }

interface Section {
  id: string;
  name: string;
  color: string;
  price: number;
  capacity: number;
  points: Point[]; // polygon points as % of image dimensions
}

interface EventMap {
  id: string;
  eventId: string;
  name: string;
  imageUrl: string | null;
  sections: Section[];
  createdAt: string;
}

const COLORS = ["#22c55e","#a855f7","#f59e0b","#ef4444","#3b82f6","#ec4899","#14b8a6","#f97316","#8b5cf6","#06b6d4"];
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

// ─── Map Editor Component ─────────────────────────────────────────────────────

function MapEditor({ imageUrl, sections, onChange }: {
  imageUrl: string;
  sections: Section[];
  onChange: (sections: Section[]) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [hoverPt, setHoverPt] = useState<Point | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current) {
      const update = () => setImgSize({ w: imgRef.current!.offsetWidth, h: imgRef.current!.offsetHeight });
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
  }, [imageUrl]);

  const getRelativePoint = useCallback((e: React.MouseEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: parseFloat(((e.clientX - rect.left) / rect.width * 100).toFixed(2)),
      y: parseFloat(((e.clientY - rect.top) / rect.height * 100).toFixed(2)),
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!drawing) return;
    const pt = getRelativePoint(e);

    // Check if clicking near first point to close polygon
    if (currentPoints.length >= 3) {
      const first = currentPoints[0];
      const dx = Math.abs(pt.x - first.x);
      const dy = Math.abs(pt.y - first.y);
      if (dx < 2 && dy < 2) {
        finishPolygon();
        return;
      }
    }
    setCurrentPoints(p => [...p, pt]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    setHoverPt(getRelativePoint(e));
  };

  const finishPolygon = () => {
    if (currentPoints.length < 3) return;
    const colorIndex = sections.length % COLORS.length;
    const newSection: Section = {
      id: Date.now().toString(),
      name: `Sección ${sections.length + 1}`,
      color: COLORS[colorIndex],
      price: 0,
      capacity: 1000,
      points: currentPoints,
    };
    const updated = [...sections, newSection];
    onChange(updated);
    setCurrentPoints([]);
    setDrawing(false);
    setHoverPt(null);
    setEditingSection(newSection);
  };

  const deleteSection = (id: string) => {
    onChange(sections.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateSection = (id: string, key: keyof Section, value: unknown) => {
    const updated = sections.map(s => s.id === id ? { ...s, [key]: value } : s);
    onChange(updated);
    if (editingSection?.id === id) setEditingSection(prev => prev ? { ...prev, [key]: value } : null);
  };

  const pointsToSvgPolygon = (points: Point[]) =>
    points.map(p => `${p.x}% ${p.y}%`).join(", ");

  const undoLastPoint = () => setCurrentPoints(p => p.slice(0, -1));

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {!drawing ? (
          <Button type="button" size="sm" onClick={() => { setDrawing(true); setCurrentPoints([]); setSelectedId(null); }}
            className="gap-2">
            <Pencil className="h-3.5 w-3.5" /> Dibujar sección
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" variant="default" onClick={finishPolygon} disabled={currentPoints.length < 3} className="gap-2">
              <Check className="h-3.5 w-3.5" /> Cerrar forma ({currentPoints.length} pts)
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={undoLastPoint} disabled={currentPoints.length === 0} className="gap-2">
              <Undo2 className="h-3.5 w-3.5" /> Deshacer punto
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setDrawing(false); setCurrentPoints([]); setHoverPt(null); }}>
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <span className="text-xs text-muted-foreground">Haz clic para agregar puntos. Cierra la forma haciendo clic en el primer punto o en "Cerrar forma".</span>
          </>
        )}
        {!drawing && sections.length > 0 && (
          <span className="text-xs text-muted-foreground ml-2">
            <MousePointer className="h-3 w-3 inline mr-1" />Clic en sección para editar
          </span>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative rounded-xl overflow-hidden border border-border select-none"
        style={{ cursor: drawing ? "crosshair" : "default" }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Recinto"
          className="w-full h-auto block"
          draggable={false}
        />

        {/* SVG overlay */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: drawing ? "none" : "all" }}>
          {/* Existing sections */}
          {sections.map(sec => (
            <g key={sec.id} style={{ cursor: "pointer" }} onClick={() => { if (!drawing) { setSelectedId(sec.id); setEditingSection(sec); } }}>
              <polygon
                points={sec.points.map(p => `${(p.x / 100) * (imgRef.current?.offsetWidth || 100)},${(p.y / 100) * (imgRef.current?.offsetHeight || 100)}`).join(" ")}
                fill={sec.color + (selectedId === sec.id ? "55" : "33")}
                stroke={sec.color}
                strokeWidth={selectedId === sec.id ? 2.5 : 1.5}
                strokeDasharray={selectedId === sec.id ? "none" : "none"}
              />
              {/* Label */}
              {(() => {
                const cx = sec.points.reduce((s, p) => s + p.x, 0) / sec.points.length;
                const cy = sec.points.reduce((s, p) => s + p.y, 0) / sec.points.length;
                const px = (cx / 100) * (imgRef.current?.offsetWidth || 100);
                const py = (cy / 100) * (imgRef.current?.offsetHeight || 100);
                return (
                  <g>
                    <text x={px} y={py - 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)", paintOrder: "stroke" }}
                      stroke="rgba(0,0,0,0.6)" strokeWidth="3">
                      {sec.name}
                    </text>
                    <text x={px} y={py - 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">{sec.name}</text>
                    <text x={px} y={py + 11} textAnchor="middle" fill={sec.color} fontSize="10" fontWeight="600">
                      ${sec.price.toLocaleString()}
                    </text>
                  </g>
                );
              })()}
            </g>
          ))}

          {/* Current drawing polygon */}
          {drawing && currentPoints.length > 0 && (
            <>
              <polyline
                points={[...currentPoints, hoverPt || currentPoints[currentPoints.length - 1]]
                  .map(p => `${(p.x / 100) * (imgRef.current?.offsetWidth || 100)},${(p.y / 100) * (imgRef.current?.offsetHeight || 100)}`).join(" ")}
                fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6,3"
              />
              {currentPoints.map((pt, i) => (
                <circle key={i}
                  cx={(pt.x / 100) * (imgRef.current?.offsetWidth || 100)}
                  cy={(pt.y / 100) * (imgRef.current?.offsetHeight || 100)}
                  r={i === 0 ? 7 : 4}
                  fill={i === 0 ? "#22c55e" : "#fff"}
                  stroke="#000" strokeWidth="1.5"
                />
              ))}
            </>
          )}
        </svg>
      </div>

      {/* Section editor panel */}
      {editingSection && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Editando sección</span>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSection(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre</Label>
              <Input value={editingSection.name} className="h-8 text-sm"
                onChange={e => { updateSection(editingSection.id, "name", e.target.value); setEditingSection(s => s ? { ...s, name: e.target.value } : null); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map(c => (
                  <button type="button" key={c} onClick={() => { updateSection(editingSection.id, "color", c); setEditingSection(s => s ? { ...s, color: c } : null); }}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: editingSection.color === c ? "#fff" : "transparent" }} />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio (MXN)</Label>
              <Input type="number" value={editingSection.price} className="h-8 text-sm"
                onChange={e => { const v = parseFloat(e.target.value) || 0; updateSection(editingSection.id, "price", v); setEditingSection(s => s ? { ...s, price: v } : null); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Capacidad</Label>
              <Input type="number" value={editingSection.capacity} className="h-8 text-sm"
                onChange={e => { const v = parseInt(e.target.value) || 0; updateSection(editingSection.id, "capacity", v); setEditingSection(s => s ? { ...s, capacity: v } : null); }} />
            </div>
          </div>
          <Button type="button" variant="destructive" size="sm" onClick={() => { deleteSection(editingSection.id); setEditingSection(null); }} className="gap-2">
            <Trash2 className="h-3.5 w-3.5" /> Eliminar sección
          </Button>
        </div>
      )}

      {/* Sections list */}
      {sections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sections.map(s => (
            <button type="button" key={s.id} onClick={() => { setSelectedId(s.id); setEditingSection(s); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
              style={{
                background: s.color + "22", color: s.color, borderColor: s.color + "55",
                outline: selectedId === s.id ? `2px solid ${s.color}` : "none",
              }}>
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.name} · ${s.price.toLocaleString()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Map Viewer (for users at checkout) ──────────────────────────────────────

export function MapViewer({ map, onSelect }: { map: EventMap; onSelect?: (section: Section) => void }) {
  const [selected, setSelected] = useState<Section | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      if (imgRef.current) setImgSize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [map.imageUrl]);

  if (!map.imageUrl) return null;

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-border">
        <img ref={imgRef} src={map.imageUrl} alt={map.name} className="w-full h-auto block" draggable={false}
          onLoad={() => setImgSize({ w: imgRef.current!.offsetWidth, h: imgRef.current!.offsetHeight })} />
        <svg className="absolute inset-0 w-full h-full">
          {map.sections.map(sec => {
            const isSelected = selected?.id === sec.id;
            const pts = sec.points.map(p => `${(p.x / 100) * imgSize.w},${(p.y / 100) * imgSize.h}`).join(" ");
            const cx = sec.points.reduce((s, p) => s + p.x, 0) / sec.points.length;
            const cy = sec.points.reduce((s, p) => s + p.y, 0) / sec.points.length;
            return (
              <g key={sec.id} style={{ cursor: "pointer" }} onClick={() => { setSelected(sec); onSelect?.(sec); }}>
                <polygon points={pts} fill={sec.color + (isSelected ? "66" : "33")} stroke={sec.color}
                  strokeWidth={isSelected ? 3 : 1.5} />
                <text x={(cx / 100) * imgSize.w} y={(cy / 100) * imgSize.h - 4}
                  textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700"
                  stroke="rgba(0,0,0,0.7)" strokeWidth="3" paintOrder="stroke">{sec.name}</text>
                <text x={(cx / 100) * imgSize.w} y={(cy / 100) * imgSize.h - 4}
                  textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700">{sec.name}</text>
                <text x={(cx / 100) * imgSize.w} y={(cy / 100) * imgSize.h + 12}
                  textAnchor="middle" fill={sec.color} fontSize="11" fontWeight="600">
                  ${sec.price.toLocaleString()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {selected && (
        <div className="rounded-lg border p-3 flex items-center justify-between" style={{ borderColor: selected.color + "55", background: selected.color + "11" }}>
          <div>
            <p className="font-semibold text-sm">{selected.name}</p>
            <p className="text-xs text-muted-foreground">{selected.capacity.toLocaleString()} lugares disponibles</p>
          </div>
          <p className="text-lg font-bold" style={{ color: selected.color }}>${selected.price.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

// ─── Admin Maps Tab ───────────────────────────────────────────────────────────

const DEFAULT_SECTIONS: Section[] = [];

export function AdminMapsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: events = [] } = useEvents();

  const [open, setOpen] = useState(false);
  const [previewMap, setPreviewMap] = useState<EventMap | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [mapName, setMapName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: maps = [], isLoading } = useQuery<EventMap[]>({
    queryKey: ["/api/event-maps"],
    queryFn: async () => {
      const res = await fetch("/api/event-maps", { headers: authHeader() });
      if (!res.ok) throw new Error("Error cargando mapas");
      return res.json();
    },
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (payload: { eventId: string; name: string; imageUrl: string | null; sections: Section[] }) => {
      const res = await fetch("/api/event-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error guardando mapa");
      return json;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-maps"] });
      toast({ title: "✅ Mapa guardado", description: `"${created.name}" guardado correctamente.` });
      resetForm();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/event-maps/${id}`, { method: "DELETE", headers: authHeader() });
      if (!res.ok) throw new Error("Error eliminando mapa");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-maps"] });
      toast({ title: "Mapa eliminado" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const resetForm = () => {
    setOpen(false);
    setSelectedEventId("");
    setMapName("");
    setImagePreview(null);
    setSections([]);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!selectedEventId || !mapName) {
      toast({ title: "Completa los campos requeridos", variant: "destructive" });
      return;
    }
    if (!imagePreview) {
      toast({ title: "Sube una imagen del recinto", variant: "destructive" });
      return;
    }
    createMutation.mutate({ eventId: selectedEventId, name: mapName, imageUrl: imagePreview, sections });
  };

  const getEventTitle = (id: string) => (events as any[]).find(e => e.id === id)?.title || id;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Mapas de Recintos</h2>
          <p className="text-sm text-muted-foreground mt-1">Crea mapas interactivos por evento. Sube la imagen del recinto y dibuja las secciones encima.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Crear mapa
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : maps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Map className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Sin mapas todavía</p>
              <p className="text-sm text-muted-foreground mt-1">Sube la imagen de un recinto y dibuja las secciones encima para crear tu primer mapa interactivo.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Crear primer mapa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {maps.map(m => (
            <Card key={m.id} className="overflow-hidden">
              <div className="relative h-44 bg-muted flex items-center justify-center overflow-hidden">
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                )}
                {/* Section count overlay */}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 text-xs text-white font-medium">
                  {(m.sections || []).length} secciones
                </div>
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={() => setPreviewMap(m)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="destructive" className="h-7 w-7"
                    onClick={() => deleteMutation.mutate(m.id)} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold leading-tight line-clamp-1">{m.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-1">{getEventTitle(m.eventId)}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <div className="flex flex-wrap gap-1">
                  {(m.sections || []).map((s: Section) => (
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

      {/* Create Map Dialog */}
      <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); else setOpen(true); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear mapa interactivo</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Evento *</Label>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona el evento..." /></SelectTrigger>
                  <SelectContent>
                    {(events as any[]).map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title} — {format(new Date(e.date), "dd MMM yyyy", { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nombre del mapa *</Label>
                <Input placeholder="Ej. Foro Sol — Bad Bunny" value={mapName} onChange={e => setMapName(e.target.value)} />
              </div>
            </div>

            {!imagePreview ? (
              <div className="space-y-1.5">
                <Label>Imagen del recinto *</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={() => document.getElementById("map-img-upload")?.click()}>
                  <input id="map-img-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Arrastra o <span className="text-primary font-medium">haz clic</span> para subir la imagen del recinto</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG · Recomendado: imagen cenital del recinto</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Editor de secciones</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setImagePreview(null); setSections([]); }} className="text-xs">
                    <X className="h-3.5 w-3.5 mr-1" /> Cambiar imagen
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Haz clic en <strong>"Dibujar sección"</strong> y luego haz clic en el mapa para trazar los puntos del polígono. Cierra la forma haciendo clic en el primer punto.
                </p>
                <MapEditor imageUrl={imagePreview} sections={sections} onChange={setSections} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={createMutation.isPending || !imagePreview}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar mapa {sections.length > 0 && `(${sections.length} secciones)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewMap} onOpenChange={() => setPreviewMap(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{previewMap?.name}</DialogTitle></DialogHeader>
          {previewMap && <MapViewer map={previewMap} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
