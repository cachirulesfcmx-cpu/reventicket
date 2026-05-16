import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import * as fs from "fs";
import * as path from "path";

const SESSION_PATH = "/tmp/wwebjs_session";
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";

function cleanupSession() {
  if (!WHATSAPP_ENABLED) return;
  
  try {
    if (fs.existsSync(SESSION_PATH)) {
      fs.rmSync(SESSION_PATH, { recursive: true, force: true });
      console.log("Sesión anterior de WhatsApp limpiada");
    }
  } catch (error) {
    console.error("Error limpiando sesión:", error);
  }
}

class WhatsAppService {
  private client: InstanceType<typeof Client> | null = null;
  private isReady = false;
  private qrCode: string | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = WHATSAPP_ENABLED;
    if (!this.enabled) {
      console.log("WhatsApp deshabilitado (WHATSAPP_ENABLED !== 'true')");
    }
  }

  async initialize() {
    if (!this.enabled) {
      console.log("WhatsApp no se inicializará (deshabilitado)");
      return;
    }

    if (this.client) return;

    cleanupSession();

    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: SESSION_PATH
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (() => {
          const { execSync } = require("child_process");
          try { return execSync("which chromium || which chromium-browser || which google-chrome", { encoding: "utf8" }).trim(); } 
          catch { return "/usr/bin/chromium"; }
        })(),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-sync",
          "--user-data-dir=/tmp/chromium-data-" + Date.now()
        ]
      }
    });

    this.client.on("qr", (qr: string) => {
      this.qrCode = qr;
      console.log("\n========== ESCANEA ESTE QR EN WHATSAPP ==========");
      qrcode.generate(qr, { small: true });
      console.log("=================================================\n");
    });

    this.client.on("ready", () => {
      this.isReady = true;
      this.qrCode = null;
      console.log("WhatsApp bot conectado y listo!");
    });

    this.client.on("authenticated", () => {
      console.log("WhatsApp autenticado correctamente");
    });

    this.client.on("auth_failure", (msg: string) => {
      console.error("Error de autenticación:", msg);
      this.isReady = false;
    });

    this.client.on("disconnected", (reason: string) => {
      console.log("WhatsApp desconectado:", reason);
      this.isReady = false;
    });

    try {
      await this.client.initialize();
    } catch (error) {
      console.error("Error inicializando WhatsApp:", error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStatus() {
    if (!this.enabled) {
      return {
        isReady: false,
        qrCode: null,
        connected: false,
        enabled: false,
        message: "WhatsApp está deshabilitado"
      };
    }
    return {
      isReady: this.isReady,
      qrCode: this.qrCode,
      connected: this.isReady,
      enabled: true
    };
  }

  getQRCode() {
    if (!this.enabled) return null;
    return this.qrCode;
  }

  formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("52") && cleaned.length === 12) {
      return `${cleaned}@c.us`;
    }
    if (cleaned.length === 10) {
      return `52${cleaned}@c.us`;
    }
    return `${cleaned}@c.us`;
  }

  async sendMessage(phone: string, message: string): Promise<boolean> {
    if (!this.enabled) {
      console.log("WhatsApp deshabilitado, mensaje no enviado");
      return false;
    }

    if (!this.isReady || !this.client) {
      console.log("WhatsApp no está listo para enviar mensajes");
      return false;
    }

    try {
      const chatId = this.formatPhone(phone);
      await this.client.sendMessage(chatId, message);
      console.log(`Mensaje enviado a ${phone}`);
      return true;
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      return false;
    }
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(phone: string, code: string): Promise<boolean> {
    const message = `🎫 *RevenTicket - Código de verificación*\n\nTu código es: *${code}*\n\nEste código expira en 10 minutos.\n\n_No compartas este código con nadie._`;
    return this.sendMessage(phone, message);
  }

  async sendOrderConfirmation(phone: string, orderDetails: {
    orderId: string;
    eventTitle: string;
    eventDate: string;
    venue: string;
    zone: string;
    row: string;
    seat: string;
    total: string;
    paymentMethod: string;
  }): Promise<boolean> {
    const confirmationMessage = `🎉 *RevenTicket - Pedido Confirmado*\n\n📋 *Pedido #${orderDetails.orderId.slice(0, 8)}*\n\n🎪 *${orderDetails.eventTitle}*\n📅 ${orderDetails.eventDate}\n📍 ${orderDetails.venue}\n\n🎟️ *Tu boleto:*\n• Zona: ${orderDetails.zone}\n• Fila: ${orderDetails.row}\n• Asiento: ${orderDetails.seat}\n\n💰 *Total: $${orderDetails.total} MXN*\n💳 Método: ${orderDetails.paymentMethod}\n\n¡Gracias por tu compra!`;
    
    const sent = await this.sendMessage(phone, confirmationMessage);
    
    const isNonCardPayment = orderDetails.paymentMethod.toLowerCase() !== 'tarjeta' && 
                              orderDetails.paymentMethod.toLowerCase() !== 'card' &&
                              orderDetails.paymentMethod.toLowerCase() !== 'tarjeta de crédito' &&
                              orderDetails.paymentMethod.toLowerCase() !== 'tarjeta de débito';
    
    if (sent && isNonCardPayment) {
      setTimeout(async () => {
        const transferDataMessage = `📝 *RevenTicket - Datos para Transferencia*\n\nPara completar la transferencia de tus boletos, necesitamos los siguientes datos:\n\n👤 *Nombre completo:*\n📧 *Correo electrónico:*\n📱 *Teléfono:*\n\n⚠️ *Importante:* Estos datos deben coincidir con la persona que asistirá al evento.\n\nPor favor responde a este mensaje con la información solicitada.\n\n_Tus boletos serán enviados 48 horas antes del evento._`;
        await this.sendMessage(phone, transferDataMessage);
      }, 3000);
    }
    
    return sent;
  }

  async sendPaymentConfirmed(phone: string, orderDetails: {
    orderId: string;
    eventTitle: string;
    total: string;
  }): Promise<boolean> {
    const message = `✅ *RevenTicket - Pago Confirmado*\n\n¡Tu pago ha sido procesado exitosamente!\n\n📋 Pedido: #${orderDetails.orderId.slice(0, 8)}\n🎪 Evento: ${orderDetails.eventTitle}\n💰 Total: $${orderDetails.total} MXN\n\nTus boletos ya están listos. ¡Disfruta el evento! 🎉`;
    return this.sendMessage(phone, message);
  }

  async sendPaymentInstructions(phone: string, orderDetails: {
    orderId: string;
    eventTitle: string;
    total: string;
    paymentMethod: "oxxo" | "spei";
    reference?: string;
    clabe?: string;
  }): Promise<boolean> {
    let instructions = "";
    
    if (orderDetails.paymentMethod === "oxxo") {
      instructions = `🏪 *Pago en OXXO*\n\n📋 Referencia: *${orderDetails.reference || "Pendiente"}*\n💰 Monto a pagar: *$${orderDetails.total} MXN*\n\n*Instrucciones:*\n1. Acude a cualquier OXXO\n2. Indica que harás un pago de servicio\n3. Proporciona la referencia\n4. Paga el monto exacto\n5. Conserva tu ticket`;
    } else {
      instructions = `🏦 *Transferencia SPEI*\n\n💳 CLABE: *${orderDetails.clabe || "646180123456789012"}*\n🏛️ Banco: STP\n👤 Beneficiario: RevenTicket SA de CV\n💰 Monto: *$${orderDetails.total} MXN*\n📋 Referencia: *${orderDetails.reference || orderDetails.orderId.slice(0, 8)}*\n\n*Importante:* Usa la referencia exacta para identificar tu pago.`;
    }

    const message = `💳 *RevenTicket - Instrucciones de Pago*\n\n📋 Pedido: #${orderDetails.orderId.slice(0, 8)}\n🎪 ${orderDetails.eventTitle}\n\n${instructions}\n\n⏰ Tienes 24 horas para completar el pago.\n\nUna vez que realices el pago, envíanos una foto de tu comprobante a este chat.`;
    return this.sendMessage(phone, message);
  }

  async sendPaymentReminder(phone: string, orderDetails: {
    orderId: string;
    eventTitle: string;
    total: string;
    hoursRemaining: number;
  }): Promise<boolean> {
    const message = `⏰ *RevenTicket - Recordatorio de Pago*\n\n📋 Pedido: #${orderDetails.orderId.slice(0, 8)}\n🎪 ${orderDetails.eventTitle}\n💰 Total pendiente: $${orderDetails.total} MXN\n\n⚠️ Tu pedido sigue pendiente de pago.\n\n${orderDetails.hoursRemaining <= 6 ? "🚨 *¡No pierdas tus boletos!* Tu pedido podría cancelarse pronto." : "Recuerda completar tu pago para asegurar tus boletos."}\n\n¿Necesitas ayuda? Responde a este mensaje.`;
    return this.sendMessage(phone, message);
  }

  async sendAbandonedCartReminder(phone: string, eventDetails: {
    eventTitle: string;
    eventDate: string;
    venue: string;
  }): Promise<boolean> {
    const message = `👋 *RevenTicket - ¿Olvidaste algo?*\n\n¡Notamos que dejaste un boleto en tu carrito!\n\n🎪 *${eventDetails.eventTitle}*\n📅 ${eventDetails.eventDate}\n📍 ${eventDetails.venue}\n\nLos boletos son limitados y se agotan rápido. ¡No pierdas tu oportunidad!\n\n🔗 Regresa a RevenTicket para completar tu compra.`;
    return this.sendMessage(phone, message);
  }
}

export const whatsappService = new WhatsAppService();
