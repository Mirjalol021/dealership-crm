# Dealership CRM — Product Specification (reconstructed reference)

This document captures the product rules the codebase implements. It is a
**reconstruction** assembled from the code, page structure and the `§NN` markers
used throughout the source. Where a rule is enforced, the code location is cited
so the specification and the implementation stay in sync.

> Numbering follows the `§` markers found in the source. Sections are grouped by
> functional domain. Treat this as the single source of truth alongside
> `ARCHITECTURE.md` (engineering conventions).

---

## 1. Roles & access (§5)

Six roles, each with a fixed capability set (`server/src/auth/permissions.ts`):

| Role | Purpose |
|------|---------|
| `SUPER_ADMIN` | Unrestricted; manages settings, users, brands, dealerships. |
| `HEAD_OF_SALES` | Oversees all leads/sales (read-all), assigns leads, reports. |
| `SALES_MANAGER` | Works **own** leads; creates leads, sells, reserves. |
| `CALL_CENTER` | Works the lead pool, qualifies, assigns to managers. |
| `SERVICE_STAFF` | AfterSales: service visits, inventory, sold-cars DB. |
| `FINANCE` | Expenses, KPI bonuses, cost/margin/profit visibility, finance reports. |

**§5.2–§5.5** — Cost/finance data is hidden from `HEAD_OF_SALES`, `SALES_MANAGER`,
`CALL_CENTER`, `SERVICE_STAFF` (`COST_HIDDEN_ROLES`). Purchase cost, margin and
service parts cost are only serialised for roles holding `costs.view`.

## 2. Data scoping (§73)

- Super Admin is unrestricted.
- Every other role is bounded by the dealerships and brands granted to it
  (`UserDealershipAccess`, `UserBrandAccess`).
- Reads use `scopeWhere(user)`; writes use `canAccessScope(user, record)`.
- `SALES_MANAGER` is further narrowed to records assigned to them.

## 3. Leads

### 3.1 Sources & creation (§9)
Sources: `META`, `TELEGRAM`, `INSTAGRAM_ORGANIC`, `TELEGRAM_ORGANIC`, `WALK_IN`,
`PHONE_CALL`, `REFERRAL`, `EXISTING_CUSTOMER`, `MANUAL`, `OTHER`.
Manually created leads are auto-assigned to the creator (`SELF_PICK`); leads
arriving via webhooks enter the **pool** unassigned.

### 3.2 Lead Pool & taking (§7)
- The pool holds unassigned leads (`GET /api/leads/pool`).
- Taking a lead is atomic: only succeeds if still unassigned (else `409 ALREADY_TAKEN`).

### 3.3 Assignment (§7, §22)
Assignable by Super Admin / Head of Sales / Call Center. Each change is recorded
in `LeadAssignment` history (type: `SELF_PICK`, `CALL_CENTER`, `HEAD_OF_SALES`,
`SUPER_ADMIN`, `REASSIGNMENT`) and visible in the lead detail.

### 3.4 Pipeline vs Result (§11, §12)
Pipeline: `NEW`, `WORKING`, `VISIT_PLANNED`, `VISITED_TEST_DRIVE`, `SOLD`, `LOST`.
Result (per contact attempt): `NO_ANSWER`, `CLIENT_BUSY`, `WRONG_NUMBER`,
`INFO_GIVEN_VISIT_EXPECTED`, `INFO_GIVEN_THINKING`, `INTERESTED`, `NOT_INTERESTED`,
`LEFT_INFO_BY_MISTAKE`, `ANOTHER_REGION`, `VISIT_PLANNED`, `TEST_DRIVE_COMPLETED`, `SOLD`.
A result **suggests** a pipeline status but the two are tracked separately.

### 3.5 Save & Next / Today (§14, §16)
- `POST /api/leads/:id/result` records the outcome and returns `nextLeadId` so the
  operator can continue without navigating.
- `GET /api/leads/today` returns actionable counts (`newLeads`, `needFirstCall`,
  `callbacksToday`, `overdue`, `visitExpected`, `visitsPlannedToday`).

### 3.6 Follow-ups & attempts (§17, §20)
- Each contact result auto-creates a numbered `LeadContactAttempt`.
- `nextFollowUpAt` drives call-today / overdue filters.

### 3.7 Detail & activity (§10, §19–§22)
The detail view exposes customer + phones, brand/dealership, assigned user,
comments, attempts (numbered), activity feed, assignment history (with names),
appointments and form answers.

## 4. Appointments (§24)
A `VISIT_PLANNED` result with an appointment date auto-creates an `Appointment`
(status `PLANNED` → `ARRIVED` / `NO_SHOW`).

## 5. Inventory (§28–§31)
- Vehicles: `VIN` (unique), brand, dealership, model/trim/color, prices.
- Status lifecycle: `AVAILABLE` → `RESERVED` → `SOLD`.
- Cost fields (`purchaseCost`) are cost-gated.

## 6. Reservations / Zalog (§31)
- Reserving flips a vehicle `AVAILABLE` → `RESERVED` atomically (conditional update).
- Deposit (`depositAmount`) + payment method recorded; cancellable.

## 7. Sales (§33–§37)
- A sale flips the vehicle to `SOLD` atomically; a VIN already sold is rejected.
- Fields: sale price, payment type (`CASH`/`CREDIT`/`OTHER`), manual margin,
  discounts, finance product text.
- **Margin** and all cost fields are only serialised for `costs.view` roles.
- Customer & VIN distributor bonuses attach to a sale.

## 8. Finance

### 8.1 Expenses (§38)
Keyed by **accounting month** (`YYYY-MM`) separate from the payment date.
Type `FIXED` / `VARIABLE`; status `PENDING` / `PAID`.

### 8.2 VAT (§40)
Configurable tax rate + VAT-inclusive/exclusive convention
(`FinanceSettings`). `vatProvision`, `marginAfterVat`.

### 8.3 Vehicle Contribution (§41)
`margin + confirmed VIN bonus − customer bonuses − VAT`.

### 8.4 Service Contribution (§52)
`service revenue − parts cost`.

### 8.5 Monthly Net Result (§55)
`vehicle contribution + confirmed KPI bonus + service contribution − fixed − variable`.
Expected (unconfirmed) bonuses are excluded.

### 8.6 Finance dashboard
Profit / Cash-flow views with 16 cards (turnover, margins, contributions, VAT,
expenses, net result) over a selectable range.

## 9. AfterSales (§42, §48–§54)
- Sold-cars database (purchase date, mileage, service dates).
- Customers-to-call buckets by due service.
- Service visits: work performed, revenue, parts usage (deducts stock).
- Inventory: items with receipts / usage / adjustments; stock movements report
  (opening + received − used ± adjustments = closing).
- Service contribution flows into finance.

## 10. Integrations (§56–§63)
- **Meta** webhooks validated via `X-Hub-Signature-256` HMAC; unsigned → 401.
- **Telegram** webhook keyed by secret.
- Dynamic lead-form answers + field mapping; phone/external-reference dedup;
  customer dedup via normalised phone (`+998XXXXXXXXX`).

## 11. Import / Export (§64–§66)
- Bulk import: upload → preview (validate + duplicate check) → confirm; only valid
  rows import. Types: `leads`, `inventory`, `customers`, `sold_cars`, `aftersales_stock`.
- Max 5000 rows per import (`413 TOO_MANY_ROWS` beyond that).
- Exports (CSV/XLSX) reflect the **current filtered** result and are gated by the
  same capability as viewing that data (see `EXPORT_CAPABILITY`).
- CSV cells are sanitised against spreadsheet formula injection (`lib/csv.ts`).

## 12. Shared filters & date range (§68)
Filter bar params: `range` (`today` | `week` | `7d` | `month` | `lastMonth` |
`custom`), `from`, `to`, `brandId`, `dealershipId` (+ `status` / `source` / `month`).
Preset logic centralised in `server/src/lib/dateRange.ts`.

## 13. Reports (§25, §26, §67)
Families: Sales, Marketing, Inventory, Finance, AfterSales. Sales report includes
pipeline / result-by-manager tables and service contribution.

## 14. Audit trail (§75)
State-changing operations on sales, expenses, bonuses, stock, reservations,
vehicles, users, brands, dealerships and **leads** append an `AuditLog` row
(`CREATE` / `UPDATE` / `DELETE` / `STATUS_CHANGE`) with old/new values.

## 15. Users & settings
- User management (create/edit, role, dealership/brand scope, active flag).
- `lastLoginAt` tracked on each login.
- App/finance settings editable by `settings.manage` / `finance.manage`.

## 16. Security (hardening)
- Session cookie: httpOnly, sameSite=lax, secure in production.
- Login throttling by `ip|email` (`LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW_MINUTES`).
- `SESSION_SECRET` must be ≥ 32 chars and non-default in production (fail-fast).
- Centralised error handler: no stack traces or Prisma internals leaked.
- Request body limit (10 MB) and import row cap.
- SPA fallback with path-traversal guard.

---

## Appendix — localStorage / i18n
- Three languages: `uz`, `ru`, `en`; keys kept in sync across all three.
- Navigation is data-driven (`lib/navigation.ts`) and filtered by capability.
