import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { CreditCard, Banknote, Store, ShieldCheck, Clock, Check, Phone, Loader2, Shield, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useEvent, useVenue, useTicket, apiRequest } from "@/lib/api";

export default function Checkout() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "spei" | "oxxo">("card");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [includeCancellationInsurance, setIncludeCancellationInsurance] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const ticketId = urlParams.get("ticketId") || "";
  const eventId = urlParams.get("eventId") || "";
  
  const { data: event } = useEvent(eventId);
  const { data: venue } = useVenue(event?.venueId || "");
  const { data: ticket } = useTicket(ticketId);
  
  const zoneName = ticket?.section || "General";
  const ticketPrice = ticket ? parseFloat(ticket.price) : 0;
  const fees = ticketPrice * 0.15;
  const insuranceCost = includeCancellationInsurance ? ticketPrice * 0.18 : 0;
  const total = ticketPrice + fees + insuranceCost;

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (ticketId && eventId && phone) {
      apiRequest("POST", "/api/cart", {
        sessionId,
        ticketId,
        eventId,
        phone: phone.length >= 10 ? phone : undefined
      }).catch(() => {});
    }
  }, [ticketId, eventId, phone]);

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.slice(0, 10);
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      toast({ title: "Error", description: "Ingresa un número de 10 dígitos", variant: "destructive" });
      return;
    }

    setSendingOtp(true);
    try {
      const response = await apiRequest("POST", "/api/otp/send", { phone: `52${phone}` });
      if (response.success) {
        setOtpSent(true);
        toast({ title: "Código enviado", description: "Revisa tu WhatsApp para ver el código" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo enviar el código", variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast({ title: "Error", description: "Ingresa el código de 6 dígitos", variant: "destructive" });
      return;
    }

    setVerifyingOtp(true);
    try {
      const response = await apiRequest("POST", "/api/otp/verify", { phone: `52${phone}`, code: otpCode });
      if (response.verified) {
        setOtpVerified(true);
        toast({ title: "Verificado", description: "Tu número ha sido verificado correctamente" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Código inválido", variant: "destructive" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const canContinueToPayment = firstName && lastName && email && phone.length === 10 && otpVerified;

  const handlePayment = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/orders/complete", {
        ticketId,
        eventId,
        totalAmount: total.toFixed(2),
        fees: fees.toFixed(2),
        paymentMethod,
        phone: `52${phone}`
      });

      if (response.id) {
        setStep(3);
        toast({
          title: paymentMethod === "card" ? "¡Compra exitosa!" : "¡Orden creada!",
          description: paymentMethod === "card" 
            ? "Tus boletos han sido enviados a tu correo y WhatsApp."
            : "Revisa tu WhatsApp para las instrucciones de pago.",
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Error al procesar el pago", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!event || !ticket) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (step === 3) {
    return (
      <Layout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
            <Check className="h-12 w-12" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-2">
            {paymentMethod === "card" ? "¡Gracias por tu compra!" : "¡Orden creada!"}
          </h1>
          <p className="text-muted-foreground text-lg mb-4 max-w-md">
            {paymentMethod === "card" 
              ? "Tu pago ha sido procesado. Revisa tu WhatsApp para los detalles."
              : "Revisa tu WhatsApp para las instrucciones de pago."}
          </p>
          {paymentMethod !== "card" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 max-w-md">
              <p className="text-yellow-800 text-sm">
                Tienes 24 horas para completar el pago. Te enviaremos recordatorios por WhatsApp.
              </p>
            </div>
          )}
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setLocation("/")}>Volver al inicio</Button>
            <Button onClick={() => setLocation("/profile")}>Ver mis boletos</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-6">Finalizar Compra</h1>
        
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            <Card className={step > 1 ? "opacity-60 pointer-events-none" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">1</span>
                  Datos del Comprador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input 
                      placeholder="Tu nombre" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      data-testid="input-firstname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido</Label>
                    <Input 
                      placeholder="Tu apellido" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      data-testid="input-lastname"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    placeholder="correo@ejemplo.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-email"
                  />
                  <p className="text-xs text-muted-foreground">Aquí recibirás tus boletos.</p>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    WhatsApp (para verificación y notificaciones)
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex items-center bg-muted px-3 rounded-l-md border border-r-0">
                      <span className="text-sm text-muted-foreground">+52</span>
                    </div>
                    <Input 
                      type="tel"
                      placeholder="10 dígitos" 
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      className="rounded-l-none"
                      disabled={otpVerified}
                      data-testid="input-phone"
                    />
                    {!otpSent && !otpVerified && (
                      <Button 
                        type="button"
                        variant="secondary"
                        onClick={handleSendOtp}
                        disabled={phone.length !== 10 || sendingOtp}
                        data-testid="btn-send-otp"
                      >
                        {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código"}
                      </Button>
                    )}
                  </div>
                  
                  {otpSent && !otpVerified && (
                    <div className="flex gap-2 mt-2">
                      <Input 
                        type="text"
                        placeholder="Código de 6 dígitos" 
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        data-testid="input-otp"
                      />
                      <Button 
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={otpCode.length !== 6 || verifyingOtp}
                        data-testid="btn-verify-otp"
                      >
                        {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
                      </Button>
                    </div>
                  )}

                  {otpVerified && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <Check className="h-4 w-4" />
                      Número verificado correctamente
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Te enviaremos un código de verificación y las notificaciones de tu pedido por WhatsApp.
                  </p>
                </div>

                {step === 1 && (
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => setStep(2)}
                    disabled={!canContinueToPayment}
                    data-testid="btn-continue-payment"
                  >
                    Continuar al Pago
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className={step === 1 ? "opacity-60 pointer-events-none" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm">2</span>
                  Método de Pago
                </CardTitle>
                <CardDescription>Todas las transacciones son seguras y encriptadas.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-14">
                    <TabsTrigger value="card" className="flex flex-col gap-1 py-2" data-testid="tab-card">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-xs">Tarjeta</span>
                    </TabsTrigger>
                    <TabsTrigger value="spei" className="flex flex-col gap-1 py-2" data-testid="tab-spei">
                      <Banknote className="h-4 w-4" />
                      <span className="text-xs">Transferencia</span>
                    </TabsTrigger>
                    <TabsTrigger value="oxxo" className="flex flex-col gap-1 py-2" data-testid="tab-oxxo">
                      <Store className="h-4 w-4" />
                      <span className="text-xs">OXXO Pay</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-6">
                    <TabsContent value="card" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Número de Tarjeta</Label>
                        <Input placeholder="0000 0000 0000 0000" data-testid="input-card-number" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Expira</Label>
                          <Input placeholder="MM/AA" data-testid="input-card-expiry" />
                        </div>
                        <div className="space-y-2">
                          <Label>CVC</Label>
                          <Input placeholder="123" data-testid="input-card-cvc" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        Pagos procesados de forma segura.
                      </div>
                    </TabsContent>

                    <TabsContent value="spei" className="text-center py-4 space-y-4">
                      <p>Recibirás los datos bancarios (CLABE) por WhatsApp al confirmar tu orden.</p>
                      <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm">
                        Tienes 24 horas para realizar la transferencia. Te enviaremos recordatorios.
                      </div>
                    </TabsContent>

                    <TabsContent value="oxxo" className="text-center py-4 space-y-4">
                      <p>Recibirás la referencia de pago por WhatsApp para pagar en cualquier OXXO.</p>
                      <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm">
                        Tienes 24 horas para realizar el pago. Te enviaremos recordatorios.
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>

                <div className="mt-8">
                  <Button 
                    className="w-full h-12 text-lg font-bold" 
                    onClick={handlePayment} 
                    disabled={step === 1 || loading}
                    data-testid="btn-pay"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Procesando...
                      </>
                    ) : paymentMethod === "card" ? (
                      `Pagar $${total.toLocaleString("es-MX")}`
                    ) : (
                      `Crear Orden - $${total.toLocaleString("es-MX")}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen de Orden</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <img src={event.image || "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=200"} className="w-16 h-16 object-cover rounded" />
                    <div>
                      <div className="font-bold text-sm line-clamp-2">{event.title}</div>
                      <div className="text-xs text-muted-foreground">{venue?.name || "Venue"}</div>
                    </div>
                  </div>
                  <Separator />
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Boletos (1x)</span>
                      <span>${ticketPrice.toLocaleString("es-MX")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Zona</span>
                      <span>{zoneName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Asientos</span>
                      <span>Fila {ticket.row}, Asiento {ticket.seat}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cargos de servicio</span>
                      <span>${fees.toLocaleString("es-MX")}</span>
                    </div>
                    {includeCancellationInsurance && (
                      <div className="flex justify-between text-green-600">
                        <span>Seguro de cancelación</span>
                        <span>${insuranceCost.toLocaleString("es-MX")}</span>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Cancellation Insurance Option */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="insurance"
                        checked={includeCancellationInsurance}
                        onCheckedChange={(checked) => setIncludeCancellationInsurance(checked === true)}
                        data-testid="checkbox-insurance"
                      />
                      <div className="flex-1">
                        <label htmlFor="insurance" className="flex items-center gap-2 font-medium text-sm cursor-pointer">
                          <Shield className="h-4 w-4 text-green-600" />
                          Seguro de Cancelación
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cancela hasta 72h antes del evento. 18% del valor del boleto (${(ticketPrice * 0.18).toLocaleString("es-MX")})
                        </p>
                        <div className="flex items-start gap-1 mt-2 text-xs text-muted-foreground">
                          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>El seguro no es reembolsable. Al cancelar se retiene 20% adicional.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">${total.toLocaleString("es-MX")}</span>
                  </div>
                </CardContent>
              </Card>
              
              <div className="flex items-start gap-2 text-xs text-muted-foreground p-2">
                <Clock className="h-4 w-4 shrink-0" />
                <p>Los boletos están reservados por 10:00 minutos. Completa tu compra antes de que sean liberados.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
