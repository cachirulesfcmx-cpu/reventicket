import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { SimpleMapViewer } from "@/components/simple-map-viewer";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEvent, useVenue, useZones, useTickets, type Ticket } from "@/lib/api";

export default function EventDetails() {
  const { id } = useParams();
  const [_, setLocation] = useLocation();
  
  const { data: event, isLoading: eventLoading } = useEvent(id || "");
  const { data: venue } = useVenue(event?.venueId || "");
  const { data: zones } = useZones(id || "");
  const { data: tickets } = useTickets(id || "", true);
  
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const filteredTickets = selectedZone 
    ? tickets?.filter(t => t.zoneId === selectedZone) || []
    : tickets || [];

  const venueNameLower = (venue?.name || "").toLowerCase();
  const categoryLower = (event?.category || "").toLowerCase();
  const isAutodromo = (venueNameLower.includes("autódromo") || venueNameLower.includes("autodromo")) && 
                      (categoryLower.includes("f1") || categoryLower.includes("formula"));
  const isEstadio = venueNameLower.includes("azteca") || venueNameLower.includes("banorte") || 
                    categoryLower.includes("fútbol") || categoryLower.includes("futbol");
  const svgUrl = isAutodromo ? "/maps/f1-map.svg" : isEstadio ? "/maps/estadio-azteca.svg" : "/maps/arena-map.svg";

  const handleZoneSelect = (zoneId: string | null) => {
    setSelectedZone(zoneId);
  };

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsCheckoutOpen(true);
  };

  const proceedToCheckout = () => {
    if (selectedTicket && quantity === 1) {
      setLocation(`/checkout?ticketId=${selectedTicket.id}&eventId=${event?.id}`);
    } else if (selectedTicket && quantity > 1) {
      // Multi-ticket: usa zoneId para que el backend asigne boletos disponibles
      setLocation(`/checkout?zoneId=${selectedTicket.zoneId}&eventId=${event?.id}&quantity=${quantity}`);
    }
  };

  if (eventLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 p-4">
        <h2 className="text-xl font-bold mb-4">Evento no encontrado</h2>
        <Button onClick={() => setLocation("/")}>Volver al inicio</Button>
      </div>
    );
  }

  const selectedZoneName = zones?.find(z => z.id === selectedZone)?.name;

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-50 overflow-hidden">
      <div className="shrink-0 border-b bg-background">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0 h-8 w-8"
            onClick={() => setLocation("/")}
            data-testid="back-btn"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm sm:text-base truncate" data-testid="event-title">
              Boletos {event.title}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {format(new Date(event.date), "EEE, dd 'de' MMM 'de' yyyy • HH:mm", { locale: es })} at{" "}
              <span className="text-primary">{venue?.name}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900 relative">
        <SimpleMapViewer 
          svgUrl={svgUrl}
          zones={zones}
          tickets={tickets}
          selectedZone={selectedZone}
          onZoneSelect={handleZoneSelect}
        />
      </div>

      <div className="shrink-0 border-t bg-background flex flex-col" style={{ maxHeight: "40vh" }}>
        <div className="px-4 py-2 border-b bg-muted/30 flex justify-between items-center">
          <p className="text-sm font-medium">
            {selectedZone ? (
              <span style={{ color: zones?.find(z => z.id === selectedZone)?.color || undefined }}>
                {selectedZoneName}
              </span>
            ) : (
              "Todas las zonas"
            )} - {filteredTickets.length} boletos
          </p>
          {selectedZone && (
            <button 
              className="text-xs text-primary underline"
              onClick={() => setSelectedZone(null)}
            >
              Ver todas
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <p className="text-sm">No hay boletos disponibles{selectedZone ? " en esta zona" : ""}.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTickets.map((ticket) => {
                const zone = zones?.find(z => z.id === ticket.zoneId);
                return (
                  <button 
                    key={ticket.id} 
                    className="w-full p-4 text-left hover:bg-muted/50 active:bg-muted transition-colors flex justify-between items-center gap-4"
                    onClick={() => handleTicketSelect(ticket)}
                    data-testid={`ticket-${ticket.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base truncate" style={{ color: zone?.color || undefined }}>
                        {zone?.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Fila {ticket.row} | Asiento {ticket.seat}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-green-600">
                        ${parseFloat(ticket.price).toLocaleString("es-MX")}
                      </div>
                      <div className="text-xs text-muted-foreground">cada uno</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar compra</DialogTitle>
            <DialogDescription>
              Estás a punto de comprar este boleto
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (() => {
            const zone = zones?.find(z => z.id === selectedTicket.zoneId);
            const unitPrice = parseFloat(selectedTicket.price);
            const availableInZone = tickets?.filter(t => t.zoneId === selectedTicket.zoneId && t.status === "available").length || 1;
            const maxQty = Math.min(4, availableInZone);
            const subtotal = unitPrice * quantity;
            return (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-bold text-lg" style={{ color: zone?.color || undefined }}>
                    {zone?.name}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Fila {selectedTicket.row} | Asiento {selectedTicket.seat}
                  </div>
                  <div className="text-2xl font-bold text-green-600 mt-2">
                    ${unitPrice.toLocaleString("es-MX")} MXN <span className="text-sm font-normal text-muted-foreground">/ boleto</span>
                  </div>
                </div>

                {/* Selector de cantidad */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium text-sm">Cantidad de boletos</span>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-bold w-4 text-center">{quantity}</span>
                    <Button
                      variant="outline" size="icon" className="h-8 w-8"
                      onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                      disabled={quantity >= maxQty}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {quantity > 1 && (
                  <div className="flex justify-between text-sm font-semibold px-1">
                    <span>Subtotal ({quantity} boletos)</span>
                    <span className="text-green-600">${subtotal.toLocaleString("es-MX")} MXN</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { setIsCheckoutOpen(false); setQuantity(1); }}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={proceedToCheckout}>
                    Ir a pagar →
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
