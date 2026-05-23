/**
 * RevenTicket — Web Push Notifications (admin)
 *
 * Variables de entorno necesarias:
 *   VAPID_PUBLIC_KEY   — clave pública VAPID
 *   VAPID_PRIVATE_KEY  — clave privada VAPID
 *   VAPID_EMAIL        — mailto: para identificación (ej. admin@reventicket.mx)
 *
 * Para generar claves VAPID (una sola vez):
 *   npx web-push generate-vapid-keys
 */

import webpush, { type PushSubscription } from "web-push";
import { pool } from "../db";

// ── Configurar VAPID ─────────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || "mailto:admin@reventicket.mx";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn("[PushNotif] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configurados — push deshabilitado.");
}

export const pushEnabled = !!(VAPID_PUBLIC && VAPID_PRIVATE);

// ── Tabla de suscripciones (creada si no existe) ─────────────────────────────
export async function ensurePushTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     VARCHAR REFERENCES users(id) ON DELETE CASCADE,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'admin',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// ── Guardar suscripción ──────────────────────────────────────────────────────
export async function saveSubscription(userId: string, sub: PushSubscription, role = "admin") {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, role = $5`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, role]
  );
}

// ── Eliminar suscripción ─────────────────────────────────────────────────────
export async function removeSubscription(endpoint: string) {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

// ── Enviar push a todos los admins ──────────────────────────────────────────
export async function sendPushToAdmins(payload: {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}) {
  if (!pushEnabled) return;

  let rows: any[] = [];
  try {
    const result = await pool.query(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE role = 'admin'`
    );
    rows = result.rows;
  } catch (err) {
    console.error("[PushNotif] Error leyendo suscripciones:", err);
    return;
  }

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/favicon.png",
    badge: "/favicon.png",
    url: payload.url || "/portal-admin/dashboard",
    tag: payload.tag || "admin-notif",
  });

  const results = await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        data
      ).catch(async (err: any) => {
        // Suscripción expirada → eliminar
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await removeSubscription(row.endpoint);
        }
        throw err;
      })
    )
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  console.log(`[PushNotif] Enviados ${ok}/${rows.length} push a admins`);
}

export { VAPID_PUBLIC as vapidPublicKey };
