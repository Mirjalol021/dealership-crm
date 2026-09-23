# Dealership CRM V2

Simple, purpose-built dealership CRM. Source of truth: the master specification
(see `docs/`).

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

## Default dev credentials

- Super Admin: `admin@crm.local` / `admin12345`
- (test) Sales Manager: `manager@crm.local` / `manager123`

> Change these before any real use.

## Build status

- [x] **Phase 1 — Foundation**
  - [x] M1 — project scaffold, PostgreSQL, Prisma schema, Docker deferred
  - [x] M2 — auth (session login/logout/me)
  - [x] M3 — users + roles
  - [x] M4 — brands CRUD
  - [x] M5 — dealerships CRUD + brand links
  - [x] M6 — user↔dealership / user↔brand access
  - [x] M7 — backend permission middleware
  - [ ] M8 — i18n scaffolding (UZ/RU/EN)
  - [ ] M9 — navigation shell + role-based routing
- [ ] Phase 2 — Leads
- [ ] Phase 3 — Inventory + Sales
- [ ] Phase 4 — Finance
- [ ] Phase 5 — AfterSales
- [ ] Phase 6 — Integrations + Reports
