# StudIA — Informe de auditoría, implementación y validación

Fecha: 2026-10-28 · Rama: `claude/studia-audit-implementation-deploy-jt3wi9` · Base: `EstudIA_LiquidGlass_Rebuild.zip` (renombrado a **StudIA**).

## 1. Resumen ejecutivo

El paquete original era un prototipo de UI: no compilaba (16 errores de TypeScript), el lint no arrancaba, tenía 1 prueba trivial, usaba Expo SDK 52 (6 versiones atrás) y su esquema tenía fallas de aislamiento entre usuarios y un límite de IA que nunca se aplicaba. Se reemplazó el código anterior de *reventicket* en esta rama por StudIA y se llevó a un estado **desplegable en staging** con evidencia:

- Actualización a Expo SDK 58 / RN 0.88 / React 19.3 / TypeScript 6 (resuelto con `expo install`; `expo install --check` limpio).
- Esquema Supabase reescrito en 3 migraciones versionadas con RLS denegando por defecto, funciones `SECURITY DEFINER` revalidadas, consentimiento parental en servidor, banco de preguntas sin clave expuesta, calificación determinista, cuotas de IA atómicas, cola asíncrona de materiales, exportación y borrado.
- 4 Edge Functions (tutor, process-materials, delete-account, health) con CORS por lista blanca, timeout/reintento, filtros de seguridad infantil, redacción de datos personales y alertas de gasto.
- App completa: onboarding de 10 pasos accesible, auth (registro, confirmación PKCE, recuperación, cierre), planes CRUD + planificador, tutor, simulacro, materiales privados, familia, progreso real, perfil (exportar/eliminar), admin mínimo, estados vacíos/carga/error/offline.
- Calidad: 54 pruebas unitarias, 78 aserciones SQL de seguridad sobre Postgres real, prueba de rollback, pgbench, 7 escenarios E2E Playwright sobre el build de producción con la CSP real, CI de GitHub Actions.

**Bloqueado:** la creación del proyecto Supabase de staging fue denegada por el control de permisos de esta sesión; por eso no hay despliegue remoto, URL de staging ni builds móviles.

## 2. Hallazgos de la auditoría inicial (código original)

| # | Severidad | Hallazgo | Estado |
| --- | --- | --- | --- |
| A1 | Alta | `ai_usage` sin política INSERT; el tutor insertaba con el JWT del usuario → RLS lo rechazaba en silencio → el límite de 30/h **nunca** se aplicaba. Además el conteo no era atómico. | Corregido: `consume_ai_quota` atómico (probado: 148 356 llamadas concurrentes = 148 356 incrementos). |
| A2 | Alta | `study_sessions` permitía insertar sesiones con `plan_id` de otro usuario. | Corregido (`owns_plan`) + test. |
| A3 | Alta | `study_plans`/`materials` aceptaban `student_id` de otra familia. | Corregido (`owns_student` con consentimiento vigente) + tests. |
| A4 | Alta | Consentimiento parental = booleano enviado por el cliente. | Corregido: `create_student_profile` registra consentimiento atómico; INSERT directo revocado. |
| A5 | Alta | Respuestas correctas del simulacro en el cliente. | Corregido: `start_quiz`/`submit_quiz` en servidor; tabla sin acceso. |
| A6 | Media | Política `profile insert own` permitía fijar `role` arbitrario (p. ej. `admin`). | Corregido: sin INSERT de cliente; `is_admin` y `plan` solo servidor; UPDATE por columna. |
| A7 | Media | Privilegios por defecto de Supabase: funciones ejecutables por `anon`. | Corregido: `REVOKE ... FROM public, anon` explícitos + tests con `anon`. |
| A8 | Media | Subidas: cualquier nombre de archivo en la carpeta propia, sin verificación de tipo real. | Corregido: ruta aleatoria generada en servidor, upload solo a ruta pre-registrada, verificación de metadata. |
| A9 | Media | CORS `*` por defecto; el tutor registraba cuerpos de error del proveedor (posible contenido de menores). | Corregido: lista blanca; logs sin contenido. |
| A10 | Media | Onboarding con cifra falsa “17,243,000 YA SE UNIERON” y fechas fijas (“28 octubre”). | Corregido: sin cifras; fechas dinámicas (tests). |
| A11 | Media | Accesibilidad: sin etiquetas/estados; en web `accessibilityState` no se expone (detectado por E2E). | Corregido con `aria-*`; verificado por E2E. |
| A12 | Baja | `Alert.alert` (no-op en web), `router.replace` durante render, `emailRedirectTo` incorrecto. | Corregido: avisos en línea, callback PKCE. |
| A13 | Baja | TS: `fontWeight '750'` inválido; funciones Deno dentro de `tsc`; ESLint con import inexistente. | Corregido. |

## 3. Arquitectura final

Ver `docs/ARCHITECTURE.md` (diagramas de componentes y secuencias de primer uso/menores, material→tutor, tutor y simulacro).

## 4. Archivos creados/modificados

- Eliminado en esta rama: todo el código de *reventicket* (cliente/servidor/Drizzle/Replit). `main` no se tocó.
- Config: `package.json`, `package-lock.json`, `app.json`, `eas.json`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `.env.example`, `.gitignore`, `vercel.json`, `.github/workflows/ci.yml`.
- App: `app/_layout.tsx`, `index`, `onboarding`, `login`, `register`, `forgot-password`, `reset-password`, `auth/callback`, `privacy`, `(tabs)/{_layout,index,study,progress,profile}`, `plan/{new,[id]}`, `tutor`, `exam`, `materials`, `family`, `admin`.
- Componentes: `components/{Button,Choice,Field,Glass,Screen,States}.tsx`.
- Lógica: `lib/{api,auth,catalog,config,dates,draft,errors,network,onboarding,supabase,theme,uploads,useAsync,validation,voice}.ts(x)` + tests.
- Supabase: `migrations/20261028000001_identity_family.sql`, `…02_learning.sql`, `…03_materials_ai_admin.sql`; `functions/{tutor,process-materials,delete-account,health}/index.ts`, `functions/_shared/{ai,http,safety,deno-env}.ts` + tests, `functions/deno.json`, `config.toml`; `tests/{supabase_stub.sql,security.test.sql,run-local.sh,perf.sh,rollback.test.sh}`; `rollback/20261028_staging_down.sql`.
- Calidad: `e2e/onboarding.e2e.mjs`, `evals/{tutor-cases.v1.json,tutor-layer.test.ts,run-model-evals.mjs}`, `scripts/audit-gate.mjs`, `docs/security/audit-allowlist.json`.
- Docs: `README.md`, `docs/{ARCHITECTURE,DEPLOYMENT,LIQUID_GLASS_ONBOARDING,RELEASE_CHECKLIST,AUDIT_REPORT}.md`.

## 5. Variables necesarias

Lista completa (solo nombres y propósito) en `docs/DEPLOYMENT.md` §1 y `.env.example`. Ningún valor secreto se incluyó en el repositorio.

## 6. Migraciones aplicadas

| Migración | Local (Postgres 16 + stub Supabase) | Staging | Producción |
| --- | --- | --- | --- |
| `20261028000001_identity_family` | Aplicada y probada | **BLOCKED** (sin proyecto) | NOT RUN (requiere autorización) |
| `20261028000002_learning` | Aplicada y probada | **BLOCKED** | NOT RUN |
| `20261028000003_materials_ai_admin` | Aplicada y probada | **BLOCKED** | NOT RUN |

El stub reproduce roles, privilegios por defecto, `auth.uid()` y Storage; diferencias con Supabase real (p. ej. triggers internos de Storage) deben confirmarse en staging con `get_advisors`.

## 7. Comandos y pruebas

Entorno: contenedor Linux x86_64, 4 vCPU, 15 GB RAM, Node 22.22, Postgres 16, Chromium (Playwright 1.63), Deno 2.9.

| Comando / prueba | Resultado | Evidencia |
| --- | --- | --- |
| `npm install` (SDK 52 original) | PASS | 1305 paquetes |
| `npm run typecheck` (original) | **FAIL** | 16 errores (base de la auditoría) |
| `npm run lint` (original) | **FAIL** | `Cannot find module 'eslint-config-expo/flat'` |
| `npm ci` (SDK 58) | PASS | 1316 paquetes |
| `npx expo install --check` | PASS | “Dependencies are up to date” |
| `npm run typecheck` | PASS | exit 0 |
| `npm run lint` (`--max-warnings 0`) | PASS | exit 0 (se corrigieron 2 hallazgos reales de hooks; ninguna regla desactivada) |
| `npm test` | PASS | 8 suites, 54 tests |
| `npm run test:sql` | PASS | 78 aserciones de RLS/seguridad |
| `npm run test:rollback` | PASS | 17 tablas → 0 → re-aplicación OK |
| `npm run test:perf` | PASS | Lectura RLS (40k planes/320k sesiones, 16 clientes): ~3 000 TPS, 5.3 ms prom.; cuota atómica (32 clientes, 50 usuarios calientes): ~7 400 TPS, 4.3 ms, 0 fallos, 0 actualizaciones perdidas |
| `deno check */index.ts` + `deno lint` | PASS | 8 archivos |
| `npm run audit:gate` | PASS (con riesgo aceptado) | 1 advisory alto (zod 3 en `@expo/cli`), aceptado hasta 2027-01-31 |
| `npm run build:web` | PASS | `dist/` 6.2 MB |
| `npm run test:e2e` (Playwright, CSP de producción) | PASS | 7/7: 10 pasos teléfono/escritorio, menor vs adulto, ida/vuelta, búsqueda, borrador persistente, teclado, a11y + 320 px al 200 %, guardia de rutas |
| `npm run eval:model` | **BLOCKED** | Requiere tutor desplegado y cuenta de prueba |
| Despliegue Supabase staging | **BLOCKED** | Creación de proyecto denegada por el control de permisos de la sesión |
| Builds EAS iOS/Android | **BLOCKED** | Sin cuenta Expo/EAS, Apple Developer ni Google Play en este entorno |
| Simuladores/dispositivos iOS/Android | **BLOCKED** | Contenedor Linux sin Xcode/emulador |
| GitHub Actions CI | NOT RUN | Se ejecutará al abrir PR/push a `main` |
| Pruebas de restauración de backup | NOT RUN | Requiere plan Pro de Supabase |

## 8. URL de staging y artefactos

- URL de staging: **ninguna** (no se desplegó).
- Builds iOS/Android: **no existen**.
- Vercel: existe el proyecto `reventicket` vinculado al repo; un push a esta rama puede generar un despliegue **preview** (no producción). Sin variables `EXPO_PUBLIC_*` de staging solo funcionará el onboarding.

## 9. Riesgos, vulnerabilidades y deuda

- **Legal/menores (bloqueante de producción):** el consentimiento es una declaración en app, sin verificación de identidad; aviso de privacidad en borrador.
- **IA:** heurísticas de seguridad en español con falsos positivos/negativos posibles; sin moderación de un proveedor dedicado; casos de modelo sin evaluar.
- **Contenido:** solo 8 preguntas demo; ningún contenido curricular validado.
- **Dependencias:** zod 3 (GHSA-mrhx-c7xc-m3w5) en tooling de Expo, aceptado con caducidad.
- **Limitación de tasa:** solo diaria por plan + tope global; falta límite por minuto (ráfagas) y protección anti-abuso en signup (CAPTCHA de Supabase).
- **Operación:** sin monitoreo externo de `/health`, sin SMTP propio, sin backups (plan Free).
- **Funcional pendiente:** códigos de escuela, pagos, notificaciones, previsualización de voz con voces propias (hoy TTS del dispositivo), OCR solo vía proveedor IA (`anthropic` para PDF).
- **Huérfanos de Storage:** si falla el borrado de la fila después de borrar el objeto (o viceversa) puede quedar basura; falta job de limpieza.
- `typedRoutes` desactivado para builds reproducibles en CI.

## 10. Costos estimados (verificar precios vigentes)

| Concepto | Supuesto | Costo |
| --- | --- | --- |
| Supabase | Free para staging; Pro para producción (backups, sin pausa) | US$0 / ~US$25 mes |
| Web | Vercel Hobby es no comercial → Pro | ~US$20 por miembro/mes |
| Tiendas | Apple Developer / Google Play | US$99/año · US$25 único |
| EAS | Plan gratuito con builds limitados; pago si se necesita más | US$0–US$99/mes |
| IA tutor | 1 000 estudiantes activos × 5 preguntas/día × (1 500 tokens entrada + 500 salida), precios del modelo elegido `Pin`/`Pout` US$/MTok | mensual ≈ 150 000 × (1.5k·Pin + 0.5k·Pout)/1e6. Ej. con Pin=1, Pout=5: ≈ US$600/mes. El tope `AI_DAILY_BUDGET_USD` limita el máximo. |
| OCR | Por página, según modelo; topado por cuota de 40 subidas/día/usuario | variable |

## 11. Pasos que requieren autorización humana

- [ ] Autorizar la creación del proyecto Supabase **studia** (staging) en la organización gratuita (MelatePro intacto) — o indicar otro proyecto.
- [ ] Aplicar migraciones y desplegar Edge Functions en staging; cargar secretos.
- [ ] Elegir proveedor/modelo de IA y firmar su DPA; definir `AI_DAILY_BUDGET_USD`.
- [ ] Renombrar el repositorio GitHub `reventicket` → `studia` (Settings → General; no hay herramienta para hacerlo desde aquí).
- [ ] Decidir si el proyecto Vercel `reventicket` se reutiliza/renombra para StudIA o se crea uno nuevo.
- [ ] Revisión legal (aviso, consentimiento, ARCO, transferencias) y canal de soporte.
- [ ] Cuentas Expo/EAS, Apple Developer y Google Play; builds internos.
- [ ] Revisión docente del contenido; ejecución y revisión de `eval:model`.
- [ ] Plan Pro + prueba de restauración; MFA de administradores; monitoreo.
- [ ] Merge a `main` y cualquier despliegue de producción.

## 12. Veredicto

**`BLOCKED`** para despliegue verificado, por falta de un proyecto Supabase de staging autorizado (y cuentas EAS/tiendas). El código está **listo para staging**: todas las verificaciones locales pasan con evidencia. **No** está listo para producción: faltan revisión legal del consentimiento de menores, contenido curricular validado, evaluación del modelo, backups/restauración, pagos y pruebas en dispositivos reales.
