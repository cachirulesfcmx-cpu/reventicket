# RevenTicket 🎟️

Plataforma de reventa de boletos para México. Toda la comunicación vía WhatsApp.

## Stack
- **Frontend**: React 19 + TypeScript + Wouter + TanStack Query
- **Backend**: Express 5 + TypeScript
- **DB**: PostgreSQL + Drizzle ORM
- **WhatsApp**: whatsapp-web.js (OTP, confirmaciones, entrega de boletos)
- **Pagos**: Tarjeta / SPEI / OXXO

## Setup en Replit

1. Importa este ZIP como proyecto Replit
2. Las variables de entorno ya están en `.env.example` — cópialas en Secrets
3. Ejecuta `npm run db:push` para crear las tablas
4. Ejecuta `npm run db:seed` para poblar datos de ejemplo
5. Haz clic en **Run**

## Variables de entorno requeridas
| Variable | Descripción |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (auto-provisto por Replit) |
| `SESSION_SECRET` | String aleatorio para sesiones |
| `WHATSAPP_ENABLED` | `true` para activar el bot de WhatsApp |
| `JOBS_ENABLED` | `true` para recordatorios automáticos |

## WhatsApp Bot
Cuando `WHATSAPP_ENABLED=true`, el bot:
1. Genera un QR en los logs del servidor
2. Escanéalo con WhatsApp en tu teléfono
3. El bot enviará OTPs, confirmaciones y boletos automáticamente

## Admin Panel
Accede en `/admin/login`
- Email: `admin@reventicket.com`
- Password: `admin123`

## Funciones
- ✅ OTP login vía WhatsApp (sin contraseñas)
- ✅ Mapa interactivo de venue con selección de zona
- ✅ Compra de boletos con tarjeta / SPEI / OXXO
- ✅ Seguro de cancelación opcional
- ✅ Entrega de boletos por WhatsApp
- ✅ Panel admin: eventos, órdenes, WhatsApp status
- ✅ Anti-scalping y engine de riesgo
- ✅ Analytics de conversión
- ✅ Carrito abandonado con recordatorio automático
