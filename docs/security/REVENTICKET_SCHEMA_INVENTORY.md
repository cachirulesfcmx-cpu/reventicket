# RevenTicket: inventario de esquema (código vs. remoto)

Generado el 2026-10-29. **Código**: tablas y columnas que crea `shared/schema.ts` (`drizzle-kit push` en una base vacía, rama `main` `1903f11`) más las que el backend crea al arrancar. **Remoto**: estructura de `jxdyrzbeykhswpndoing` leída de `information_schema` (solo nombres, sin datos). No se leyó ningún dato.

| Tabla | Origen en el código | Columnas que necesita el código | Remoto | Diferencia |
|---|---|---|---|---|
| `analytics_events` | shared/schema.ts | 11: created_at, event_id, event_name, id, metadata, order_id, session_hash, ticket_id, user_id, venue_id, zone_id | no existe | **falta la tabla** |
| `bans` | shared/schema.ts | 11: banned_by, created_at, expires_at, id, ip_hash, is_active, phone, reason, reason_codes, session_hash, user_id | no existe | **falta la tabla** |
| `carts` | shared/schema.ts | 9: created_at, event_id, id, phone, reminder_sent, session_id, status, ticket_id, updated_at | no existe | **falta la tabla** |
| `config` | shared/schema.ts | 4: id, key, updated_at, value | existe | — |
| `discount_codes` | shared/schema.ts | 11: code, created_at, description, expires_at, id, is_active, max_uses, min_order_amount, type, used_count, value | no existe | **falta la tabla** |
| `event_maps` | shared/schema.ts | 8: created_at, event_id, id, image_url, name, sections, svg_data, updated_at | no existe | **falta la tabla** |
| `events` | shared/schema.ts | 11: category, created_at, date, description, id, image, is_featured, min_price, tags, title, venue_id | existe | solo en código: is_featured |
| `idempotency_keys` | shared/schema.ts | 10: created_at, expires_at, id, key, request_hash, response_body, response_code, scope, status, user_id | no existe | **falta la tabla** |
| `job_locks` | shared/schema.ts | 4: job_name, lock_until, locked_at, locked_by | no existe | **falta la tabla** |
| `order_events` | shared/schema.ts | 9: actor_id, actor_type, created_at, event_type, from_status, id, metadata, order_id, to_status | no existe | **falta la tabla** |
| `orders` | shared/schema.ts | 13: created_at, expires_at, fee_rate_used, fees, id, payment_method, payment_reference, phone, status, ticket_id, ticket_price, total_amount, user_id | existe | — |
| `otp_codes` | shared/schema.ts | 6: code, created_at, expires_at, id, phone, verified | existe | solo en código: verified; solo en remoto: used |
| `payment_reminders` | shared/schema.ts | 5: created_at, hours_after, id, order_id, sent_at | no existe | **falta la tabla** |
| `push_subscriptions` | ensurePushTable() (al arrancar) | 7: id, user_id, endpoint, p256dh, auth, role, created_at | no existe | **falta la tabla** |
| `resale_listings` | shared/schema.ts | 11: buyer_user_id, created_at, event_id, expires_at, id, listing_price, original_price, owner_user_id, sold_at, status, ticket_id | no existe | **falta la tabla** |
| `risk_events` | shared/schema.ts | 12: created_at, event_type, id, ip_hash, locale, metadata, reason_codes, risk_score, session_hash, timezone, user_agent, user_id | no existe | **falta la tabla** |
| `risk_profiles` | shared/schema.ts | 14: created_at, current_risk_score, expired_reservations, failed_otp_attempts, id, ip_hashes, last_activity_at, phone, risk_level, session_hash, total_orders, total_otp_attempts, updated_at, user_id | no existe | **falta la tabla** |
| `session` | connect-pg-simple (al arrancar) | 3: sid, sess, expire | no existe | **falta la tabla** |
| `ticket_pass_uses` | shared/schema.ts | 7: id, metadata, pass_id, scan_location, scan_result, scanned_at, scanned_by | no existe | **falta la tabla** |
| `ticket_passes` | shared/schema.ts | 10: id, issued_at, order_id, qr_secret, revoked_at, rotation_counter, status, ticket_id, used_at, user_id | no existe | **falta la tabla** |
| `tickets` | shared/schema.ts | 9: created_at, event_id, id, price, row, seat, seller_id, status, zone_id | existe | — |
| `users` | shared/schema.ts | 7: created_at, email, first_name, id, last_name, password, role | existe | — |
| `venues` | shared/schema.ts | 7: address, capacity, city, id, image, map_data, name | existe | — |
| `zones` | shared/schema.ts | 5: base_price, color, event_id, id, name | existe | — |

Resumen: 24 tablas necesarias (22 de `shared/schema.ts` + `session` + `push_subscriptions`); en remoto existen 8; 16 faltan; 2 diferencias de columna (`otp_codes.used`→`verified`, `events.is_featured`).

Corrección propuesta (no aplicada): `supabase/proposals/reventicket/isolation/` — mover a esquema propio, renombrar `used`→`verified`, añadir `is_featured`, alinear nombres de restricciones únicas y crear el resto con `drizzle-kit push` **solo** con `schemaFilter: ["reventicket"]` (o, mejor, con migraciones generadas y revisadas).
