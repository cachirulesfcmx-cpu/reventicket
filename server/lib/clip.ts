/**
 * Clip.mx Payment Gateway
 * Docs: https://developer.clip.mx/
 * 
 * Variables de entorno requeridas:
 * CLIP_API_KEY=tu_api_key_de_clip
 * CLIP_SECRET_KEY=tu_secret_key_de_clip (para webhooks)
 */

const CLIP_BASE_URL = "https://api-gw.payclip.com";

interface ClipCardPayment {
  amount: number;        // en pesos MXN
  currency: string;      // "MXN"
  description: string;
  orderId: string;
  customerEmail: string;
  customerPhone: string;
  cardToken?: string;    // token de la tarjeta desde Clip.js
  redirectUrl?: string;
}

interface ClipOxxoPayment {
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  customerEmail: string;
  customerName: string;
  expiresAt?: string;    // ISO date, default 3 days
}

interface ClipSpeiPayment {
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  customerEmail: string;
  customerName: string;
}

interface ClipPaymentResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  // For OXXO/SPEI
  reference?: string;
  barcode?: string;
  clabe?: string;
  expiresAt?: string;
  // For card redirect
  redirectUrl?: string;
  error?: string;
}

function getHeaders() {
  const apiKey = process.env.CLIP_API_KEY;
  if (!apiKey) throw new Error("CLIP_API_KEY no configurada");
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "Accept": "application/vnd.payclip.v2+json",
  };
}

// ── Pago con tarjeta ──────────────────────────────────────────────────────────
export async function createCardPayment(params: ClipCardPayment): Promise<ClipPaymentResult> {
  try {
    const response = await fetch(`${CLIP_BASE_URL}/charges`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        amount: Math.round(params.amount * 100), // Clip usa centavos
        currency: params.currency || "MXN",
        description: params.description,
        order_id: params.orderId,
        customer: {
          email: params.customerEmail,
          phone: params.customerPhone,
        },
        payment_form: {
          type: params.cardToken ? "token" : "redirect",
          token: params.cardToken,
          redirect_url: params.redirectUrl || `${process.env.FRONTEND_URL}/checkout/success`,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || "Error procesando tarjeta" };
    }

    return {
      success: true,
      paymentId: data.id,
      status: data.status,
      redirectUrl: data.payment_form?.redirect_url,
    };
  } catch (err: any) {
    console.error("[Clip] Card payment error:", err);
    return { success: false, error: err.message };
  }
}

// ── Pago OXXO ────────────────────────────────────────────────────────────────
export async function createOxxoPayment(params: ClipOxxoPayment): Promise<ClipPaymentResult> {
  try {
    // OXXO expira en 3 días por default
    const expiresAt = params.expiresAt || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(`${CLIP_BASE_URL}/charges`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        amount: Math.round(params.amount * 100),
        currency: params.currency || "MXN",
        description: params.description,
        order_id: params.orderId,
        customer: {
          email: params.customerEmail,
          name: params.customerName,
        },
        payment_form: {
          type: "oxxo",
          expires_at: expiresAt,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || "Error generando referencia OXXO" };
    }

    return {
      success: true,
      paymentId: data.id,
      status: "pending",
      reference: data.payment_form?.reference,
      barcode: data.payment_form?.barcode_url,
      expiresAt: data.payment_form?.expires_at,
    };
  } catch (err: any) {
    console.error("[Clip] OXXO payment error:", err);
    return { success: false, error: err.message };
  }
}

// ── Pago SPEI ────────────────────────────────────────────────────────────────
export async function createSpeiPayment(params: ClipSpeiPayment): Promise<ClipPaymentResult> {
  try {
    const response = await fetch(`${CLIP_BASE_URL}/charges`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        amount: Math.round(params.amount * 100),
        currency: params.currency || "MXN",
        description: params.description,
        order_id: params.orderId,
        customer: {
          email: params.customerEmail,
          name: params.customerName,
        },
        payment_form: {
          type: "spei",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || "Error generando CLABE SPEI" };
    }

    return {
      success: true,
      paymentId: data.id,
      status: "pending",
      clabe: data.payment_form?.clabe,
      reference: data.payment_form?.reference,
      expiresAt: data.payment_form?.expires_at,
    };
  } catch (err: any) {
    console.error("[Clip] SPEI payment error:", err);
    return { success: false, error: err.message };
  }
}

// ── Verificar estado de pago ──────────────────────────────────────────────────
export async function getPaymentStatus(paymentId: string): Promise<{ status: string; paid: boolean }> {
  try {
    const response = await fetch(`${CLIP_BASE_URL}/charges/${paymentId}`, {
      headers: getHeaders(),
    });
    const data = await response.json();
    return {
      status: data.status || "unknown",
      paid: data.status === "paid" || data.status === "approved",
    };
  } catch (err) {
    return { status: "error", paid: false };
  }
}

// ── Webhook de Clip ───────────────────────────────────────────────────────────
export function verifyClipWebhook(payload: string, signature: string): boolean {
  const secretKey = process.env.CLIP_SECRET_KEY;
  if (!secretKey) return false;
  
  const crypto = require("crypto");
  const expectedSig = crypto
    .createHmac("sha256", secretKey)
    .update(payload)
    .digest("hex");
  
  return signature === expectedSig;
}
