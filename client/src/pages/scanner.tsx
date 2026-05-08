import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CheckCircle2, XCircle, AlertCircle, Ticket, MapPin, Calendar, Scan, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useVibrate } from "@/hooks/use-vibrate";

interface ScanResult {
  valid: boolean;
  result: string;
  details?: {
    event: { title: string; date: string };
    venue: { name: string; city: string };
    zone: { name: string };
    ticket: { row: string; seat: string };
  };
}

export default function Scanner() {
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { vibrateSuccess, vibrateError, vibrateTap } = useVibrate();

  const handleScan = async (qrData: string) => {
    setScanning(true);
    setResult(null);
    setError(null);
    vibrateTap();

    try {
      const payload = JSON.parse(qrData);
      const res = await apiRequest('POST', '/api/enterprise/wallet/validate', {
        ...payload,
        markUsed: true,
        scanLocation: 'Admin Scanner',
      });
      
      const data = await res.json();
      setResult(data);
      
      if (data.valid) {
        vibrateSuccess();
      } else {
        vibrateError();
      }
    } catch (err: any) {
      setError(err.message || 'Error al validar');
      vibrateError();
    } finally {
      setScanning(false);
    }
  };

  const handleManualScan = () => {
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      setError('No se pudo acceder a la cámara');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const resultConfig = {
    valid: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'VÁLIDO' },
    already_used: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'YA USADO' },
    invalid: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'INVÁLIDO' },
    expired: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'EXPIRADO' },
    revoked: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'REVOCADO' },
    not_found: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'NO ENCONTRADO' },
  };

  return (
    <Layout>
      <div className="px-4 py-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2" data-testid="scanner-title">
          <Scan className="h-7 w-7" />
          Scanner de Boletos
        </h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Escanear con cámara</CardTitle>
          </CardHeader>
          <CardContent>
            {cameraActive ? (
              <div className="space-y-4">
                <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-primary/50 rounded-lg pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary rounded-lg" />
                  </div>
                </div>
                <Button onClick={stopCamera} variant="secondary" className="w-full">
                  Detener cámara
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Nota: Para escanear QR en tiempo real, usa la entrada manual abajo
                </p>
              </div>
            ) : (
              <Button onClick={startCamera} className="w-full" size="lg" data-testid="button-start-camera">
                <Camera className="h-5 w-5 mr-2" />
                Activar cámara
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Entrada manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder='Pegar datos del QR (JSON)'
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="font-mono text-sm"
              data-testid="input-qr-data"
            />
            <Button 
              onClick={handleManualScan} 
              className="w-full"
              disabled={!manualInput.trim() || scanning}
              data-testid="button-validate-ticket"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                'Validar boleto'
              )}
            </Button>
          </CardContent>
        </Card>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="p-4 text-center">
                  <XCircle className="h-12 w-12 mx-auto text-destructive mb-2" />
                  <p className="font-semibold text-destructive">Error</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className={`border-2 ${result.valid ? 'border-green-500' : 'border-red-500'}`}>
                <CardContent className="p-6">
                  {(() => {
                    const config = resultConfig[result.result as keyof typeof resultConfig] || resultConfig.invalid;
                    const Icon = config.icon;
                    return (
                      <div className={`text-center p-4 rounded-xl ${config.bg} mb-4`}>
                        <Icon className={`h-16 w-16 mx-auto ${config.color} mb-2`} />
                        <p className={`text-2xl font-bold ${config.color}`}>{config.label}</p>
                      </div>
                    );
                  })()}

                  {result.details && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Ticket className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-semibold">{result.details.event.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {result.details.zone.name} - Fila {result.details.ticket.row}, Asiento {result.details.ticket.seat}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(result.details.event.date), "d 'de' MMMM yyyy - HH:mm", { locale: es })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">
                          {result.details.venue.name}, {result.details.venue.city}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
