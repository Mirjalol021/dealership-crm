# Dealership CRM V2 — Architecture & Conventions

This document is the engineering reference for the codebase. The product
specification lives alongside it; this file explains how the code is organized
and the rules every change must follow.

## 1. Repository layout

```
.
├── client/                 # React + TypeScript + Vite SPA
│   └── src/
│       ├── api/            # fetch wrapper (cookie auth, 401 handling)
│       ├── components/     # shared UI (Layout, modals, ProtectedRoute)
│       ├── lib/            # auth context, types, navigation map
│       ├── locales/        # uz / ru / en translations
│       └── pages/          # one component per route
├── server/                 # Fastify + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma   # data model (single source of truth for the DB)
│   │   ├── migrations/     # phase-by-phase migrations
│   │   └── seed.ts         # brands, dealership, demo users
│   └── src/
│       ├── auth/           # guard, permissions, scope, session, throttle
│       ├── lib/            # domain helpers (finance, phone, lead ingest, ...)
│       └── routes/         # one file per resource/domain
└── docs/                   # this reference + product spec
```

## 2. Backend conventions

- **Routes** live in `src/routes/*.routes.ts` and are registered in `src/index.ts`.
- **Every route** must declare a `preHandler`:
  - `requireAuth` — logged in.
  - `requirePermission(cap)` — logged in **and** role has the capability.
  - `requireAnyPermission([cap...])` — logged in and has at least one capability.
- **Validation** uses Zod (`safeParse`) and returns `400 INVALID_INPUT` on failure.
- **Data scoping** — every query that reads/writes dealership- or brand-owned data
  must apply `scopeWhere(user)` (reads) or `canAccessScope(user, record)` (writes).
  See `src/auth/scope.ts`. Super Admin is always unrestricted.
- **Cost fields** (purchase cost, margin, service parts cost) are gated by
  `costs.view` and must never be serialized to roles lacking it.
- **Transactions** wrap multi-step writes. Competitive actions (taking a lead,
  reserving/selling a vehicle) use conditional `updateMany` guards so two users
  cannot claim the same record at once.
- **Errors**: throw for domain conflicts (e.g. `VEHICLE_ALREADY_SOLD`) and let
  `src/lib/errorHandler.ts` map them to HTTP codes. Never leak stacks to clients.

## 3. Permission model

Roles and their capabilities are defined once in `src/auth/permissions.ts`
(`ROLE_CAPABILITIES`). The frontend receives a `capabilities` array on login/`me`
and uses `useAuth().can(...)` only to hide UI. The backend is the authority.

Cost-hidden roles (`COST_HIDDEN_ROLES`) must never receive cost/finance fields.

## 4. Frontend conventions

- **Auth state** lives in `lib/auth.tsx`. A global 401 handler resets the user so
  `ProtectedRoute` redirects to `/login`.
- **Navigation** is data-driven in `lib/navigation.ts` (`ROLE_NAV`), filtered by
  capability per item.
- **i18n** keys are kept in sync across `locales/{uz,ru,en}.json`. New UI strings
  must be added to all three.

## 5. Environment variables

See `server/.env.example`. Key ones: `DATABASE_URL`, `SESSION_SECRET` (>= 32 chars
in prod), `SESSION_TTL_HOURS`, `CORS_ORIGINS`, `LOGIN_MAX_ATTEMPTS`,
`LOGIN_WINDOW_MINUTES`, `DEFAULT_LANGUAGE`.

## 6. Migrations

Schema changes go through Prisma migrations:

```bash
cd server
npx prisma migrate dev --name <change>
```

Migrations are committed. `prisma migrate deploy` is used in production.
