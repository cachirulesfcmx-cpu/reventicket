// client/src/components/admin-discounts-tab.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, Percent, Tag, ToggleLeft, Zap } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DiscountCode {
  id: string;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

const PRESET_CODES = [
  { code: "REVEN10",   type: "percent" as const, value: 10,  description: "10% de descuento general",       usedCount: 42,  maxUses: 200, isActive: true  },
  { code: "VIP2026",   type: "percent" as const, value: 15,  description: "Descuento clientes VIP",         usedCount: 8,   maxUses: 50,  isActive: true  },
  { code: "PROMO500",  type: "fixed"   as const, value: 500, description: "$500 MXN en compras mayores a $2,000", usedCount: 3, maxUses: 100, isActive: false },
];

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function AdminDiscountsTab() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<DiscountCode[]>(
    PRESET_CODES.map((c, i) => ({ ...c, id: String(i + 1), minOrderAmount: undefined, expiresAt: undefined, createdAt: new Date().toISOString() }))
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: generateCode(),
    description: "",
    type: "percent" as "percent" | "fixed",
    value: "",
    minOrderAmount: "",
    maxUses: "",
    expiresAt: "",
    isActive: true,
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.code || !form.value) {
      toast({ title: "Completa los campos requeridos", variant: "destructive" });
      return;
    }
    const newCode: DiscountCode = {
      id: Date.now().toString(),
      code: form.code.toUpperCase(),
      description: form.description,
      type: form.type,
      value: parseFloat(form.value),
      minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      usedCount: 0,
      isActive: form.isActive,
      expiresAt: form.expiresAt || undefined,
      createdAt: new Date().toISOString(),
    };
    setCodes(prev => [newCode, ...prev]);
    toast({ title: "✅ Cupón creado", description: `Código "${newCode.code}" listo para usar.` });
    setOpen(false);
    setForm({ code: generateCode(), description: "", type: "percent", value: "", minOrderAmount: "", maxUses: "", expiresAt: "", isActive: true });
  };

  const toggleActive = (id: string) =>
    setCodes(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));

  const deleteCode = (id: string) =>
    setCodes(prev => prev.filter(c => c.id !== id));

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copiado", description: `"${code}" copiado al portapapeles.` });
  };

  const totalSaved = codes.filter(c => c.isActive).length;
  const totalUsed  = codes.reduce((s, c) => s + c.usedCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Códigos de Descuento</h2>
          <p className="text-sm text-muted-foreground mt-1">Crea y gestiona cupones de descuento para tus compradores.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo cupón
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Cupones activos", value: totalSaved, color: "#22c55e", icon: Tag },
          { label: "Total de usos",   value: totalUsed,  color: "#a855f7", icon: Zap },
          { label: "Total creados",   value: codes.length, color: "#60a5fa", icon: Percent },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map(code => {
                const usePct = code.maxUses ? Math.round((code.usedCount / code.maxUses) * 100) : null;
                return (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">
                          {code.code}
                        </code>
                        <button onClick={() => copyCode(code.code)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {code.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold">
                        {code.type === "percent" ? `${code.value}%` : `$${code.value.toLocaleString()} MXN`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span className="text-sm">{code.usedCount}{code.maxUses ? ` / ${code.maxUses}` : ""}</span>
                        {usePct !== null && (
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(usePct, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {code.expiresAt ? format(new Date(code.expiresAt), "dd MMM yyyy", { locale: es }) : "Sin vencer"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={code.isActive} onCheckedChange={() => toggleActive(code.id)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8"
                        onClick={() => deleteCode(code.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo código de descuento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Código *</Label>
                <div className="flex gap-2">
                  <Input value={form.code} onChange={e => set("code", e.target.value.toUpperCase())}
                    className="font-mono font-bold tracking-widest" maxLength={16} />
                  <Button variant="outline" size="icon" onClick={() => set("code", generateCode())} title="Generar aleatorio">
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentaje (%)</SelectItem>
                    <SelectItem value="fixed">Monto fijo (MXN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{form.type === "percent" ? "Descuento (%)" : "Monto (MXN)"} *</Label>
                <Input type="number" placeholder={form.type === "percent" ? "10" : "500"} value={form.value}
                  onChange={e => set("value", e.target.value)} min="0" max={form.type === "percent" ? "100" : undefined} />
              </div>
              <div className="space-y-1.5">
                <Label>Compra mínima (MXN)</Label>
                <Input type="number" placeholder="Sin mínimo" value={form.minOrderAmount}
                  onChange={e => set("minOrderAmount", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input placeholder="Ej. Descuento para clientes VIP" value={form.description}
                onChange={e => set("description", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Usos máximos</Label>
                <Input type="number" placeholder="Ilimitado" value={form.maxUses}
                  onChange={e => set("maxUses", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de expiración</Label>
                <Input type="date" value={form.expiresAt} onChange={e => set("expiresAt", e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Activar inmediatamente</p>
                <p className="text-xs text-muted-foreground">El cupón podrá usarse desde ahora</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={v => set("isActive", v)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Crear cupón</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
