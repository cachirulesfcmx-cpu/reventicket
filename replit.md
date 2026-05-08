# RevenTicket

## Overview

RevenTicket is a ticket marketplace platform for buying and selling event tickets in Mexico. The application supports concerts, sports, theater, family events, and Formula 1 races. Users can browse events, view interactive venue maps with zone-based seating, purchase tickets, and sellers can list tickets for resale. The platform includes a full admin panel for managing events, venues, and orders.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **UI Components**: shadcn/ui component library (New York style) with Radix UI primitives
- **Fonts**: Inter for body text, Oswald for headings (event/ticket aesthetic)
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Pattern**: RESTful JSON API under `/api` prefix
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)
- **Authentication**: Session-based with bcrypt password hashing
- **Role-based Access**: buyer and admin roles with middleware guards

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `db:push` command

### Core Data Models
- **Users**: Authentication, roles (buyer/admin)
- **Venues**: Event locations with capacity and map data
- **Events**: Concerts, sports, theater, F1 with categories and tags
- **Zones**: Seating sections with pricing per event
- **Tickets**: Individual tickets with row/seat, linked to sellers
- **Orders**: Purchase records linking buyers to tickets
- **Config**: System-wide settings

### Key Design Decisions

1. **Shared Schema**: Database schema is defined once in `shared/schema.ts` and used by both frontend (for types) and backend (for queries). This ensures type safety across the stack.

2. **Interactive Venue Maps**: SVG-based maps loaded dynamically based on venue type (arena vs F1 circuit). Maps are stored in `/client/public/maps/`.

3. **Monorepo Structure**: Client code in `/client`, server in `/server`, shared types in `/shared`. Single TypeScript config with path aliases.

4. **Build Process**: Custom build script (`script/build.ts`) bundles server with esbuild and client with Vite. Production serves static files from `dist/public`.

## External Dependencies

### Database
- PostgreSQL (required via `DATABASE_URL` environment variable)
- Connection pooling via `pg` driver

### Authentication & Security
- bcrypt for password hashing
- express-session for session management
- connect-pg-simple for PostgreSQL session store
- Helmet for security headers (CSP, XSS protection, etc.)
- Rate limiting on sensitive endpoints (login, OTP, checkout)
- Atomic purchase transactions to prevent double selling
- WhatsApp QR protected with admin-only access

### Third-Party Services (Potential)
- Stripe integration available in dependencies for payment processing
- Nodemailer for email notifications
- OpenAI/Google Generative AI SDKs present but not actively used

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Session encryption key (required in production)
- `NODE_ENV`: production/development mode
- `WHATSAPP_ENABLED`: Set to "true" to enable WhatsApp bot (default: false/disabled)
- `JOBS_ENABLED`: Set to "true" to enable background jobs for expiration (default: false/disabled)
- `FEE_RATE`: Service fee rate (decimal, e.g., 0.15 for 15%). Range: 0.00-0.50. Default: 0.15

### Enterprise Feature Flags (Feb 2026)
- `RISK_ENGINE_ENABLED`: Set to "true" to enable antifraude invisible (default: false)
- `ANALYTICS_ENABLED`: Set to "true" to enable analytics tracking and dashboard (default: false)
- `WALLET_ENABLED`: Set to "true" to enable QR wallet tickets (default: false)
- `RESALE_ENABLED`: Set to "true" to enable marketplace resale (default: false, NOT IMPLEMENTED)
- `FRAUD_STRICT_MODE`: Risk strictness level - "low", "medium", or "high" (default: low)

### Important: Files NOT to Upload
Never include these folders in the repository or zip files:
- `.wwebjs_auth/` - WhatsApp session data
- `.wwebjs_session/` - WhatsApp session data
- `.local/` - Local Replit state
These are already in `.gitignore`.

### Database Migration
After schema changes, run:
```bash
npm run db:push
```

### Security Endpoints
- `GET /api/csrf`: Get CSRF token for mutations
- `POST /api/auth/login`: Login (CSRF exempt)
- `POST /api/auth/register`: Register (CSRF exempt)
- `POST /api/auth/logout`: Logout (CSRF exempt)
- `POST /api/admin/orders/:id/confirm-payment`: Admin-only payment confirmation

## Recent Changes

### Enterprise Edition V6 (Feb 2026) - Full Platform
- **PWA Instalable**: manifest.json, Service Worker con cache inteligente, banner de instalación
- **Micro-interacciones**: Framer Motion para animaciones suaves en toda la app
- **Skeleton Shimmer**: Loaders con efecto shimmer para mejor UX
- **Pull-to-Refresh**: Gesture nativo para actualizar contenido
- **Offline Indicator**: Banner cuando sin conexión

- **Antifraude Invisible** (RISK_ENGINE_ENABLED):
  - Risk scoring rule-based con reason codes
  - Tablas: risk_events, risk_profiles, bans
  - Acciones automáticas: allow, cooldown, block, step_up
  - Rate limiting escalonado por endpoint/user/session
  - Admin tools: lista high-risk, ban/unban temporal

- **Analytics Pro** (ANALYTICS_ENABLED):
  - Event tracking frontend + backend (view_home, view_event, checkout_start, etc.)
  - Tabla: analytics_events (append-only)
  - Dashboard admin: KPIs, funnel conversión, top eventos
  - Endpoints: /api/enterprise/admin/analytics/*

- **Wallet QR** (WALLET_ENABLED):
  - Boletos con QR dinámico (rotación cada 30s)
  - Tablas: ticket_passes, ticket_pass_uses
  - "Mis Boletos" en /wallet con QR animado
  - Scanner admin en /admin/scanner para validar entradas
  - Anti-screenshot: QR firmado con timestamp

- **Marketplace Futuro** (RESALE_ENABLED - DESACTIVADO):
  - Tabla: resale_listings (base lista)
  - Endpoints retornan "Próximamente" si flag false
  - NO hay payouts ni vendedores activos

### Production Hotfix V5 (Jan 2026) - Enterprise Hardening
- **Antifraude Fees**: Server ALWAYS calculates fees and totalAmount, ignores client values
  - FEE_RATE env var configurable (default 0.15, range 0.00-0.50)
  - Orders now store ticketPrice and feeRateUsed for audit
  - Response includes breakdown: ticketPrice, fees, totalAmount, feeRateUsed
- **Order State Machine**: Valid state transitions enforced (reserved→paid only by admin)
  - States: pending, reserved, awaiting_payment, paid, cancelled, expired, failed, refunded
  - Users can only cancel their own orders (pending/reserved)
  - Admin-only: payment confirmation, refunds
- **Idempotency Keys**: Prevents duplicate orders from double-click/retry
  - Header: `Idempotency-Key` (UUID v4)
  - Table: idempotency_keys with unique constraint on (user_id, scope, key)
  - user_id is required (orders require authentication)
  - Same key with different body returns 409 IDEMPOTENCY_KEY_CONFLICT
- **Order Events (Auditing)**: Event sourcing light for order lifecycle
  - Table: order_events tracks all state changes
  - Events: created, reserved, payment_confirmed, cancelled, expired, etc.
  - GET /api/admin/orders/:id/events - View audit log
  - GET /api/admin/orders/:id/audit - Consistency check with timeline
- **Confirm Payment Idempotent**: Calling 2x returns 200 already_paid (no side effects)
  - Transactional with FOR UPDATE locks
  - Validates ticket state before confirming
- **DB Job Locks**: Prevents duplicate job execution across Replit restarts
  - Table: job_locks with TTL-based locking
  - Instance ID per process for lock ownership
  - Logs: "[JOB-LOCK] Lock acquired/denied" for debugging
- **Frontend Idempotency**: Client manages Idempotency-Key lifecycle
  - Key generated per checkout attempt
  - Key locked during request, cleared on success/error
  - Prevents duplicate orders from UI

### Production Hotfix V4 (Jan 2026)
- **CSRF Global**: All frontend mutations now use centralized apiRequest wrapper with CSRF token
- **CSRF Retry**: Automatic token refresh and retry on 403 CSRF errors
- **Atomic Purchase Enhanced**: POST /api/orders uses transactional reservation with FOR UPDATE SKIP LOCKED
- **Zone-based Atomic Purchase**: New atomicPurchaseByZone() for zone selection without race conditions
- **409 Conflict Response**: Proper HTTP 409 returned when ticket already reserved/sold

### Production Hotfix V3 (Jan 2026)
- **Admin Login Real**: Removed hardcoded credentials, uses backend auth with role verification
- **Atomic Purchase**: Database transactions prevent double-selling (returns 409 on conflict)
- **Anti-Fraud**: Users can only cancel orders (403 for paid/sold status), only admin confirms payment
- **CSRF Protection**: Token-based CSRF for all mutations, auth endpoints exempt
- **Route Guards**: Frontend AdminRoute component protects /admin with session/role check
- **Runtime Flags**: WHATSAPP_ENABLED and JOBS_ENABLED properly control initialization

### Security Hardening (Jan 2026)
- Added Helmet middleware with CSP
- Implemented rate limiting on auth, OTP, and checkout endpoints
- Secured sessions with httpOnly, sameSite, secure cookies
- Added PostgreSQL session store
- Protected WhatsApp QR endpoint (admin only)
- Implemented atomic ticket purchases with database transactions
- Added order expiration system (15 minutes for pending orders)
- Updated .gitignore for sensitive files
- CSRF middleware on all /api mutations

### Admin Endpoints
- GET /api/admin/orders - List all orders
- GET /api/admin/metrics - Get order metrics
- POST /api/admin/orders/:id/cancel - Cancel order
- POST /api/orders/:id/confirm-payment - Confirm payment (admin)

### UX Improvements
- Skeleton loaders for event listings
- Advanced filters (category, city)
- Category chips with active state

### Performance & Scalability (Jan 2026)
- In-memory caching with TTL for events, venues, zones
- HTTP caching with ETags and Cache-Control headers
- Lazy loading for heavy pages (Admin, Checkout, EventDetails)
- API timing metrics with slow query logging

### SEO Improvements
- Dynamic sitemap.xml generation
- Event metadata and JSON-LD structured data endpoints
- SEO-friendly slug generation

### Monetization
- Fee calculation system (service fee, processing fee, insurance)
- Dynamic pricing engine (demand, scarcity, time-based)
- Configurable fee percentages per category

### Anti-Scalping
- Purchase limits per user/session/phone
- Client fingerprinting for risk scoring
- Expired reservation tracking (hold farming detection)
- Headless browser detection

### Recommendations
- Popularity-based recommendations
- Content-based similarity
- Co-visitation tracking
- Cold start handling for new users