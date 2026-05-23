// client/src/components/admin-maps-tab.tsx
import { useState, useRef, useCallback, useEffect } from "react";
// Admin auth helper - uses admin_token from localStorage like the rest of admin panel
const adminRequest = async (method: string, url: string, body?: unknown) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error en la solicitud");
  return data;
};
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Map, Plus, Trash2, Eye, ImageIcon, Loader2,
  MousePointer, Square, Circle, Pentagon, Move, X, Check, Undo2
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ShapeType = "rect" | "ellipse" | "polygon";
type Tool = "select" | "rect" | "ellipse" | "polygon";

interface Section {
  id: string;
  name: string;
  color: string;
  price: number;
  capacity: number;
  shape: ShapeType;
  // rect & ellipse: x,y,w,h in % of canvas
  x?: number; y?: number; w?: number; h?: number;
  // polygon: points in % of canvas
  points?: { x: number; y: number }[];
}

interface VenueMap {
  id: string;
  name: string;
  imageUrl: string | null;
  sections: Section[];
  createdAt: string;
}

const COLORS = [
  "#3b82f6","#22c55e","#a855f7","#f59e0b","#ef4444",
  "#ec4899","#14b8a6","#f97316","#06b6d4","#8b5cf6",
];
// Auth handled by apiRequest (CSRF + cookies)

// ─── Shape Editor ─────────────────────────────────────────────────────────────

function ShapeEditor({
  imageUrl, sections, onChange,
}: {
  imageUrl: string;
  sections: Section[];
  onChange: (s: Section[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 600 });
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Partial<Section> | null>(null);
  const [polyPoints, setPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);
  const [editPanel, setEditPanel] = useState<Section | null>(null);
  const [imgNaturalRatio, setImgNaturalRatio] = useState(1);

  useEffect(() => {
    const update = () => {
      if (svgRef.current) {
        const r = svgRef.current.getBoundingClientRect();
        setSvgSize({ w: r.width, h: r.height });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const toSvgPx = useCallback((p: { x: number; y: number }) => ({
    x: (p.x / 100) * svgSize.w,
    y: (p.y / 100) * svgSize.h,
  }), [svgSize]);

  const getSVGPoint = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: parseFloat(((e.clientX - rect.left) / rect.width * 100).toFixed(2)),
      y: parseFloat(((e.clientY - rect.top) / rect.height * 100).toFixed(2)),
    };
  }, []);

  const finishShape = useCallback((sec: Partial<Section>) => {
    const colorIdx = sections.length % COLORS.length;
    const newSec: Section = {
      id: Date.now().toString(),
      name: `Sección ${sections.length + 1}`,
      color: COLORS[colorIdx],
      price: 0,
      capacity: 1000,
      shape: sec.shape!,
      ...sec,
    };
    const updated = [...sections, newSec];
    onChange(updated);
    setSelected(newSec.id);
    setEditPanel(newSec);
    setDraft(null);
    setDrawing(false);
    setTool("select");
  }, [sections, onChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === "select") return;
    e.preventDefault();
    const pt = getSVGPoint(e);
    if (tool === "polygon") {
      if (!drawing) {
        setDrawing(true);
        setPolyPoints([pt]);
      } else {
        // close if near first point
        if (polyPoints.length >= 3) {
          const dx = Math.abs(pt.x - polyPoints[0].x);
          const dy = Math.abs(pt.y - polyPoints[0].y);
          if (dx < 2 && dy < 2) {
            finishShape({ shape: "polygon", points: polyPoints });
            setPolyPoints([]);
            return;
          }
        }
        setPolyPoints(p => [...p, pt]);
      }
    } else {
      setDrawing(true);
      setDragStart(pt);
      setDraft({ shape: tool, x: pt.x, y: pt.y, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pt = getSVGPoint(e);
    setHoverPt(pt);
    if (!drawing || tool === "polygon") return;
    if (dragStart && draft) {
      const x = Math.min(dragStart.x, pt.x);
      const y = Math.min(dragStart.y, pt.y);
      const w = Math.abs(pt.x - dragStart.x);
      const h = Math.abs(pt.y - dragStart.y);
      setDraft(d => d ? { ...d, x, y, w, h } : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawing || tool === "polygon") return;
    if (draft && (draft.w || 0) > 1 && (draft.h || 0) > 1) {
      finishShape(draft);
    } else {
      setDraft(null);
      setDrawing(false);
    }
    setDragStart(null);
  };

  const finishPolygon = () => {
    if (polyPoints.length >= 3) {
      finishShape({ shape: "polygon", points: polyPoints });
      setPolyPoints([]);
    }
  };

  const updateSection = (id: string, key: keyof Section, value: unknown) => {
    const updated = sections.map(s => s.id === id ? { ...s, [key]: value } : s);
    onChange(updated);
    setEditPanel(prev => prev?.id === id ? { ...prev, [key]: value } as Section : prev);
  };

  const deleteSection = (id: string) => {
    onChange(sections.filter(s => s.id !== id));
    setSelected(null);
    setEditPanel(null);
  };

  const renderSection = (sec: Section, isSelected: boolean) => {
    const fill = sec.color + (isSelected ? "66" : "33");
    const stroke = sec.color;
    const sw = isSelected ? 2.5 : 1.5;
    const onClick = (e: React.MouseEvent) => {
      if (tool !== "select") return;
      e.stopPropagation();
      setSelected(sec.id);
      setEditPanel(sec);
    };

    // Label center
    let cx = 50, cy = 50;
    if (sec.shape === "polygon" && sec.points?.length) {
      cx = sec.points.reduce((s, p) => s + p.x, 0) / sec.points.length;
      cy = sec.points.reduce((s, p) => s + p.y, 0) / sec.points.length;
    } else {
      cx = (sec.x || 0) + (sec.w || 0) / 2;
      cy = (sec.y || 0) + (sec.h || 0) / 2;
    }

    const labelEl = (
      <>
        <text x={`${cx}%`} y={`${cy - 1}%`} textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fontWeight="700" fill="#fff"
          stroke="rgba(0,0,0,0.7)" strokeWidth="3" paintOrder="stroke">{sec.name}</text>
        <text x={`${cx}%`} y={`${cy - 1}%`} textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fontWeight="700" fill="#fff">{sec.name}</text>
        <text x={`${cx}%`} y={`${cy + 3.5}%`} textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fontWeight="600" fill={sec.color}>${sec.price.toLocaleString()}</text>
      </>
    );

    if (sec.shape === "polygon" && sec.points) {
      const pts = sec.points.map(p => { const px = toSvgPx(p); return `${px.x},${px.y}`; }).join(" ");
      return (
        <g key={sec.id} style={{ cursor: tool === "select" ? "pointer" : "default" }} onClick={onClick}>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
          {labelEl}
        </g>
      );
    }
    if (sec.shape === "ellipse") {
      return (
        <g key={sec.id} style={{ cursor: tool === "select" ? "pointer" : "default" }} onClick={onClick}>
          <ellipse
            cx={`${(sec.x || 0) + (sec.w || 0) / 2}%`}
            cy={`${(sec.y || 0) + (sec.h || 0) / 2}%`}
            rx={`${(sec.w || 0) / 2}%`}
            ry={`${(sec.h || 0) / 2}%`}
            fill={fill} stroke={stroke} strokeWidth={sw}
          />
          {labelEl}
        </g>
      );
    }
    // rect
    return (
      <g key={sec.id} style={{ cursor: tool === "select" ? "pointer" : "default" }} onClick={onClick}>
        <rect
          x={`${sec.x || 0}%`} y={`${sec.y || 0}%`}
          width={`${sec.w || 0}%`} height={`${sec.h || 0}%`}
          fill={fill} stroke={stroke} strokeWidth={sw} rx="4"
        />
        {labelEl}
      </g>
    );
  };

  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "select",  label: "Seleccionar", icon: <MousePointer className="h-4 w-4" /> },
    { id: "rect",    label: "Rectángulo",  icon: <Square className="h-4 w-4" /> },
    { id: "ellipse", label: "Elipse/Círculo", icon: <Circle className="h-4 w-4" /> },
    { id: "polygon", label: "Polígono libre", icon: <Pentagon className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg bg-muted/30 border border-border">
        {tools.map(t => (
          <Button key={t.id} type="button" size="sm" variant={tool === t.id ? "default" : "ghost"}
            className="gap-1.5" onClick={() => { setTool(t.id); if (t.id !== "polygon") { setDrawing(false); setPolyPoints([]); } }}>
            {t.icon} {t.label}
          </Button>
        ))}
        {tool === "polygon" && drawing && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <Button type="button" size="sm" variant="default" onClick={finishPolygon} disabled={polyPoints.length < 3} className="gap-1.5">
              <Check className="h-3.5 w-3.5" /> Cerrar ({polyPoints.length} pts)
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPolyPoints(p => p.slice(0, -1))} disabled={polyPoints.length === 0} className="gap-1.5">
              <Undo2 className="h-3.5 w-3.5" /> Deshacer
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setDrawing(false); setPolyPoints([]); }}>
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
          </>
        )}
        {tool !== "select" && tool !== "polygon" && (
          <span className="text-xs text-muted-foreground ml-2">Arrastra para dibujar la forma</span>
        )}
        {tool === "polygon" && !drawing && (
          <span className="text-xs text-muted-foreground ml-2">Haz clic en el mapa para agregar puntos</span>
        )}
        {tool === "select" && (
          <span className="text-xs text-muted-foreground ml-2">Haz clic en una sección para editarla</span>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-border select-none"
        style={{ cursor: tool === "select" ? "default" : tool === "polygon" ? "crosshair" : "crosshair" }}>
        <img src={imageUrl} alt="Recinto" className="w-full h-auto block pointer-events-none" draggable={false} />
        <svg ref={svgRef} className="absolute inset-0 w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => { if (tool === "select") { setSelected(null); setEditPanel(null); } }}
        >
          {/* Saved sections */}
          {sections.map(sec => renderSection(sec, selected === sec.id))}

          {/* Draft while dragging rect/ellipse */}
          {draft && draft.shape !== "polygon" && (draft.w || 0) > 0 && (
            draft.shape === "ellipse" ? (
              <ellipse
                cx={`${(draft.x || 0) + (draft.w || 0) / 2}%`}
                cy={`${(draft.y || 0) + (draft.h || 0) / 2}%`}
                rx={`${(draft.w || 0) / 2}%`}
                ry={`${(draft.h || 0) / 2}%`}
                fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth="2" strokeDasharray="6,3"
              />
            ) : (
              <rect x={`${draft.x || 0}%`} y={`${draft.y || 0}%`}
                width={`${draft.w || 0}%`} height={`${draft.h || 0}%`}
                fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth="2" strokeDasharray="6,3" rx="4"
              />
            )
          )}

          {/* Polygon in progress */}
          {tool === "polygon" && polyPoints.length > 0 && (
            <>
              <polyline
                points={[...polyPoints, hoverPt || polyPoints[polyPoints.length - 1]].map(p => { const px = toSvgPx(p); return `${px.x},${px.y}`; }).join(" ")}
                fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="6,3"
              />
              {polyPoints.map((pt, i) => (
                <circle key={i}
                  cx={`${pt.x}%`} cy={`${pt.y}%`}
                  r="5" fill={i === 0 ? "#22c55e" : "#fff"} stroke="#000" strokeWidth="1.5"
                />
              ))}
            </>
          )}
        </svg>
      </div>

      {/* Edit panel for selected section */}
      {editPanel && (
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: editPanel.color }} />
              Editando: {editPanel.name}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="destructive" size="sm" className="gap-1.5 h-7"
                onClick={() => deleteSection(editPanel.id)}>
                <Trash2 className="h-3 w-3" /> Eliminar
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => { setEditPanel(null); setSelected(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre de la sección</Label>
              <Input value={editPanel.name} className="h-8 text-sm"
                onChange={e => { updateSection(editPanel.id, "name", e.target.value); setEditPanel(s => s ? { ...s, name: e.target.value } : null); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {COLORS.map(c => (
                  <button type="button" key={c} onClick={() => { updateSection(editPanel.id, "color", c); setEditPanel(s => s ? { ...s, color: c } : null); }}
                    className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110"
                    style={{ background: c, borderColor: editPanel.color === c ? "#fff" : "transparent" }} />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio (MXN)</Label>
              <Input type="number" value={editPanel.price} className="h-8 text-sm"
                onChange={e => { const v = parseFloat(e.target.value) || 0; updateSection(editPanel.id, "price", v); setEditPanel(s => s ? { ...s, price: v } : null); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Capacidad</Label>
              <Input type="number" value={editPanel.capacity} className="h-8 text-sm"
                onChange={e => { const v = parseInt(e.target.value) || 0; updateSection(editPanel.id, "capacity", v); setEditPanel(s => s ? { ...s, capacity: v } : null); }} />
            </div>
          </div>
        </div>
      )}

      {/* Section chips */}
      {sections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sections.map(s => (
            <button type="button" key={s.id}
              onClick={() => { setSelected(s.id); setEditPanel(s); setTool("select"); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
              style={{ background: s.color + "22", color: s.color, borderColor: s.color + "66",
                outline: selected === s.id ? `2px solid ${s.color}` : "none" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              {s.name} · ${s.price.toLocaleString()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Map Viewer (público, para checkout) ──────────────────────────────────────

export function MapViewer({ map, onSelect }: { map: VenueMap; onSelect?: (s: Section) => void }) {
  const [sel, setSel] = useState<Section | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!map.imageUrl) return null;

  const renderSec = (sec: Section) => {
    const isSel = sel?.id === sec.id;
    const fill = sec.color + (isSel ? "66" : "33");
    const sw = isSel ? 3 : 1.5;
    const click = (e: React.MouseEvent) => { e.stopPropagation(); setSel(sec); onSelect?.(sec); };

    let cx = 50, cy = 50;
    if (sec.shape === "polygon" && sec.points?.length) {
      cx = sec.points.reduce((s, p) => s + p.x, 0) / sec.points.length;
      cy = sec.points.reduce((s, p) => s + p.y, 0) / sec.points.length;
    } else { cx = (sec.x||0)+(sec.w||0)/2; cy = (sec.y||0)+(sec.h||0)/2; }

    const label = (
      <>
        <text x={`${cx}%`} y={`${cy}%`} textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,0.7)" strokeWidth="3" paintOrder="stroke">{sec.name}</text>
        <text x={`${cx}%`} y={`${cy}%`} textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fontWeight="700" fill="#fff">{sec.name}</text>
        <text x={`${cx}%`} y={`${cy+4}%`} textAnchor="middle" dominantBaseline="middle"
          fontSize="10" fill={sec.color} fontWeight="600">${sec.price.toLocaleString()}</text>
      </>
    );

    if (sec.shape === "polygon" && sec.points) {
      return <g key={sec.id} style={{cursor:"pointer"}} onClick={click}>
        <polygon points={sec.points.map(p=>`${p.x},${p.y}`).join(" ")} fill={fill} stroke={sec.color} strokeWidth={sw}/>{label}</g>;
    }
    if (sec.shape === "ellipse") {
      return <g key={sec.id} style={{cursor:"pointer"}} onClick={click}>
        <ellipse cx={`${(sec.x||0)+(sec.w||0)/2}`} cy={`${(sec.y||0)+(sec.h||0)/2}`}
          rx={`${(sec.w||0)/2}`} ry={`${(sec.h||0)/2}`} fill={fill} stroke={sec.color} strokeWidth={sw}/>{label}</g>;
    }
    return <g key={sec.id} style={{cursor:"pointer"}} onClick={click}>
      <rect x={`${sec.x||0}`} y={`${sec.y||0}`} width={`${sec.w||0}`} height={`${sec.h||0}`}
        fill={fill} stroke={sec.color} strokeWidth={sw} rx="4"/>{label}</g>;
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-border">
        <img src={map.imageUrl} alt={map.name} className="w-full h-auto block" draggable={false} />
        <svg ref={svgRef} className="absolute inset-0 w-full h-full" onClick={() => setSel(null)}>
          {map.sections.map(renderSec)}
        </svg>
      </div>
      {sel && (
        <div className="rounded-lg border p-3 flex items-center justify-between"
          style={{ borderColor: sel.color+"55", background: sel.color+"11" }}>
          <div>
            <p className="font-semibold text-sm">{sel.name}</p>
            <p className="text-xs text-muted-foreground">{sel.capacity.toLocaleString()} lugares</p>
          </div>
          <p className="text-lg font-bold" style={{ color: sel.color }}>${sel.price.toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

// ─── Admin Maps Tab ───────────────────────────────────────────────────────────

export function AdminMapsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<VenueMap | null>(null);
  const [mapName, setMapName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);

  const { data: maps = [], isLoading } = useQuery<VenueMap[]>({
    queryKey: ["/api/venue-maps"],
    queryFn: async () => {
      return await adminRequest("GET", "/api/venue-maps");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; imageUrl: string; sections: Section[] }) => {
      return await adminRequest("POST", "/api/venue-maps", payload);
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["/api/venue-maps"] });
      toast({ title: "✅ Mapa guardado", description: `"${created.name}" listo para usar en eventos.` });
      resetForm();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await adminRequest("DELETE", `/api/venue-maps/${id}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/venue-maps"] }); toast({ title: "Mapa eliminado" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => { setOpen(false); setMapName(""); setImagePreview(null); setSections([]); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!mapName.trim()) return toast({ title: "Escribe un nombre para el mapa", variant: "destructive" });
    if (!imagePreview) return toast({ title: "Sube la imagen del recinto", variant: "destructive" });
    createMutation.mutate({ name: mapName, imageUrl: imagePreview, sections });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Mapas de Recintos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crea mapas reutilizables — se asignan a eventos al publicarlos.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Crear mapa
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : maps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Map className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Sin mapas todavía</p>
              <p className="text-sm text-muted-foreground mt-1">Sube la imagen de un recinto y dibuja las secciones con las herramientas de forma.</p>
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
              <div className="relative h-44 bg-muted overflow-hidden">
                {m.imageUrl
                  ? <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                  : <div className="flex items-center justify-center h-full text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>
                }
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur rounded-full px-2 py-1 text-xs text-white font-medium">
                  {(m.sections||[]).length} secciones
                </div>
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={() => setPreview(m)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" size="icon" variant="destructive" className="h-7 w-7"
                    onClick={() => deleteMutation.mutate(m.id)} disabled={deleteMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold line-clamp-1">{m.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <div className="flex flex-wrap gap-1">
                  {(m.sections||[]).map((s: Section) => (
                    <span key={s.id} style={{ background: s.color+"22", color: s.color, border: `1px solid ${s.color}55` }}
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

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); else setOpen(true); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear mapa de recinto</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label>Nombre del mapa *</Label>
              <Input placeholder="Ej. Estadio Azteca — Vista General" value={mapName} onChange={e => setMapName(e.target.value)} />
              <p className="text-xs text-muted-foreground">Este mapa se podrá reutilizar en múltiples eventos.</p>
            </div>

            {!imagePreview ? (
              <div className="space-y-1.5">
                <Label>Imagen del recinto *</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={() => document.getElementById("venue-img-upload")?.click()}>
                  <input id="venue-img-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Sube la imagen del recinto</p>
                  <p className="text-xs text-muted-foreground mt-1">Imagen cenital o plano del lugar · PNG, JPG</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Editor de secciones</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setImagePreview(null); setSections([]); }} className="text-xs gap-1">
                    <X className="h-3.5 w-3.5" /> Cambiar imagen
                  </Button>
                </div>
                <div className="rounded-lg bg-muted/20 border border-border p-3 text-xs text-muted-foreground space-y-1">
                  <p><strong className="text-foreground">Rectángulo:</strong> arrastra para crear zonas rectangulares (palcos, tribuna)</p>
                  <p><strong className="text-foreground">Elipse/Círculo:</strong> arrastra para estadios, foros circulares, semicírculos</p>
                  <p><strong className="text-foreground">Polígono libre:</strong> haz clic punto por punto para formas irregulares</p>
                  <p><strong className="text-foreground">Seleccionar:</strong> haz clic en una sección para editar nombre, color y precio</p>
                </div>
                <ShapeEditor imageUrl={imagePreview} sections={sections} onChange={setSections} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button type="button" onClick={handleSave} disabled={createMutation.isPending || !imagePreview || !mapName.trim()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar mapa{sections.length > 0 ? ` (${sections.length} secciones)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
          {preview && <MapViewer map={preview} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
