import { Router } from "express";
import { db } from "../db";
import { orders, tickets } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  createCardPayment,
  createOxxoPayment,
  createSpeiPayment,
  getPaymentStatus,
  verifyClipWebhook,
} from "../lib/clip";

export const paymentsRouter = Router();

// ── Crear pago ────────────────────────────────────────────────────────────────
paymentsRouter.post("/create", async (req, res) => {
  try {
    const {
      orderId,
      paymentMethod, // "card" | "oxxo" | "spei"
      cardToken,     // solo para tarjeta
      customerEmail,
      customerName,
      customerPhone,
    } = req.body;

    if (!orderId || !paymentMethod || !customerEmail) {
      return res.status(400).json({ error: "Faltan datos requeridos" });
    }

    // Obtener orden
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });
    if (order.status === "paid") return res.status(400).json({ error: "Orden ya pagada" });

    const amount = parseFloat(order.totalAmount as string);
    const description = `RevenTicket - Orden ${orderId.slice(0, 8).toUpperCase()}`;

    let result;

    if (paymentMethod === "card") {
      result = await createCardPayment({
        amount,
        currency: "MXN",
        description,
        orderId,
        customerEmail,
        customerPhone: customerPhone || "",
        cardToken,
        redirectUrl: `${process.env.FRONTEND_URL || "https://reventicket.com.mx"}/checkout/success?orderId=${orderId}`,
      });
    } else if (paymentMethod === "oxxo") {
      result = await createOxxoPayment({
        amount,
        currency: "MXN",
        description,
        orderId,
        customerEmail,
        customerName: customerName || customerEmail,
      });
    } else if (paymentMethod === "spei") {
      result = await createSpeiPayment({
        amount,
        currency: "MXN",
        description,
        orderId,
        customerEmail,
        customerName: customerName || customerEmail,
      });
    } else {
      return res.status(400).json({ error: "Método de pago no válido" });
    }

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Guardar referencia de pago en la orden
    await db.update(orders)
      .set({
        paymentReference: result.paymentId,
        paymentMethod,
        status: paymentMethod === "card" ? "reserved" : "pending",
      })
      .where(eq(orders.id, orderId));

    return res.json({
      success: true,
      paymentId: result.paymentId,
      // Tarjeta
      redirectUrl: result.redirectUrl,
      // OXXO
      reference: result.reference,
      barcode: result.barcode,
      expiresAt: result.expiresAt,
      // SPEI
      clabe: result.clabe,
      amount,
      paymentMethod,
    });
  } catch (err: any) {
    console.error("[Payments] Create error:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ── Webhook de Clip (confirmar pagos OXXO/SPEI automáticamente) ───────────────
paymentsRouter.post("/webhook/clip", async (req, res) => {
  try {
    const signature = req.headers["x-clip-signature"] as string || "";
    const rawBody = JSON.stringify(req.body);

    if (!verifyClipWebhook(rawBody, signature)) {
      console.warn("[Webhook] Firma inválida");
      return res.status(401).json({ error: "Firma inválida" });
    }

    const { type, data } = req.body;

    if (type === "charge.paid") {
      const paymentId = data?.id;
      const orderId = data?.order_id;

      if (!orderId) return res.status(400).json({ error: "Sin order_id" });

      // Marcar orden como pagada
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!order) return res.status(404).json({ error: "Orden no encontrada" });

      await db.update(orders)
        .set({ status: "paid" })
        .where(eq(orders.id, orderId));

      // Marcar boleto como vendido
      await db.update(tickets)
        .set({ status: "sold" })
        .where(eq(tickets.id, order.ticketId));

      console.log(`[Webhook] Pago confirmado: orden ${orderId}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] Error:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── Verificar estado ──────────────────────────────────────────────────────────
paymentsRouter.get("/status/:orderId", async (req, res) => {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, req.params.orderId));
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });

    // Si tiene referencia de Clip, verificar en tiempo real
    if (order.paymentReference && order.status !== "paid") {
      const clipStatus = await getPaymentStatus(order.paymentReference);
      if (clipStatus.paid && order.status !== "paid") {
        await db.update(orders)
          .set({ status: "paid" })
          .where(eq(orders.id, order.id));
        await db.update(tickets)
          .set({ status: "sold" })
          .where(eq(tickets.id, order.ticketId));
        order.status = "paid";
      }
    }

    res.json({
      orderId: order.id,
      status: order.status,
      paid: order.status === "paid",
      paymentMethod: order.paymentMethod,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error interno" });
  }
});
