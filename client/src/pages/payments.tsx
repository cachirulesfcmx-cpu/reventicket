import { Layout } from "@/components/layout";
import { 
  CreditCard, 
  Banknote, 
  Building2, 
  MessageCircle, 
  Shield, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Smartphone
} from "lucide-react";

export default function Payments() {
  return (
    <Layout>
      <div className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl font-heading font-bold mb-4">
              Pagos y Reembolsos
            </h1>
            <p className="text-lg text-muted-foreground">
              Información importante sobre métodos de pago, entregas y políticas de cancelación.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-12">
          
          {/* Métodos de Pago */}
          <section>
            <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" />
              Métodos de Pago
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-6 bg-card rounded-xl border">
                <CreditCard className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-bold mb-2">Tarjeta de Crédito/Débito</h3>
                <p className="text-sm text-muted-foreground">
                  Visa, Mastercard y American Express. Pago instantáneo y seguro.
                </p>
              </div>
              <div className="p-6 bg-card rounded-xl border">
                <Banknote className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-bold mb-2">OXXO</h3>
                <p className="text-sm text-muted-foreground">
                  Paga en efectivo en cualquier tienda OXXO. Tienes 48 horas para completar el pago.
                </p>
              </div>
              <div className="p-6 bg-card rounded-xl border">
                <Building2 className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-bold mb-2">Transferencia SPEI</h3>
                <p className="text-sm text-muted-foreground">
                  Transfiere desde tu banco. El pago se acredita en minutos.
                </p>
              </div>
            </div>
          </section>

          {/* Entrega de Boletos */}
          <section className="bg-blue-50 rounded-2xl p-8">
            <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-blue-600" />
              Entrega de Boletos
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <MessageCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold mb-1">Entrega 100% Digital por WhatsApp</h3>
                  <p className="text-muted-foreground">
                    Todos los boletos se entregan de forma digital a través de WhatsApp. 
                    Recibirás un mensaje con toda la información necesaria para el acceso al evento.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Clock className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold mb-1">Entrega 48 Horas Antes del Evento</h3>
                  <p className="text-muted-foreground">
                    Para garantizar la autenticidad de tus boletos y protegerte contra fraudes o clonaciones, 
                    <strong> los boletos se entregan máximo 48 horas antes del evento.</strong>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Aviso Importante */}
          <section className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-8 w-8 text-yellow-600 flex-shrink-0" />
              <div>
                <h2 className="text-xl font-heading font-bold mb-3 text-yellow-800">
                  Aviso Importante: Entrega Digital Exclusiva
                </h2>
                <p className="text-yellow-700 leading-relaxed">
                  <strong>TODAS las entregas, sin excepción alguna, son digitales.</strong> Los boletos se 
                  entregarán <strong>48 horas antes del evento</strong> para evitar fraudes, clonaciones 
                  o cualquier tipo de mal uso. Esta política protege tanto a compradores como a vendedores 
                  y garantiza la autenticidad de cada boleto.
                </p>
              </div>
            </div>
          </section>

          {/* Seguro de Cancelación */}
          <section>
            <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Seguro de Cancelación
            </h2>
            <div className="bg-card rounded-xl border p-6 space-y-4">
              <div className="flex items-start gap-4 pb-4 border-b">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold mb-1">Cobertura del Seguro</h3>
                  <p className="text-muted-foreground">
                    Al adquirir el Seguro de Cancelación (18% del valor de cada boleto), 
                    podrás cancelar tu compra hasta <strong>72 horas antes del evento</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 pb-4 border-b">
                <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold mb-1">Sin Seguro de Cancelación</h3>
                  <p className="text-muted-foreground">
                    Si no adquieres el seguro, <strong>no podrás cancelar ni solicitar reembolso</strong> una 
                    vez realizada la compra.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold mb-1">Importante</h3>
                  <p className="text-muted-foreground">
                    El Seguro de Cancelación <strong>NO es reembolsable</strong> bajo ninguna circunstancia.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Política de Reembolsos */}
          <section>
            <h2 className="text-2xl font-heading font-bold mb-6">
              Política de Reembolsos
            </h2>
            <div className="bg-card rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-bold">Concepto</th>
                    <th className="text-left p-4 font-bold">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="p-4 font-medium">Cancelación con Seguro</td>
                    <td className="p-4 text-muted-foreground">
                      Reembolso del 80% del valor del boleto (se retiene 20% + seguro)
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4 font-medium">Cargo por cancelación</td>
                    <td className="p-4 text-muted-foreground">
                      20% del valor total del pedido
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4 font-medium">Plazo para cancelar</td>
                    <td className="p-4 text-muted-foreground">
                      Hasta 72 horas antes del evento (solo con seguro)
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4 font-medium">Tiempo de reembolso</td>
                    <td className="p-4 text-muted-foreground">
                      5-10 días hábiles después de aprobada la cancelación
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="p-4 font-medium">Evento cancelado por organizador</td>
                    <td className="p-4 text-muted-foreground">
                      Reembolso del 100% del valor del boleto
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Resumen de Cargos */}
          <section className="bg-muted/30 rounded-2xl p-8">
            <h2 className="text-xl font-heading font-bold mb-6">Resumen de Cargos</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <div className="text-2xl font-bold text-primary mb-1">18%</div>
                <div className="text-sm text-muted-foreground">Seguro de Cancelación (opcional)</div>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 mb-1">20%</div>
                <div className="text-sm text-muted-foreground">Cargo por cancelación/reembolso</div>
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section className="text-center">
            <h2 className="text-xl font-heading font-bold mb-4">¿Tienes dudas?</h2>
            <p className="text-muted-foreground mb-6">
              Contáctanos por WhatsApp y te ayudaremos con cualquier pregunta sobre pagos o reembolsos.
            </p>
            <a 
              href="https://wa.me/5215512345678" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              data-testid="link-payments-whatsapp"
            >
              <MessageCircle className="h-5 w-5" />
              Contactar Soporte
            </a>
          </section>
        </div>
      </div>
    </Layout>
  );
}
