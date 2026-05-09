import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, MapPin, Calendar, QrCode, RefreshCw, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { SkeletonShimmer } from "@/components/skeleton-shimmer";

interface TicketPassWithDetails {
  pass: {
    id: string;
    status: string;
    issuedAt: string;
    usedAt: string | null;
  };
  ticket: {
    id: string;
    row: string;
    seat: string;
    price: string;
  };
  event: {
    id: string;
    title: string;
    date: string;
    image: string | null;
  };
  zone: {
    id: string;
    name: string;
    color: string | null;
  };
  venue: {
    id: string;
    name: string;
    city: string;
  };
}

interface QRPayload {
  passId: string;
  ts: number;
  nonce: string;
  sig: string;
}

export default function Wallet() {
  const { data: passes, isLoading, error } = useQuery<TicketPassWithDetails[]>({
    queryKey: ['wallet-passes'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/enterprise/wallet/passes');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="px-4 py-6 space-y-4">
          <h1 className="text-2xl font-heading font-bold">Mis Boletos</h1>
          <SkeletonShimmer className="h-48 rounded-xl" />
          <SkeletonShimmer className="h-48 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="px-4 py-6">
          <h1 className="text-2xl font-heading font-bold mb-4">Mis Boletos</h1>
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-destructive">No se pudieron cargar los boletos</p>
              <p className="text-sm text-muted-foreground mt-2">
                Verifica que hayas iniciado sesión
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-heading font-bold mb-6" data-testid="wallet-title">Mis Boletos</h1>
        
        {(!passes || passes.length === 0) ? (
          <Card className="bg-muted/20">
            <CardContent className="p-8 text-center">
              <Ticket className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Sin boletos</h2>
              <p className="text-muted-foreground">
                Cuando compres boletos, aparecerán aquí con su código QR
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {passes.map((item, index) => (
              <TicketPassCard key={item.pass.id} data={item} index={index} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function TicketPassCard({ data, index }: { data: TicketPassWithDetails; index: number }) {
  const [showQR, setShowQR] = useState(false);
  const [qrPayload, setQrPayload] = useState<QRPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQR = async () => {
    try {
      setRefreshing(true);
      const res = await apiRequest('GET', `/api/enterprise/wallet/pass/${data.pass.id}/qr`);
      const payload = await res.json();
      setQrPayload(payload);
    } catch (error) {
      console.error('Error fetching QR:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (showQR && data.pass.status === 'active') {
      fetchQR();
      const interval = setInterval(fetchQR, 25000);
      return () => clearInterval(interval);
    }
  }, [showQR, data.pass.id, data.pass.status]);

  const statusColors = {
    active: 'bg-primary text-primary-foreground',
    used: 'bg-muted text-muted-foreground',
    revoked: 'bg-destructive text-destructive-foreground',
    expired: 'bg-muted text-muted-foreground',
  };

  const statusLabels = {
    active: 'Válido',
    used: 'Usado',
    revoked: 'Revocado',
    expired: 'Expirado',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="overflow-hidden">
        <div className="relative h-32 bg-gradient-to-r from-primary/20 to-primary/5">
          {data.event.image && (
            <img 
              src={data.event.image} 
              alt={data.event.title}
              className="w-full h-full object-cover opacity-50"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="font-bold text-lg line-clamp-1">{data.event.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {format(new Date(data.event.date), "d MMM yyyy - HH:mm", { locale: es })}
            </div>
          </div>
          <div className={`absolute top-3 right-3 px-2 py-1 rounded text-xs font-bold ${statusColors[data.pass.status as keyof typeof statusColors] || statusColors.active}`}>
            {statusLabels[data.pass.status as keyof typeof statusLabels] || data.pass.status}
          </div>
        </div>

        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Zona</p>
              <p className="font-medium">{data.zone.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Asiento</p>
              <p className="font-medium">Fila {data.ticket.row}, Asiento {data.ticket.seat}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Venue
              </p>
              <p className="font-medium">{data.venue.name}, {data.venue.city}</p>
            </div>
          </div>

          {data.pass.status === 'active' && (
            <Button 
              onClick={() => setShowQR(!showQR)} 
              className="w-full"
              variant={showQR ? "secondary" : "default"}
              data-testid={`button-toggle-qr-${data.pass.id}`}
            >
              <QrCode className="h-4 w-4 mr-2" />
              {showQR ? 'Ocultar QR' : 'Mostrar QR'}
            </Button>
          )}

          <AnimatePresence>
            {showQR && data.pass.status === 'active' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 bg-white rounded-xl flex flex-col items-center">
                  {qrPayload ? (
                    <>
                      <div className="w-48 h-48 bg-black/5 rounded-lg flex items-center justify-center mb-2 relative">
                        <QRCodeDisplay payload={qrPayload} />
                        {refreshing && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Se actualiza cada 30 segundos
                      </p>
                    </>
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center">
                      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QRCodeDisplay({ payload }: { payload: QRPayload }) {
  const qrData = JSON.stringify(payload);
  const encoded = encodeURIComponent(qrData);
  
  return (
    <img 
      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}`}
      alt="QR Code"
      className="w-44 h-44"
    />
  );
}
