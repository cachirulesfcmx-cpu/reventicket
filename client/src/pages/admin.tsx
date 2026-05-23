import { AdminMapsTab } from "@/components/admin-maps-tab";
import { AdminDiscountsTab } from "@/components/admin-discounts-tab";
import { AdminPushCard } from "@/components/admin-push-card";
import { NewEventModal } from "@/components/new-event-modal";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useEvents, useVenues, useOrders, useDeleteEvent, useWhatsAppStatus } from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  BarChart, Users, Ticket, DollarSign, Settings, TrendingUp,
  Map as MapIcon, Percent, CreditCard, Eye, Save, Trash2, Edit, Plus, Loader2, MessageCircle, CheckCircle2, XCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Admin() {
  const { toast } = useToast();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: venues = [] } = useVenues();
  const { data: orders = [] } = useOrders();
  const deleteEventMutation = useDeleteEvent();
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const handleSaveConfig = () => {
    toast({
      title: "Configuración guardada",
      description: "Los cambios han sido aplicados correctamente.",
    });
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    try {
      await deleteEventMutation.mutateAsync(eventId);
      toast({
        title: "Evento eliminado",
        description: `"${eventTitle}" ha sido eliminado correctamente.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el evento.",
        variant: "destructive",
      });
    }
  };

  // Calculate KPIs from real data
  const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount || "0"), 0);
  const totalFees = orders.reduce((sum, order) => sum + parseFloat(order.fees || "0"), 0);
  const completedOrders = orders.filter(o => o.status === "completed");

  // Get venue name by ID
  const getVenueName = (venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    return venue?.name || "Recinto";
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Admin Sidebar */}
        <aside className="w-64 border-r bg-muted/10 hidden md:block overflow-y-auto">
          <div className="p-6">
            <h2 className="font-heading font-bold text-xl text-primary mb-6">Admin Panel</h2>
            <nav className="space-y-2">
              <Button variant="secondary" className="w-full justify-start gap-2" data-testid="nav-dashboard" onClick={() => setActiveTab("dashboard")}>
                <BarChart className="h-4 w-4" />
                Dashboard
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2" data-testid="nav-events" onClick={() => setActiveTab("events")}>
                <Ticket className="h-4 w-4" />
                Eventos
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2" data-testid="nav-users" onClick={() => setActiveTab("users")}>
                <Users className="h-4 w-4" />
                Usuarios
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2" data-testid="nav-sales" onClick={() => setActiveTab("sales")}>
                <DollarSign className="h-4 w-4" />
                Ventas
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2" data-testid="nav-maps" onClick={() => setActiveTab("maps")}>
                <MapIcon className="h-4 w-4" />
                Mapas de Recintos
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2" data-testid="nav-discounts" onClick={() => setActiveTab("discounts")}>
                <Percent className="h-4 w-4" />
                Descuentos
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2" data-testid="nav-config" onClick={() => setActiveTab("config")}>
                <Settings className="h-4 w-4" />
                Configuración
              </Button>
              <div className="border-t border-border pt-2 mt-2">
                <Link href="/portal-admin/analytics">
                  <Button variant="ghost" className="w-full justify-start gap-2 text-primary" data-testid="nav-analytics">
                    <TrendingUp className="h-4 w-4" />
                    Analytics
                  </Button>
                </Link>
                <Link href="/portal-admin/scanner">
                  <Button variant="ghost" className="w-full justify-start gap-2" data-testid="nav-scanner">
                    <Eye className="h-4 w-4" />
                    Scanner QR
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-8 bg-muted/5">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-heading font-bold">Panel de Administración</h1>
              <TabsList>
                <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="events" data-testid="tab-events">Eventos</TabsTrigger>
                <TabsTrigger value="sales" data-testid="tab-sales">Ventas</TabsTrigger>
                <TabsTrigger value="users" data-testid="tab-users">Usuarios</TabsTrigger>
                <TabsTrigger value="whatsapp" data-testid="tab-whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="config" data-testid="tab-config">Configuración</TabsTrigger>
                <TabsTrigger value="maps" className="hidden" data-testid="tab-maps">Mapas</TabsTrigger>
                <TabsTrigger value="discounts" className="hidden" data-testid="tab-discounts">Descuentos</TabsTrigger>
              </TabsList>
            </div>

            {/* DASHBOARD TAB */}
            <TabsContent value="dashboard" className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KpiCard 
                  title="Ventas Totales" 
                  value={`$${totalSales.toLocaleString()}`} 
                  sub={`${orders.length} órdenes`} 
                  icon={DollarSign} 
                />
                <KpiCard 
                  title="Boletos Vendidos" 
                  value={completedOrders.length.toString()} 
                  sub="Completados" 
                  icon={Ticket} 
                />
                <KpiCard 
                  title="Eventos Activos" 
                  value={events.length.toString()} 
                  sub="En la plataforma" 
                  icon={BarChart} 
                />
                <KpiCard 
                  title="Comisiones" 
                  value={`$${totalFees.toLocaleString()}`} 
                  sub="Ingresos por fees" 
                  icon={Percent} 
                />
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Órdenes Recientes</CardTitle>
                    <CardDescription>Últimas transacciones en la plataforma</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {orders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No hay órdenes registradas
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.slice(0, 5).map((order) => (
                            <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                              <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
                              <TableCell>
                                <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                                  {order.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold">${parseFloat(order.totalAmount || "0").toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Eventos Destacados</CardTitle>
                    <CardDescription>Eventos en la plataforma</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {eventsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {events.slice(0, 5).map((e, i) => (
                          <div key={e.id} className="flex items-center justify-between" data-testid={`featured-event-${e.id}`}>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-muted-foreground text-sm">#{i + 1}</span>
                              <span className="font-medium truncate max-w-[200px]">{e.title}</span>
                            </div>
                            <Badge variant="outline">{e.category}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* EVENTS TAB */}
            <TabsContent value="events" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Gestión de Eventos</h2>
                <Button data-testid="btn-new-event" onClick={() => setNewEventOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Evento
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  {eventsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : events.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      No hay eventos registrados
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Evento</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Recinto</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Precio Min</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.map((event) => (
                          <TableRow key={event.id} data-testid={`event-row-${event.id}`}>
                            <TableCell className="font-medium max-w-[200px] truncate">{event.title}</TableCell>
                            <TableCell>{format(new Date(event.date), "dd MMM yyyy", { locale: es })}</TableCell>
                            <TableCell>{getVenueName(event.venueId)}</TableCell>
                            <TableCell><Badge variant="outline">{event.category}</Badge></TableCell>
                            <TableCell>${event.minPrice ? parseFloat(event.minPrice).toLocaleString() : "N/A"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" data-testid={`btn-edit-${event.id}`}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" data-testid={`btn-delete-${event.id}`}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará permanentemente el evento "{event.title}" y todos sus boletos asociados.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteEvent(event.id, event.title)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SALES TAB */}
            <TabsContent value="sales" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
               <h2 className="text-xl font-bold">Reporte de Ventas</h2>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card>
                   <CardHeader className="pb-2">
                     <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales (Neto)</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="text-2xl font-bold">${totalSales.toLocaleString()}</div>
                   </CardContent>
                 </Card>
                 <Card>
                   <CardHeader className="pb-2">
                     <CardTitle className="text-sm font-medium text-muted-foreground">Comisiones (Fees)</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="text-2xl font-bold text-green-600">${totalFees.toLocaleString()}</div>
                   </CardContent>
                 </Card>
                 <Card>
                   <CardHeader className="pb-2">
                     <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="text-2xl font-bold">
                       ${orders.length > 0 ? Math.round(totalSales / orders.length).toLocaleString() : "0"}
                     </div>
                   </CardContent>
                 </Card>
               </div>
               
               <Card>
                 <CardHeader>
                   <CardTitle>Historial de Transacciones</CardTitle>
                 </CardHeader>
                 <CardContent>
                   {orders.length === 0 ? (
                     <div className="text-center py-8 text-muted-foreground">
                       No hay transacciones registradas
                     </div>
                   ) : (
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead>ID Orden</TableHead>
                           <TableHead>Fecha</TableHead>
                           <TableHead>Método de Pago</TableHead>
                           <TableHead>Estado</TableHead>
                           <TableHead className="text-right">Total</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {orders.map((order) => (
                           <TableRow key={order.id} data-testid={`sales-row-${order.id}`}>
                             <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
                             <TableCell>{format(new Date(order.createdAt), "dd MMM yyyy HH:mm", { locale: es })}</TableCell>
                             <TableCell className="capitalize">{order.paymentMethod || "N/A"}</TableCell>
                             <TableCell>
                               <Badge 
                                 variant={order.status === "completed" ? "default" : order.status === "pending" ? "secondary" : "destructive"}
                               >
                                 {order.status}
                               </Badge>
                             </TableCell>
                             <TableCell className="text-right font-bold">${parseFloat(order.totalAmount || "0").toLocaleString()}</TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   )}
                 </CardContent>
               </Card>
            </TabsContent>

            {/* USERS TAB */}
            <TabsContent value="users" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold">Usuarios Registrados</h2>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>La gestión de usuarios estará disponible próximamente.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* WHATSAPP TAB */}
            <WhatsAppTab />

            {/* CONFIG TAB */}
            <TabsContent value="config" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold">Configuración del Sistema</h2>
              
              <div className="grid md:grid-cols-2 gap-8">
                {/* Payment Methods */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Métodos de Pago
                    </CardTitle>
                    <CardDescription>Activa o desactiva pasarelas de pago y configura sus credenciales</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Clip Config */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Tarjeta de Crédito (Clip)</Label>
                        <div className="text-xs text-muted-foreground">Procesamiento vía API Clip</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" data-testid="btn-config-clip">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Configuración Clip</DialogTitle>
                              <DialogDescription>Ingresa las llaves de producción de tu cuenta Clip.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>API Key (Public)</Label>
                                <Input placeholder="pk_prod_..." data-testid="input-clip-api-key" />
                              </div>
                              <div className="space-y-2">
                                <Label>Secret Key</Label>
                                <Input type="password" placeholder="sk_prod_..." data-testid="input-clip-secret" />
                              </div>
                              <div className="space-y-2">
                                <Label>Webhook URL</Label>
                                <Input value="https://reventicket.com/api/webhooks/clip" readOnly className="bg-muted" />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleSaveConfig} data-testid="btn-save-clip">Guardar</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Switch defaultChecked data-testid="switch-clip" />
                      </div>
                    </div>

                    {/* OXXO Config */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>OXXO Pay</Label>
                        <div className="text-xs text-muted-foreground">Pagos en efectivo en tiendas</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" data-testid="btn-config-oxxo">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Configuración OXXO Pay</DialogTitle>
                              <DialogDescription>Datos para generar las referencias de pago.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Nombre del Beneficiario</Label>
                                <Input placeholder="RevenTicket S.A. de C.V." data-testid="input-oxxo-beneficiary" />
                              </div>
                              <div className="space-y-2">
                                <Label>Número de Cuenta / Referencia Base</Label>
                                <Input placeholder="0000-0000-0000" data-testid="input-oxxo-account" />
                              </div>
                              <div className="space-y-2">
                                <Label>Días de vigencia</Label>
                                <Input type="number" defaultValue="2" data-testid="input-oxxo-days" />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleSaveConfig} data-testid="btn-save-oxxo">Guardar</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Switch defaultChecked data-testid="switch-oxxo" />
                      </div>
                    </div>

                    {/* SPEI Config */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Transferencia SPEI</Label>
                        <div className="text-xs text-muted-foreground">Clabe interbancaria única</div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" data-testid="btn-config-spei">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Configuración SPEI</DialogTitle>
                              <DialogDescription>Datos de la cuenta receptora.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Banco</Label>
                                <Input placeholder="BBVA / Santander / STP" data-testid="input-spei-bank" />
                              </div>
                              <div className="space-y-2">
                                <Label>CLABE Interbancaria</Label>
                                <Input placeholder="012 180 0000000000 0" data-testid="input-spei-clabe" />
                              </div>
                              <div className="space-y-2">
                                <Label>Titular de la cuenta</Label>
                                <Input placeholder="RevenTicket S.A. de C.V." data-testid="input-spei-titular" />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleSaveConfig} data-testid="btn-save-spei">Guardar</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Switch data-testid="switch-spei" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Fees & Discounts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="h-5 w-5" />
                      Comisiones y Descuentos
                    </CardTitle>
                    <CardDescription>Configura los cargos por servicio</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Fee Comprador (%)</Label>
                      <div className="flex gap-2">
                        <Input type="number" defaultValue="15" className="w-24" data-testid="input-buyer-fee" />
                        <span className="flex items-center text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-md text-sm text-muted-foreground">
                       Solo el administrador puede vender boletos actualmente.
                    </div>
                    <Button className="w-full mt-4" onClick={handleSaveConfig} data-testid="btn-save-fees">
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </Button>
                  </CardContent>
                </Card>
                
                {/* Mapas de Recintos */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapIcon className="h-5 w-5" />
                      Mapas de Recintos
                    </CardTitle>
                    <CardDescription>Gestiona los SVGs y zonas de los estadios</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {venues.map((venue) => (
                        <div key={venue.id} className="border rounded-lg p-4" data-testid={`venue-card-${venue.id}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{venue.name}</h4>
                            <Badge variant="outline">{venue.city}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Capacidad: {venue.capacity?.toLocaleString() || "N/A"}
                          </p>
                          <Button variant="outline" size="sm" className="w-full" data-testid={`btn-edit-venue-${venue.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar Mapa
                          </Button>
                        </div>
                      ))}
                      {venues.length === 0 && (
                        <div className="md:col-span-2 border border-dashed p-8 rounded-lg text-center">
                          <p className="text-muted-foreground mb-4">No hay recintos registrados.</p>
                          <Button variant="outline" data-testid="btn-add-venue">
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar Recinto
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            <TabsContent value="maps" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <AdminMapsTab />
            </TabsContent>

            <TabsContent value="discounts" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <AdminDiscountsTab />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <NewEventModal open={newEventOpen} onOpenChange={setNewEventOpen} />
    </Layout>
  );
}

function KpiCard({ title, value, sub, icon: Icon }: { title: string; value: string; sub: string; icon: any }) {
  return (
    <Card data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}

function WhatsAppTab() {
  const { data: status, isLoading } = useWhatsAppStatus();

  return (
    <TabsContent value="whatsapp" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-xl font-bold">Notificaciones</h2>

      {/* Push Notifications */}
      <AdminPushCard />

      <h3 className="text-lg font-semibold mt-2">Bot de WhatsApp</h3>

      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Estado de Conexión
            </CardTitle>
            <CardDescription>Conecta tu cuenta de WhatsApp para enviar notificaciones automáticas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verificando estado...</span>
              </div>
            ) : status?.connected ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-bold text-green-700">WhatsApp Conectado</p>
                  <p className="text-sm text-green-600">El bot está listo para enviar mensajes</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <XCircle className="h-8 w-8 text-yellow-600" />
                  <div>
                    <p className="font-bold text-yellow-700">WhatsApp Desconectado</p>
                    <p className="text-sm text-yellow-600">Escanea el código QR para conectar</p>
                  </div>
                </div>
                
                {status?.qrCode && (
                  <div className="mt-4 p-4 bg-white border rounded-lg">
                    <p className="text-sm font-medium mb-3 text-center">Escanea este código QR con WhatsApp:</p>
                    <div className="flex justify-center">
                      <QRCodeSVG 
                        value={status.qrCode}
                        size={200}
                        level="M"
                        data-testid="whatsapp-qr"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo
                    </p>
                  </div>
                )}
                
                {!status?.qrCode && (
                  <p className="text-sm text-muted-foreground">
                    Espera unos segundos para que se genere el código QR...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notificaciones Automáticas</CardTitle>
            <CardDescription>El bot enviará estos mensajes automáticamente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-sm">Verificación OTP</p>
                <p className="text-xs text-muted-foreground">Código de 6 dígitos antes de pagar</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-sm">Confirmación de Pedido</p>
                <p className="text-xs text-muted-foreground">Detalles del evento y boletos</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-sm">Pago Confirmado</p>
                <p className="text-xs text-muted-foreground">Cuando la pasarela confirma el pago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-sm">Instrucciones de Pago</p>
                <p className="text-xs text-muted-foreground">Para pagos OXXO o Transferencia</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-sm">Recordatorios de Pago</p>
                <p className="text-xs text-muted-foreground">A las 1, 6 y 12 horas de crear el pedido</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-medium text-sm">Carrito Abandonado</p>
                <p className="text-xs text-muted-foreground">Recordatorio 30 minutos después</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
