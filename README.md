# Dealership CRM V2

Purpose-built dealership CRM for multi-brand / multi-dealership operations.
Source of truth: the master specification (see `docs/`).

## Stack

- **Backend:** Node.js + TypeScript + Fastify
- **Database:** PostgreSQL (Prisma ORM)
- **Frontend:** React + TypeScript + Vite
- **Auth:** session cookie (httpOnly)

## Deployment

Full production guide (env vars, build order, PostgreSQL, nginx/systemd,
Cloudflare Tunnel, Docker, PaaS, backups, checklist, troubleshooting):

**→ [`docs/DEPLOY.md`](docs/DEPLOY.md)**

Docker one-liner (see `Dockerfile`):
```bash
docker build -t crm .
docker run -d --name crm -p 3000:3000 --env-file server/.env crm
```

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

### 4. Public / remote access (Cloudflare quick tunnel)

To expose the (already built) server publicly — useful for testing from a phone
or another machine — use the tunnel launcher. It starts the server and a
Cloudflare quick tunnel, keeps both alive, and prints the public URL:

```bash
./tunnel.sh          # starts server + tunnel, prints https://<name>.trycloudflare.com
```

The quick-tunnel URL is **random and changes on every restart**. After it
changes you MUST update `CORS_ORIGINS` in `server/.env` to the new host and
restart, otherwise browser logins fail with `403 CSRF_ORIGIN_REJECTED`
(the same applies if you only run `cloudflared` by hand). A named tunnel avoids
this — see `docs/AUDIT-2026-09-26.md` (L4). The launcher writes the current host
to `/tmp/cf_crm_url.txt`.

## Tests

**Unit tests** cover the pure logic: the finance engine, the shared date-range
helper, data scoping, phone normalisation, Meta webhook signature verification,
CSV formula-injection guard and the login throttle.

```bash
cd server
npm test                  # tsx --test tests/*.test.ts  (57 tests)
```

**API integration suites** run against a live server (default
`http://localhost:3000`, override with `CRM_BASE`):

```bash
cd server
CRM_BASE=http://localhost:3000 python3 tests/api-deep.py      # RBAC, CRUD, exports (60 checks)
CRM_BASE=http://localhost:3000 python3 tests/acceptance.py    # acceptance criteria (§81)
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
- **Data scoping** (`server/src/auth/scope.ts`): **fail-closed**. The Super Admin is the ONLY
  unrestricted role; every other role is bounded by the dealerships/brands granted to it, and
  a scoped user with **no** grants sees **nothing** (not the whole network). This applies to all
  read *and* write routes.
- **Cost fields** (purchase cost, margin, service parts cost) are gated by `costs.view` and are
  never serialized to roles lacking it (§46, §73).
- **Login throttling**: two independent in-memory limits — per `ip|email` (repeated failures
  against one account: `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MINUTES`) and per `ip`
  (anti credential-stuffing across many accounts: `LOGIN_MAX_ATTEMPTS_PER_IP`).
- **Lead follow-up rule (§14)**: a `NO_ANSWER` / `CLIENT_BUSY` result must carry a follow-up
  date — enforced on the backend (`FOLLOW_UP_REQUIRED`), not just hidden in the UI.
- **Customer dedup race-safety**: concurrent ingests for the same phone are handled via the
  `LeadPhone.phone` unique constraint (`P2002` caught and re-read).
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
- [x] **Security audit pass (docs/AUDIT-2026-09-26.md)**: closed all data-scoping leaks
      (inventory summary/detail, sales mutations, bonuses, expense/KPI edits, finance
      dashboard & reports, AfterSales writes); **scope model switched to fail-closed**
      (only Super Admin unrestricted — a 0-grant account can no longer see the whole
      network; seed self-heals access on re-run); per-IP login throttle (anti
      credential-stuffing); `NO_ANSWER`/`CLIENT_BUSY` follow-up enforced server-side;
      race-safe customer creation; notification pool gated by `leads.take`;
      `start.sh` forces dev mode despite a prod `.env`; i18n dead keys removed.
      Unit tests: **57** (`npm test`).
