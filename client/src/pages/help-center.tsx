import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { 
  HelpCircle, 
  CreditCard, 
  Truck, 
  RefreshCcw, 
  Shield, 
  MessageCircle,
  ChevronRight,
  Search,
  Ticket,
  Calendar
} from "lucide-react";
import { Input } from "@/components/ui/input";

const HELP_CATEGORIES = [
  {
    icon: Ticket,
    title: "Comprar boletos",
    description: "Cómo buscar, seleccionar y comprar tus boletos",
    link: "/help/buying"
  },
  {
    icon: CreditCard,
    title: "Pagos y facturación",
    description: "Métodos de pago, precios y cargos",
    link: "/payments"
  },
  {
    icon: Truck,
    title: "Entrega de boletos",
    description: "Cómo recibir tus boletos digitales",
    link: "/payments"
  },
  {
    icon: RefreshCcw,
    title: "Cambios y reembolsos",
    description: "Políticas de cancelación y devoluciones",
    link: "/payments"
  },
  {
    icon: Shield,
    title: "RevenProtect",
    description: "Nuestra garantía de compra segura",
    link: "/payments"
  },
  {
    icon: Calendar,
    title: "Eventos cancelados",
    description: "Qué hacer si tu evento se cancela o pospone",
    link: "/payments"
  }
];

const FAQ = [
  {
    question: "¿Cómo recibo mis boletos?",
    answer: "Todos los boletos se entregan de forma digital vía WhatsApp. Recibirás tus boletos 48 horas antes del evento para garantizar su autenticidad y evitar fraudes."
  },
  {
    question: "¿Los boletos son originales?",
    answer: "Sí, todos los boletos que vendemos son 100% originales y verificados. Contamos con la garantía RevenProtect que te protege en caso de cualquier problema."
  },
  {
    question: "¿Puedo cancelar mi compra?",
    answer: "Sí, si adquiriste el Seguro de Cancelación puedes cancelar hasta 72 horas antes del evento. Las cancelaciones tienen un cargo del 20% sobre el valor total."
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer: "Aceptamos tarjetas de crédito/débito, pagos en OXXO y transferencias bancarias (SPEI)."
  },
  {
    question: "¿Cómo contacto a soporte?",
    answer: "Puedes contactarnos 24/7 vía WhatsApp. Nuestro equipo está listo para ayudarte en cualquier momento."
  }
];

export default function HelpCenter() {
  return (
    <Layout>
      <div className="bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h1 className="text-4xl font-heading font-bold mb-4">
              Centro de Ayuda
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              ¿En qué podemos ayudarte hoy?
            </p>
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Buscar en ayuda..." 
                className="pl-12 h-14 text-lg rounded-xl"
                data-testid="input-help-search"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-heading font-bold mb-8">Categorías de ayuda</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {HELP_CATEGORIES.map((category) => (
            <Link key={category.title} href={category.link} data-testid={`link-help-${category.title.toLowerCase().replace(/\s/g, '-')}`}>
              <div className="p-6 bg-card rounded-xl border hover:border-primary hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <category.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold mb-1 group-hover:text-primary transition-colors">
                      {category.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="text-2xl font-heading font-bold mb-8">Preguntas frecuentes</h2>
        <div className="max-w-3xl space-y-4 mb-16">
          {FAQ.map((item, index) => (
            <div key={index} className="p-6 bg-card rounded-xl border">
              <h3 className="font-bold mb-2 flex items-start gap-2">
                <HelpCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                {item.question}
              </h3>
              <p className="text-muted-foreground pl-7">{item.answer}</p>
            </div>
          ))}
        </div>

        <div className="bg-primary/5 rounded-2xl p-8 text-center">
          <MessageCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-bold mb-2">
            ¿No encontraste lo que buscabas?
          </h2>
          <p className="text-muted-foreground mb-6">
            Nuestro equipo de soporte está disponible 24/7 para ayudarte.
          </p>
          <a 
            href="https://wa.me/5215512345678" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            data-testid="link-help-whatsapp"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contactar por WhatsApp
          </a>
        </div>
      </div>
    </Layout>
  );
}
