import { Layout } from "@/components/layout";
import { Ticket, DollarSign, Shield, MessageCircle, ChevronRight } from "lucide-react";

export default function Sell() {
  return (
    <Layout>
      <div className="bg-gradient-to-b from-green-500/10 to-background">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Ticket className="h-4 w-4" />
              Vende tus boletos
            </div>
            <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6">
              ¿Tienes boletos que no vas a usar?
            </h1>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Vende tus boletos de forma segura a través de RevenTicket. 
              Nosotros nos encargamos de todo: verificación, pago y entrega.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-heading font-bold text-center mb-12">
            ¿Cómo funciona?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-bold mb-2">Contáctanos</h3>
              <p className="text-sm text-muted-foreground">
                Escríbenos por WhatsApp con los detalles de tus boletos: evento, fecha, zona y precio deseado.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-bold mb-2">Verificamos</h3>
              <p className="text-sm text-muted-foreground">
                Nuestro equipo verifica la autenticidad de tus boletos y acordamos el precio de venta.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-bold mb-2">Recibe tu pago</h3>
              <p className="text-sm text-muted-foreground">
                Una vez vendidos, recibes tu pago por transferencia bancaria de forma segura.
              </p>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-8 border mb-16">
            <h2 className="text-xl font-bold mb-6">Beneficios de vender con nosotros</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Proceso seguro</h3>
                  <p className="text-sm text-muted-foreground">
                    Protegemos tu información y garantizamos transacciones seguras.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Mejor precio</h3>
                  <p className="text-sm text-muted-foreground">
                    Te ayudamos a establecer un precio competitivo para vender rápido.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Soporte personalizado</h3>
                  <p className="text-sm text-muted-foreground">
                    Te acompañamos en todo el proceso de venta.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Ticket className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Sin complicaciones</h3>
                  <p className="text-sm text-muted-foreground">
                    Nosotros nos encargamos de la publicación y entrega al comprador.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-8 md:p-12 text-center text-white">
            <h2 className="text-3xl font-heading font-bold mb-4">
              ¿Listo para vender?
            </h2>
            <p className="text-green-100 mb-8 max-w-md mx-auto">
              Contáctanos por WhatsApp y te ayudaremos a vender tus boletos de forma rápida y segura.
            </p>
            <a 
              href="https://wa.me/5215512345678?text=Hola%2C%20quiero%20vender%20mis%20boletos" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-white text-green-600 font-bold py-4 px-8 rounded-xl hover:bg-green-50 transition-colors text-lg"
              data-testid="sell-whatsapp-button"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Contactar por WhatsApp
              <ChevronRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
