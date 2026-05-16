import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateEvent } from "@/lib/api";
import {
  Plus, Trash2, ChevronRight, ChevronLeft,
  MapPin, Calendar, Ticket, Upload, CheckCircle2,
  MessageCircle, Star, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketType {
  id: number;
  name: string;
  basePrice: string;
  resellerPrice: string;
  available: string;
  section: string;
  benefits: string;
}

interface SectionData {
  name: string;
  price: string;
  capacity: string;
  color: string;
}

interface FormData {
  title: string;
  category: string;
  city: string;
  date: string;
  time: string;
  artist: string;
  description: string;
  venue: string;
  address: string;
  totalCapacity: string;
  featured: boolean;
  allowResale: boolean;
  whatsappAlerts: boolean;
  tags: string[];
  tickets: TicketType[];
  activeSections: string[];
  deliveryMethods: string[];
  minResalePrice: string;
  maxResalePrice: string;
  platformFee: string;
  saleCloseDate: string;
  resaleCloseDate: string;
  publishStatus: "published" | "draft" | "scheduled";
  scheduledAt: string;
}

// ─── Static data ─────────────────────────────────────────────────────────────

const STEPS = [
  { label: "General", icon: Star },
  { label: "Venue & Mapa", icon: MapPin },
  { label: "Boletos", icon: Ticket },
  { label: "Publicar", icon: Zap },
];

const VENUES: Record<string, { label: string; address: string; capacity: string }> = {
  foro_sol:    { label: "Foro Sol — CDMX",              address: "Viaducto Piedad 9, Granjas México, CDMX",                   capacity: "65000" },
  azteca:      { label: "Estadio Azteca — CDMX",        address: "Calz. de Tlalpan 3465, Santa Úrsula Coapa, CDMX",          capacity: "87000" },
  palacio:     { label: "Palacio de los Deportes — CDMX",address: "Av. del Conscripto 311, Lomas de Sotelo, CDMX",            capacity: "22000" },
  akron:       { label: "Estadio Akron — GDL",          address: "Av. Paseo de la Arboleda 7050, Zapopan, Jalisco",          capacity: "49850" },
  bbva:        { label: "Estadio BBVA — MTY",           address: "Av. Fundidora s/n, Monterrey, Nuevo León",                 capacity: "53500" },
  arena_cdmx:  { label: "Arena Ciudad de México",       address: "Av. de los Insurgentes Sur 3000, CDMX",                    capacity: "22300" },
};

const SECTIONS: Record<string, SectionData> = {
  norte:       { name: "Norte",      price: "800",  capacity: "8,000",  color: "#1e3a5a" },
  sur:         { name: "Sur",        price: "800",  capacity: "8,000",  color: "#1e3a5a" },
  este:        { name: "Este",       price: "600",  capacity: "6,000",  color: "#1a3a5a" },
  oeste:       { name: "Oeste",      price: "600",  capacity: "6,000",  color: "#1a3a5a" },
  vip:         { name: "VIP Floor",  price: "3500", capacity: "500",    color: "#004d3a" },
  alto_norte:  { name: "Alto Norte", price: "350",  capacity: "10,000", color: "#2a1a3a" },
  alto_sur:    { name: "Alto Sur",   price: "350",  capacity: "10,000", color: "#2a1a3a" },
  alto_oeste:  { name: "Alto Oeste", price: "350",  capacity: "8,000",  color: "#2a1a3a" },
  alto_este:   { name: "Alto Este",  price: "350",  capacity: "8,000",  color: "#2a1a3a" },
};

const TAGS = ["🔥 Trending", "Últimas fechas", "Sold out soon", "VIP disponible", "Familia", "Outdoor", "18+"];
const DELIVERY = ["📱 QR WhatsApp", "✉️ Email", "📄 PDF descargable", "🏪 Pickup presencial"];

const DEFAULT_FORM: FormData = {
  title: "", category: "", city: "", date: "", time: "21:00",
  artist: "", description: "", venue: "", address: "", totalCapacity: "",
  featured: false, allowResale: true, whatsappAlerts: true,
  tags: [], tickets: [
    { id: 1, name: "General",   basePrice: "", resellerPrice: "", available: "", section: "Norte",     benefits: "" },
    { id: 2, name: "VIP Floor", basePrice: "", resellerPrice: "", available: "", section: "VIP Floor", benefits: "" },
  ],
  activeSections: [], deliveryMethods: ["📱 QR WhatsApp"],
  minResalePrice: "", maxResalePrice: "", platformFee: "10",
  saleCloseDate: "", resaleCloseDate: "",
  publishStatus: "published", scheduledAt: "",
};

// ─── Venue SVG Map ────────────────────────────────────────────────────────────

function VenueMap({ active, onToggle }: { active: string[]; onToggle: (id: string) => void }) {
  const isOn = (id: string) => active.includes(id);
  const sectionClass = (id: string) =>
    cn("cursor-pointer transition-opacity duration-150 hover:opacity-75", isOn(id) && "drop-shadow-[0_0_6px_rgba(0,229,160,0.8)]");
  const stroke = (id: string) => isOn(id) ? "#00e5a0" : undefined;
  const sw = (id: string) => isOn(id) ? 2 : 0.5;

  return (
    <svg viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto rounded-lg bg-[#0d0d0d]">
      <defs>
        <radialGradient id="fg" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#1a3a1a" />
          <stop offset="100%" stopColor="#0d220d" />
        </radialGradient>
      </defs>

      {/* Field */}
      <ellipse cx="200" cy="160" rx="90" ry="65" fill="url(#fg)" stroke="#2a4a2a" strokeWidth="1" />
      <ellipse cx="200" cy="160" rx="60" ry="40" fill="none" stroke="#2a4a2a" strokeWidth="0.5" strokeDasharray="4,3" />
      <text x="200" y="164" textAnchor="middle" fill="#3a6a3a" fontSize="10" fontFamily="system-ui">CAMPO</text>
      <rect x="158" y="95" width="84" height="20" rx="4" fill="#1a1a2a" stroke="#333" strokeWidth="1" />
      <text x="200" y="109" textAnchor="middle" fill="#555" fontSize="8" fontFamily="system-ui">ESCENARIO</text>

      {/* Cancha sections */}
      <g className={sectionClass("norte")} onClick={() => onToggle("norte")}>
        <path d="M130,90 Q200,60 270,90 L270,95 Q200,65 130,95 Z" fill="#1e3a5a" stroke={stroke("norte")} strokeWidth={sw("norte")} />
        <text x="200" y="80" textAnchor="middle" fill="#6ab0ff" fontSize="9" fontFamily="system-ui">Norte · $800</text>
      </g>
      <g className={sectionClass("sur")} onClick={() => onToggle("sur")}>
        <path d="M130,230 Q200,260 270,230 L270,225 Q200,255 130,225 Z" fill="#1e3a5a" stroke={stroke("sur")} strokeWidth={sw("sur")} />
        <text x="200" y="252" textAnchor="middle" fill="#6ab0ff" fontSize="9" fontFamily="system-ui">Sur · $800</text>
      </g>
      <g className={sectionClass("oeste")} onClick={() => onToggle("oeste")}>
        <path d="M90,110 L110,95 L115,225 L90,210 Z" fill="#1a3a5a" stroke={stroke("oeste")} strokeWidth={sw("oeste")} />
        <text x="88" y="163" textAnchor="middle" fill="#6ab0ff" fontSize="8" fontFamily="system-ui" transform="rotate(-90,88,163)">Oeste · $600</text>
      </g>
      <g className={sectionClass("este")} onClick={() => onToggle("este")}>
        <path d="M290,110 L310,95 L310,225 L285,225 Z" fill="#1a3a5a" stroke={stroke("este")} strokeWidth={sw("este")} />
        <text x="312" y="163" textAnchor="middle" fill="#6ab0ff" fontSize="8" fontFamily="system-ui" transform="rotate(90,312,163)">Este · $600</text>
      </g>

      {/* VIP Floor */}
      <g className={sectionClass("vip")} onClick={() => onToggle("vip")}>
        <path d="M130,130 Q200,115 270,130 L270,195 Q200,210 130,195 Z" fill="rgba(0,229,160,0.06)" stroke={isOn("vip") ? "#00e5a0" : "#00e5a0"} strokeWidth={isOn("vip") ? 2 : 1} strokeDasharray={isOn("vip") ? "none" : "4,3"} />
        <text x="200" y="175" textAnchor="middle" fill="#00e5a0" fontSize="9" fontWeight="bold" fontFamily="system-ui">VIP Floor · $3,500</text>
      </g>

      {/* Upper tiers */}
      <g className={sectionClass("alto_norte")} onClick={() => onToggle("alto_norte")}>
        <path d="M115,90 Q200,48 285,90 L270,90 Q200,55 130,90 Z" fill="#2a1a3a" stroke={stroke("alto_norte")} strokeWidth={sw("alto_norte")} />
        <text x="200" y="60" textAnchor="middle" fill="#b08ae0" fontSize="8" fontFamily="system-ui">Alto Norte · $350</text>
      </g>
      <g className={sectionClass("alto_sur")} onClick={() => onToggle("alto_sur")}>
        <path d="M115,230 Q200,272 285,230 L270,230 Q200,265 130,230 Z" fill="#2a1a3a" stroke={stroke("alto_sur")} strokeWidth={sw("alto_sur")} />
        <text x="200" y="272" textAnchor="middle" fill="#b08ae0" fontSize="8" fontFamily="system-ui">Alto Sur · $350</text>
      </g>
      <g className={sectionClass("alto_oeste")} onClick={() => onToggle("alto_oeste")}>
        <path d="M60,105 L90,110 L90,210 L60,215 Z" fill="#2a1a3a" stroke={stroke("alto_oeste")} strokeWidth={sw("alto_oeste")} />
        <text x="55" y="163" textAnchor="middle" fill="#b08ae0" fontSize="7" fontFamily="system-ui" transform="rotate(-90,55,163)">Alt.Oe · $350</text>
      </g>
      <g className={sectionClass("alto_este")} onClick={() => onToggle("alto_este")}>
        <path d="M310,105 L340,110 L340,210 L310,215 Z" fill="#2a1a3a" stroke={stroke("alto_este")} strokeWidth={sw("alto_este")} />
        <text x="345" y="163" textAnchor="middle" fill="#b08ae0" fontSize="7" fontFamily="system-ui" transform="rotate(90,345,163)">Alt.Est · $350</text>
      </g>

      {/* Legend */}
      <rect x="15" y="282" width="10" height="10" rx="2" fill="rgba(0,229,160,.15)" stroke="#00e5a0" strokeWidth="1" />
      <text x="30" y="291" fill="#666" fontSize="9" fontFamily="system-ui">VIP</text>
      <rect x="58" y="282" width="10" height="10" rx="2" fill="#1e3a5a" stroke="#2a4a7a" strokeWidth="0.5" />
      <text x="73" y="291" fill="#666" fontSize="9" fontFamily="system-ui">Cancha</text>
      <rect x="115" y="282" width="10" height="10" rx="2" fill="#2a1a3a" stroke="#4a2a5a" strokeWidth="0.5" />
      <text x="130" y="291" fill="#666" fontSize="9" fontFamily="system-ui">Alta</text>
      <circle cx="168" cy="287" r="5" fill="none" stroke="#00e5a0" strokeWidth="1.5" />
      <text x="178" y="291" fill="#00e5a0" fontSize="9" fontFamily="system-ui">= Activa</text>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface NewEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewEventModal({ open, onOpenChange }: NewEventModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [confirmed, setConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { toast } = useToast();

  // Try to use the create hook if it exists, otherwise we'll handle manually
  let createEvent: ((data: unknown) => Promise<unknown>) | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const mutation = useCreateEvent?.();
    createEvent = mutation?.mutateAsync ?? null;
  } catch {
    createEvent = null;
  }

  const set = (key: keyof FormData, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }));

  const toggleTag = (tag: string) =>
    set("tags", form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]);

  const toggleDelivery = (m: string) =>
    set("deliveryMethods", form.deliveryMethods.includes(m) ? form.deliveryMethods.filter(d => d !== m) : [...form.deliveryMethods, m]);

  const toggleSection = (id: string) =>
    set("activeSections", form.activeSections.includes(id) ? form.activeSections.filter(s => s !== id) : [...form.activeSections, id]);

  const addTicket = () =>
    set("tickets", [...form.tickets, { id: Date.now(), name: "Nuevo nivel", basePrice: "", resellerPrice: "", available: "", section: "", benefits: "" }]);

  const removeTicket = (id: number) =>
    set("tickets", form.tickets.filter(t => t.id !== id));

  const updateTicket = (id: number, key: keyof TicketType, value: string) =>
    set("tickets", form.tickets.map(t => t.id === id ? { ...t, [key]: value } : t));

  const handleVenueChange = (val: string) => {
    const v = VENUES[val];
    setForm(f => ({ ...f, venue: val, address: v?.address ?? "", totalCapacity: v?.capacity ?? "" }));
  };

  const handleClose = () => {
    setStep(0);
    setForm(DEFAULT_FORM);
    setConfirmed(false);
    setTermsAccepted(false);
    onOpenChange(false);
  };

  const handlePublish = async () => {
    if (!confirmed || !termsAccepted) return;
    try {
      const payload = {
        title: form.title,
        category: form.category,
        city: form.city,
        date: form.date,
        time: form.time,
        artist: form.artist,
        description: form.description,
        venueId: form.venue,
        address: form.address,
        totalCapacity: parseInt(form.totalCapacity) || 0,
        featured: form.featured,
        allowResale: form.allowResale,
        whatsappAlerts: form.whatsappAlerts,
        tags: form.tags,
        tickets: form.tickets,
        activeSections: form.activeSections,
        deliveryMethods: form.deliveryMethods,
        minResalePrice: form.minResalePrice,
        maxResalePrice: form.maxResalePrice,
        platformFee: parseFloat(form.platformFee) || 10,
        status: form.publishStatus,
        scheduledAt: form.scheduledAt || null,
      };

      if (createEvent) {
        await createEvent(payload);
      } else {
        // Fallback: POST directly
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      toast({ title: "✅ Evento publicado", description: `"${form.title}" ya está visible en reventicket.com.mx` });
      handleClose();
    } catch (err) {
      toast({ title: "Error al publicar", description: String(err), variant: "destructive" });
    }
  };

  const minPrice = form.tickets
    .map(t => parseFloat(t.basePrice))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => a - b)[0];

  const formattedDate = form.date
    ? new Date(form.date + "T12:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  // ─── Step panels ────────────────────────────────────────────────────────────

  const StepGeneral = () => (
    <div className="space-y-5">
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Información principal</Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-title">Nombre del evento *</Label>
        <Input id="ev-title" placeholder="Ej. Bad Bunny — World's Hottest Tour" value={form.title} onChange={e => set("title", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoría *</Label>
          <Select value={form.category} onValueChange={v => set("category", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {["Concierto","Festival","Deportes","Teatro","Lucha libre","Stand-up","Electrónica","Otro"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ciudad *</Label>
          <Select value={form.city} onValueChange={v => set("city", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {["Ciudad de México","Guadalajara","Monterrey","Puebla","Cancún","Tijuana","Otra ciudad"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ev-date">Fecha *</Label>
          <Input id="ev-date" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-time">Hora</Label>
          <Input id="ev-time" type="time" value={form.time} onChange={e => set("time", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-artist">Artista / Equipo principal</Label>
        <Input id="ev-artist" placeholder="Ej. Bad Bunny, Chivas vs América..." value={form.artist} onChange={e => set("artist", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ev-desc">Descripción corta</Label>
        <Textarea id="ev-desc" placeholder="Una o dos frases que aparecerán en la tarjeta del evento..." value={form.description} onChange={e => set("description", e.target.value)} className="min-h-[80px]" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Etiquetas</Label>
        <div className="flex flex-wrap gap-2">
          {TAGS.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)}
              className={cn("px-3 py-1 rounded-full border text-xs transition-all",
                form.tags.includes(tag)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              )}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Foto de portada</Label>
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
          <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Arrastra una imagen o <span className="text-primary">haz clic para subir</span></p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG o WEBP · máx 4MB · 1200×630px recomendado</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Configuración</Label>
        <div className="space-y-3 rounded-lg border border-border p-4">
          {[
            { key: "featured" as const, label: "Evento destacado", sub: "Aparece en la sección principal del home" },
            { key: "allowResale" as const, label: "Permitir reventa", sub: "Usuarios pueden listar sus boletos en el marketplace" },
            { key: "whatsappAlerts" as const, label: "Alertas por WhatsApp", sub: "Notificar a usuarios con eventos similares" },
          ].map(({ key, label, sub }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              <Switch checked={form[key] as boolean} onCheckedChange={v => set(key, v)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const StepVenue = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Recinto *</Label>
          <Select value={form.venue} onValueChange={handleVenueChange}>
            <SelectTrigger><SelectValue placeholder="Seleccionar recinto..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(VENUES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Capacidad total</Label>
          <Input type="number" placeholder="65000" value={form.totalCapacity} onChange={e => set("totalCapacity", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Dirección completa</Label>
        <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Viaducto Piedad 9, Granjas México, CDMX" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Mapa interactivo de secciones</Label>
          {form.activeSections.length > 0 && (
            <Badge variant="outline" className="text-xs">{form.activeSections.length} activas</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Haz clic en una sección para activarla y configurar precios</p>
        <VenueMap active={form.activeSections} onToggle={toggleSection} />
      </div>

      {form.activeSections.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Secciones activas</Label>
          <div className="rounded-lg border border-border divide-y divide-border">
            {form.activeSections.map(id => {
              const s = SECTIONS[id];
              if (!s) return null;
              return (
                <div key={id} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                  <span className="text-sm flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.capacity} lugares</span>
                  <span className="text-sm font-medium text-primary">${parseInt(s.price).toLocaleString()}</span>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const StepTickets = () => (
    <div className="space-y-5">
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Tipos de boleto</Label>
        <p className="text-xs text-muted-foreground mt-1">Define los niveles de precio y disponibilidad</p>
      </div>

      <div className="space-y-3">
        {form.tickets.map(ticket => (
          <div key={ticket.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Input
                value={ticket.name}
                onChange={e => updateTicket(ticket.id, "name", e.target.value)}
                className="h-7 text-sm font-medium border-0 p-0 focus-visible:ring-0 w-auto max-w-[200px]"
              />
              <button onClick={() => removeTicket(ticket.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Precio base</Label>
                <Input type="number" placeholder="800" value={ticket.basePrice} onChange={e => updateTicket(ticket.id, "basePrice", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Precio reventa</Label>
                <Input type="number" placeholder="1200" value={ticket.resellerPrice} onChange={e => updateTicket(ticket.id, "resellerPrice", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Disponibles</Label>
                <Input type="number" placeholder="5000" value={ticket.available} onChange={e => updateTicket(ticket.id, "available", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Sección en mapa</Label>
                <Select value={ticket.section} onValueChange={v => updateTicket(ticket.id, "section", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sección..." /></SelectTrigger>
                  <SelectContent>
                    {Object.values(SECTIONS).map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Beneficios</Label>
                <Input placeholder="Acceso, parking..." value={ticket.benefits} onChange={e => updateTicket(ticket.id, "benefits", e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>
        ))}
        <button onClick={addTicket}
          className="w-full border-2 border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" /> Agregar tipo de boleto
        </button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Política de reventa</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Precio mínimo</Label>
            <Input placeholder="= base" value={form.minResalePrice} onChange={e => set("minResalePrice", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Precio máximo</Label>
            <Input placeholder="Sin límite" value={form.maxResalePrice} onChange={e => set("maxResalePrice", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Comisión (%)</Label>
            <Input type="number" placeholder="10" value={form.platformFee} onChange={e => set("platformFee", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Cierre de venta</Label>
          <Input type="date" value={form.saleCloseDate} onChange={e => set("saleCloseDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cierre de reventa</Label>
          <Input type="date" value={form.resaleCloseDate} onChange={e => set("resaleCloseDate", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Entrega de boletos</Label>
        <div className="flex flex-wrap gap-2">
          {DELIVERY.map(m => (
            <button key={m} onClick={() => toggleDelivery(m)}
              className={cn("px-3 py-1.5 rounded-full border text-xs transition-all",
                form.deliveryMethods.includes(m)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground"
              )}>
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const StepPublish = () => (
    <div className="space-y-5">
      <div className="rounded-lg border border-border divide-y divide-border">
        {[
          { k: "Evento",          v: form.title || "—" },
          { k: "Categoría",       v: form.category || "—" },
          { k: "Ciudad",          v: form.city || "—" },
          { k: "Fecha y hora",    v: formattedDate ? `${formattedDate} · ${form.time}` : "—" },
          { k: "Recinto",         v: form.venue ? VENUES[form.venue]?.label : "—" },
          { k: "Secciones",       v: `${form.activeSections.length} sección${form.activeSections.length !== 1 ? "es" : ""}` },
          { k: "Tipos de boleto", v: `${form.tickets.length} nivel${form.tickets.length !== 1 ? "es" : ""}` },
          { k: "Entrega",         v: form.deliveryMethods.join(", ") || "—" },
        ].map(({ k, v }) => (
          <div key={k} className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-medium text-right max-w-[60%]">{v}</span>
          </div>
        ))}
      </div>

      {form.whatsappAlerts && (
        <div className="flex gap-3 items-start rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-600 dark:text-green-400">
          <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Al publicar, el bot de WhatsApp notificará automáticamente a usuarios interesados en este tipo de evento en {form.city || "la ciudad seleccionada"}.</span>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Estado de publicación</Label>
        <div className="flex gap-2">
          {(["published","draft","scheduled"] as const).map(s => (
            <button key={s} onClick={() => set("publishStatus", s)}
              className={cn("px-3 py-1.5 rounded-full border text-xs transition-all",
                form.publishStatus === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-foreground"
              )}>
              {s === "published" ? "🟢 Publicado" : s === "draft" ? "🟡 Borrador" : "⏰ Programar"}
            </button>
          ))}
        </div>
        {form.publishStatus === "scheduled" && (
          <Input type="datetime-local" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} />
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Verificación</Label>
        <div className="rounded-lg border border-border divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm">Confirmo que la información es correcta</span>
            <Switch checked={confirmed} onCheckedChange={setConfirmed} />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm">Acepto los términos para vendedores</span>
            <Switch checked={termsAccepted} onCheckedChange={setTermsAccepted} />
          </div>
        </div>
      </div>
    </div>
  );

  const panels = [<StepGeneral key="g" />, <StepVenue key="v" />, <StepTickets key="t" />, <StepPublish key="p" />];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">Publicar nuevo evento</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{STEPS[step].label}</p>
            </div>
            {/* Preview badge */}
            <div className="hidden sm:flex flex-col items-end gap-1">
              {form.title && <span className="text-xs font-medium truncate max-w-[200px]">{form.title}</span>}
              {minPrice && <span className="text-xs text-primary font-semibold">desde ${minPrice.toLocaleString()}</span>}
              {form.city && <span className="text-xs text-muted-foreground">{form.city}</span>}
            </div>
          </div>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex border-b border-border flex-shrink-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button key={i} onClick={() => setStep(i)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-all",
                  i === step ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold",
                  i < step ? "bg-primary border-primary text-primary-foreground" : i === step ? "border-primary text-primary" : "border-muted-foreground"
                )}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className="hidden sm:block">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-muted flex-shrink-0">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {panels[step]}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3 flex-shrink-0 bg-muted/30">
          <Button variant="outline" onClick={() => step > 0 ? setStep(s => s - 1) : handleClose()}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 0 ? "Cancelar" : "Anterior"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast({ title: "Borrador guardado", description: "Puedes retomarlo en cualquier momento." })}>
              Guardar borrador
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handlePublish} disabled={!confirmed || !termsAccepted} className="gap-2">
                <Zap className="h-4 w-4" /> Publicar evento
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
