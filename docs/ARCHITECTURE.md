# Arquitectura de StudIA

## Componentes

```mermaid
flowchart LR
  subgraph Cliente["App Expo (iOS · Android · Web)"]
    OB[Onboarding 10 pasos<br/>borrador local]:::c
    AU[Auth PKCE]:::c
    UI[Planes · Tutor · Simulacro<br/>Materiales · Familia · Perfil]:::c
  end
  subgraph Supabase
    GA[Auth]:::s
    PG[(Postgres + RLS<br/>funciones SECURITY DEFINER)]:::s
    ST[(Storage privado<br/>study-materials)]:::s
    EF1[Edge: tutor]:::e
    EF2[Edge: process-materials]:::e
    EF3[Edge: delete-account]:::e
    EF4[Edge: health]:::e
  end
  AI[(Proveedor IA)]:::x
  CRON[Scheduler<br/>pg_cron/externo]:::x
  OB -->|al iniciar sesión: save_onboarding| PG
  AU --> GA
  UI -->|anon key + JWT| PG
  UI -->|upload a ruta pre-registrada| ST
  UI --> EF1 & EF3
  EF1 -->|consume_ai_quota / record_ai_usage| PG
  EF1 --> AI
  CRON -->|WORKER_SECRET| EF2
  EF2 -->|claim_material_job SKIP LOCKED| PG
  EF2 --> ST
  EF2 -->|OCR/transcripción| AI
  classDef c fill:#1b1b2e,stroke:#8b80ff,color:#fff
  classDef s fill:#10261f,stroke:#48e0b1,color:#fff
  classDef e fill:#2a2140,stroke:#b8a7ff,color:#fff
  classDef x fill:#2b2b2b,stroke:#999,color:#fff
```

## Flujos críticos

**Primer uso y protección de menores**

```mermaid
sequenceDiagram
  participant E as Estudiante/Adulto
  participant App
  participant DB as Postgres
  E->>App: 10 pasos (rol, voz, edad, ..., apuntes)
  App->>App: borrador en el dispositivo (edad exacta nunca sale)
  alt menor de 18
    App->>E: "Continuar con un adulto"
  end
  E->>App: Registro de ADULTO (+ declaración 18+, aviso de privacidad vN)
  App->>DB: signUp → trigger handle_new_user rechaza sin declaración/aviso
  E->>App: Confirma correo → /auth/callback (PKCE)
  alt adulto
    App->>DB: save_onboarding(answers) [ageBand=18_plus]
  else menor
    App->>DB: create_student_profile(..., consent=true) — registra consentimiento atómicamente
    App->>DB: save_onboarding(answers, student_id) — rechazado si no hay perfil con consentimiento vigente
  end
```

**Material → tutor**: `register_material` (servidor genera `uid/uuid.ext`, valida MIME/tamaño/cuotas) → upload (política de Storage solo acepta rutas pre-registradas `pending_upload`) → `mark_material_uploaded` (verifica metadata real del objeto) → cola `material_jobs` → worker con reintentos y backoff → `ready` → el tutor lo recibe envuelto en `<material>` como dato no confiable.

**Tutor**: JWT → validación de mensajes → filtros de crisis/bloqueo (sin coste) → `consume_ai_quota` atómico por plan + tope global diario → redacción de datos personales → proveedor con timeout y 1 reintento → redacción de salida → `record_ai_usage` (coste estimado, alerta una vez al día). Logs sin contenido.

**Simulacro**: `start_quiz` entrega preguntas sin clave → `submit_quiz` califica en SQL (determinista, una sola vez) → `my_subject_progress` y `family_report` agregan solo intentos reales. Las preguntas `demo` se etiquetan en UI y resultados.

## Principios aplicados

- Denegar por defecto: RLS en todas las tablas, `REVOKE` explícito a `anon`/`authenticated` (Supabase otorga privilegios por defecto) y permisos por columna.
- Escrituras privilegiadas solo mediante funciones `SECURITY DEFINER` con `search_path=''` que revalidan al llamante.
- Ninguna clave privada en el cliente; `service_role` solo en Edge Functions.
- CORS por lista blanca (`APP_ALLOWED_ORIGINS`), CSP estricta en web.
- Mínimos datos: alias en vez de nombre, banda de edad en vez de edad, sin texto de conversaciones en BD ni logs.
- Catálogo curricular con `content_status` y fuente obligatoria para contenido `validated`.

## Decisiones pendientes (requieren a negocio/legal)

- Proveedor y modelo de IA definitivos, región y contrato de tratamiento de datos (DPA).
- Canal de pagos (Apple/Google IAP vs. web) — no implementado a propósito.
- Verificación de identidad del tutor legal (más allá de la declaración en app).
- Códigos de escuela/docente (“Unirme a una preparación”) — visible como “Próximamente”.
- Notificaciones push — no implementadas; requieren consentimiento específico.
