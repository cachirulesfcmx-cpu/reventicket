# Checklist obligatorio antes de producción

Leyenda: `[x]` hecho con evidencia en repo · `[~]` implementado técnicamente, falta validación humana/externa · `[ ]` pendiente.

## Producto y currículo
- [ ] Revisar con docentes contenidos por nivel, materia y subsistema.
- [~] Documentar fuentes, licencias y versiones curriculares (esquema `curriculum_sources` + `content_status`; sin contenido validado aún).
- [~] Conjunto de evaluación versionado del tutor (`evals/tutor-cases.v1.json`); capa determinista en CI; casos de modelo pendientes de ejecutar en staging y revisar.
- [x] El simulador marca contenido de demostración y nunca lo presenta como oficial.
- [~] OCR/PDF asíncrono, exportación y eliminación de materiales (código y tests SQL; sin ejecución real contra proveedor IA).

## Privacidad y menores
- [ ] Revisión legal mexicana (LFPDPPP) del aviso, consentimiento, ARCO y transferencias internacionales.
- [~] Autorización parental por edad: cuentas solo de adultos, perfiles de menores con consentimiento atómico y revocable, salvaguardas en servidor. Falta verificación de identidad y aprobación legal.
- [ ] Verificar tratamiento y retención de datos con el proveedor de IA (DPA, zero-retention si existe).
- [x] Exportación (JSON) y borrado de cuenta/datos (Edge Function `delete-account`, cascadas probadas).
- [ ] Validar controles de tienda para apps dirigidas a menores (Kids Category / Families Policy).
- [ ] Definir canal de reportes y protocolo de incidentes.

## Seguridad
- [x] Políticas RLS revisadas y probadas entre dos usuarios (`supabase/tests/security.test.sql`).
- [x] Claves secretas nunca en el cliente (solo `EXPO_PUBLIC_*` publicables).
- [x] CORS por lista blanca (`APP_ALLOWED_ORIGINS`) y CSP estricta en web.
- [x] Rate limiting atómico con cuotas por plan y tope global (probado bajo concurrencia).
- [x] Almacenamiento privado, rutas aleatorias generadas en servidor, URLs firmadas de 5 min, validación de tipo y tamaño en cliente, SQL y bucket.
- [~] Dependencias auditadas (gate en CI con aceptación de riesgo documentada); falta SAST/DAST externo y pentest.
- [ ] MFA para administradores, backups y prueba de restauración (requiere plan Pro).
- [~] Alertas de gasto IA (umbral + webhook); faltan alertas de errores/disponibilidad (p. ej. monitor externo sobre `/health`).

## Pagos y operación
- [ ] Elegir pasarela y validar políticas de Apple/Google (no implementado a propósito).
- [ ] Webhooks firmados, idempotencia, cancelaciones, reembolsos, conciliación.
- [~] Correo de confirmación y recuperación (flujo implementado; configurar SMTP propio en Supabase).
- [ ] SLA interno, guardias, playbooks.
- [x] Proceso de rollback documentado y probado para staging.

## Tiendas
- [ ] Registrar bundle ID/package definitivos (`mx.studia.app` provisional) y firma.
- [ ] Capturas, descripción, clasificación por edades y URL de privacidad.
- [ ] Pruebas en dispositivos físicos.
- [ ] TestFlight y Google Play Internal Testing.
- [ ] Resolver rechazos y bugs críticos.
