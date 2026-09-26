# Dealership CRM V2

Purpose-built dealership CRM for multi-brand / multi-dealership operations.
Source of truth: the master specification (see `docs/`).

## Stack

- **Backend:** Node.js + TypeScript + Fastify
- **Database:** PostgreSQL (Prisma ORM)
- **Frontend:** React + TypeScript + Vite
- **Auth:** session cookie (httpOnly)

## Local setup

### 1. Database

PostgreSQL must be running, with a database and app user:

```bash
sudo systemctl start postgresql
# (already provisioned in dev: user crm_app / db dealership_crm)
```

### 2. Server

```bash
cd server
cp .env.example .env      # adjust DATABASE_URL / SESSION_SECRET
npm install
npx prisma migrate deploy # or: npx prisma migrate dev
npx tsx prisma/seed.ts    # seeds brands, a dealership, and Super Admin
npm run dev               # http://localhost:3000
```

### 3. Client

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

Or start both together from the repo root:

```bash
./start.sh
```

## Tests

Unit tests cover the pure calculation logic (finance engine) and the shared
date-range helper used by reports, analytics and exports.

```bash
cd server
npm test                  # tsx --test tests/*.test.ts
```

## Default dev credentials

- Super Admin: `admin@crm.local` / `admin12345`
- (test) Head of Sales: `head@crm.local` / `head12345`
- (test) Sales Manager: `manager@crm.local` / `manager123`
- (test) Call Center: `callcenter@crm.local` / `call12345`
- (test) Finance: `finance@crm.local` / `finance12345`

> Change these before any real use.

## Security & data-scoping notes

- **Permissions** are enforced on the backend via `requirePermission` / `requireAnyPermission`
  (`server/src/auth/permissions.ts`). Hiding UI is never sufficient.
- **Data scoping** (`server/src/auth/scope.ts`): Super Admin is unrestricted; every other
  role is bounded by the dealerships/brands granted to it. This applies to all read
  and write routes.
- **Login throttling**: repeated failures for an `ip|email` pair are blocked for a window
  (`LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MINUTES`).
- **Meta webhook** payloads are validated with the `X-Hub-Signature-256` HMAC
  (`appSecret` of the matching connector). Unsigned requests are rejected with 401.
- **Production secrets**: the server refuses to boot if `SESSION_SECRET` is still the
  default or shorter than 32 chars while `NODE_ENV=production`.
- Configure `CORS_ORIGINS` (comma-separated) for production; dev allows any origin.

## Exports & filters

- Every list/report exports the **current filtered result** as CSV or XLSX (§65).
  Export buttons live on Reports, Inventory, Sales, My Leads, AfterSales Inventory and
  Expenses. The export endpoint accepts the same shared filter bar params (§68):
  `range` (`today` | `week` | `7d` | `month` | `lastMonth` | `custom`), `from`, `to`,
  `brandId`, `dealershipId` (and `status` / `source` / `month` where relevant).
- The date-range presets ("This Week", "Custom Range") are consistent everywhere via
  the shared `server/src/lib/dateRange.ts` helper.

## Build status

- [x] **Phase 1 — Foundation**: scaffold, PostgreSQL, Prisma, auth (session), users + roles,
      brands & dealerships CRUD, access links, permission middleware, i18n (UZ/RU/EN), nav shell.
- [x] **Phase 2 — Leads**: pool (atomic take), assignment + history, today/Save&Next, pipeline,
      results, follow-ups, comments, attempts, activity, appointments, kanban, management tables.
- [x] **Phase 3 — Inventory + Sales**: vehicle inventory, reservations/zalog, sold cars, manual
      margin, discounts, customer bonuses, VIN distributor bonuses (role-gated costs).
- [x] **Phase 4 — Finance**: expenses (accounting month vs payment date), KPI bonuses, configurable
      VAT, Vehicle Contribution, Profit/Cash Flow views, finance dashboard.
- [x] **Phase 5 — AfterSales**: sold cars DB, customers to call, service visits, inventory,
      stock receipts/usage/adjustments, anti-theft movement report, service contribution.
- [x] **Phase 6 — Integrations + Reports**: Meta/Telegram webhooks, dynamic form answers +
      field mapping, phone/external dedup, bulk import, CSV/XLSX export, report families.
- [x] **Hardening pass**: backend data scoping, Meta HMAC verification, login throttling,
      centralized error handling, atomic reservation/sale, service contribution in finance.
- [x] **Spec-gap pass**: exports now honour the active filters + date range (§32/§65/§68);
      export buttons on all list pages (§65); "This Week" + "Custom Range" presets (§68);
      Sales report gains Pipeline/Result-by-Manager tables + service contribution (§67);
      date-range logic centralised (`dateRange.ts`); i18n coverage completed (no hardcoded
      strings, 452 keys × 3 languages); Call Center routes open in-context (§77);
      finance + date-range unit tests (`npm test`).
