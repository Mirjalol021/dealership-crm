import type { FastifyInstance } from 'fastify';
import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { requireAuth, requirePermission } from '../auth/guard.js';
import { can } from '../auth/permissions.js';
import { scopeWhere } from '../auth/scope.js';
import { normalizePhone } from '../lib/phone.js';
import { findOrCreateCustomer } from '../lib/leadService.js';
import { logAuditSafe } from '../lib/audit.js';

// Convert rows to CSV (§65).
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
}

// Build an Excel workbook (§65).
async function toXlsx(sheetName: string, headers: string[], rows: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((col) => { col.width = 18; });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

type PreviewRow = { row: number; status: 'valid' | 'invalid' | 'duplicate'; reason?: string; data?: Record<string, unknown> };

// Case-insensitive column getter across common header spellings.
function pick(r: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const exact = r[k];
    if (exact) return exact;
    const ci = Object.keys(r).find((key) => key.toLowerCase() === k.toLowerCase());
    if (ci && r[ci]) return r[ci];
  }
  return '';
}

export async function importExportRoutes(app: FastifyInstance): Promise<void> {
  // ---------- EXPORT (§65, §66) ----------
  // Query params: type (leads|sales|inventory|expenses|stock), format (csv|xlsx).
  app.get('/api/export/:type', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const { type } = req.params as { type: string };
    const q = req.query as Record<string, string | undefined>;
    const format = q.format === 'xlsx' ? 'xlsx' : 'csv';

    let headers: string[] = [];
    let rows: (string | number | null)[][] = [];
    let sheet = 'Export';

    if (type === 'leads') {
      sheet = 'Leads';
      const where: Record<string, unknown> = { ...scopeWhere(user) };
      if (user.role === 'SALES_MANAGER') where.assignedUserId = user.id;
      if (q.brandId) where.brandId = q.brandId;
      const leads = await prisma.lead.findMany({
        where,
        include: { customer: true, brand: true, dealership: true, assignedUser: { select: { name: true } }, comments: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      headers = ['Created', 'Customer', 'Phone', 'Dealership', 'Brand', 'Model', 'Source', 'Campaign', 'Manager', 'Pipeline', 'LastResult', 'NextFollowUp', 'Comments'];
      rows = leads.map((l) => [
        l.createdAt.toISOString(), l.customer.name, l.customer.primaryPhone, l.dealership.dealershipName,
        l.brand.name, l.modelInterest, l.source, l.campaign, l.assignedUser?.name ?? '',
        l.pipelineStatus, l.lastResult, l.nextFollowUpAt?.toISOString() ?? '',
        l.comments.map((c) => c.text).join(' | '),
      ]);
    } else if (type === 'sales') {
      sheet = 'Sales';
      const showCosts = can(user.role, 'costs.view');
      const sales = await prisma.soldCar.findMany({
        where: { ...scopeWhere(user) },
        include: { customer: true, brand: true, salesManager: { select: { name: true } } },
        orderBy: { saleDate: 'desc' }, take: 5000,
      });
      headers = ['Date', 'Customer', 'Phone', 'Brand', 'Model', 'VIN', 'PaymentType', ...(showCosts ? ['SalePrice', 'Margin', 'Discount'] : []), 'Manager'];
      rows = sales.map((s) => [
        s.saleDate.toISOString(), s.customer.name, s.phone ?? s.customer.primaryPhone, s.brand.name,
        s.model, s.vin, s.paymentType,
        ...(showCosts ? [Number(s.salePrice), Number(s.manualMargin), s.discountAmount != null ? Number(s.discountAmount) : 0] : []),
        s.salesManager?.name ?? '',
      ]);
    } else if (type === 'inventory') {
      sheet = 'Inventory';
      const vehicles = await prisma.inventoryVehicle.findMany({ where: { ...scopeWhere(user) }, include: { brand: true, dealership: true } });
      headers = ['Brand', 'Model', 'Trim', 'Color', 'VIN', 'ArrivalDate', 'SellingPrice', 'Status'];
      rows = vehicles.map((v) => [
        v.brand.name, v.model, v.trim, v.color, v.vin, v.arrivalDate.toISOString(),
        v.sellingPrice != null ? Number(v.sellingPrice) : '', v.status,
      ]);
    } else if (type === 'expenses') {
      sheet = 'Expenses';
      const expenses = await prisma.expense.findMany({ where: { ...scopeWhere(user) }, orderBy: { accountingMonth: 'desc' } });
      headers = ['AccountingMonth', 'PaymentDate', 'Category', 'Type', 'Amount', 'Method', 'Status'];
      rows = expenses.map((e) => [
        e.accountingMonth, e.paymentDate?.toISOString() ?? '', e.category, e.expenseType,
        Number(e.amount), e.paymentMethod ?? '', e.status,
      ]);
    } else if (type === 'stock') {
      // AfterSales stock movements (§50, §65).
      sheet = 'StockMovements';
      const items = await prisma.afterSalesInventoryItem.findMany({
        where: { ...scopeWhere(user) },
        include: { receipts: true, usage: true, adjustments: true },
        orderBy: { itemName: 'asc' },
      });
      const showCosts = can(user.role, 'costs.view');
      headers = ['Item', 'Unit', 'Opening', 'Received', 'Used', 'Adjustments', 'Closing', ...(showCosts ? ['CostOfUsed'] : [])];
      rows = items.map((i) => {
        const received = i.receipts.reduce((s, r) => s + Number(r.quantityReceived), 0);
        const used = i.usage.reduce((s, u) => s + Number(u.quantity), 0);
        const adj = i.adjustments.reduce((s, a) => s + Number(a.quantityChange), 0);
        const closing = Number(i.quantityOnHand);
        const opening = closing - received + used - adj;
        const row: (string | number | null)[] = [i.itemName, i.unit, opening, received, -used, adj, closing];
        if (showCosts) row.push(i.usage.reduce((s, u) => s + Number(u.costSnapshot) * Number(u.quantity), 0));
        return row;
      });
    } else {
      return reply.code(400).send({ error: 'UNKNOWN_TYPE' });
    }

    const filename = `export-${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
    if (format === 'xlsx') {
      const buf = await toXlsx(sheet, headers, rows);
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buf);
    }
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send('\uFEFF' + toCsv(headers, rows)); // BOM for Excel UTF-8
  });

  // ---------- BULK UPLOAD (§64) ----------
  // Flow: Upload → Preview (validate + duplicate check) → Confirm.
  // Accepts JSON rows (parsed client-side from CSV/XLSX) for simplicity and safety.
  // Types: leads | inventory | customers | sold_cars | aftersales_stock
  app.post('/api/import/:type', { preHandler: [requirePermission('settings.manage')] }, async (req, reply) => {
    const user = req.user!;
    const { type } = req.params as { type: string };
    const body = req.body as { rows?: Record<string, string>[]; confirm?: boolean };
    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return reply.code(400).send({ error: 'NO_ROWS' });
    }

    const preview: PreviewRow[] = [];
    // For scoped users, default dealership/brand come from their access rather than `findFirst`.
    const defaultDealership = await prisma.dealership.findFirst({
      where: user.dealershipIds.length ? { id: { in: user.dealershipIds } } : {},
    });
    const defaultBrand = await prisma.brand.findFirst();

    async function resolveBrand(code: string) {
      if (!code) return defaultBrand;
      return prisma.brand.findFirst({ where: { code: code.toUpperCase() } });
    }
    async function resolveDealership(idOrName: string) {
      if (idOrName) {
        const byId = await prisma.dealership.findUnique({ where: { id: idOrName } }).catch(() => null);
        if (byId) return byId;
        const byName = await prisma.dealership.findFirst({ where: { dealershipName: { equals: idOrName, mode: 'insensitive' } } });
        if (byName) return byName;
      }
      return defaultDealership;
    }

    if (type === 'leads') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const phone = pick(r, 'phone');
        const brandCode = pick(r, 'brand');
        if (!phone || !brandCode) { preview.push({ row: i + 1, status: 'invalid', reason: 'missing phone or brand' }); continue; }
        const brand = await resolveBrand(brandCode);
        if (!brand) { preview.push({ row: i + 1, status: 'invalid', reason: `unknown brand: ${brandCode}` }); continue; }
        const dealership = await resolveDealership(pick(r, 'dealership'));
        if (!dealership) { preview.push({ row: i + 1, status: 'invalid', reason: 'no dealership' }); continue; }

        const normalized = normalizePhone(phone);
        const existingPhone = await prisma.leadPhone.findFirst({ where: { phone: normalized } });
        if (existingPhone) { preview.push({ row: i + 1, status: 'duplicate', reason: 'phone already exists' }); continue; }
        preview.push({ row: i + 1, status: 'valid', data: { name: pick(r, 'name') || null, phone: normalized, brandId: brand.id, dealershipId: dealership.id } });
      }
    } else if (type === 'inventory') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const vin = pick(r, 'vin');
        const brandCode = pick(r, 'brand');
        if (!vin || !brandCode) { preview.push({ row: i + 1, status: 'invalid', reason: 'missing vin or brand' }); continue; }
        const brand = await resolveBrand(brandCode);
        if (!brand) { preview.push({ row: i + 1, status: 'invalid', reason: `unknown brand: ${brandCode}` }); continue; }
        const dealership = await resolveDealership(pick(r, 'dealership'));
        if (!dealership) { preview.push({ row: i + 1, status: 'invalid', reason: 'no dealership' }); continue; }
        const dup = await prisma.inventoryVehicle.findUnique({ where: { vin } });
        if (dup) { preview.push({ row: i + 1, status: 'duplicate', reason: 'VIN already exists' }); continue; }
        preview.push({ row: i + 1, status: 'valid', data: { model: pick(r, 'model'), trim: pick(r, 'trim') || null, color: pick(r, 'color') || null, vin, brandId: brand.id, dealershipId: dealership.id } });
      }
    } else if (type === 'customers') {
      // §64: Customer Database — create/link customers without creating leads.
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const phone = pick(r, 'phone');
        if (!phone) { preview.push({ row: i + 1, status: 'invalid', reason: 'missing phone' }); continue; }
        const normalized = normalizePhone(phone);
        const existing = await prisma.leadPhone.findFirst({ where: { phone: normalized } });
        if (existing) { preview.push({ row: i + 1, status: 'duplicate', reason: 'customer already exists' }); continue; }
        preview.push({ row: i + 1, status: 'valid', data: { name: pick(r, 'name') || null, phone: normalized } });
      }
    } else if (type === 'sold_cars') {
      // §64: Historical Sold Cars — requires brand + vin + phone.
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const vin = pick(r, 'vin');
        const phone = pick(r, 'phone');
        const brandCode = pick(r, 'brand');
        if (!vin || !phone || !brandCode) { preview.push({ row: i + 1, status: 'invalid', reason: 'missing vin, phone or brand' }); continue; }
        const brand = await resolveBrand(brandCode);
        if (!brand) { preview.push({ row: i + 1, status: 'invalid', reason: `unknown brand: ${brandCode}` }); continue; }
        const dealership = await resolveDealership(pick(r, 'dealership'));
        if (!dealership) { preview.push({ row: i + 1, status: 'invalid', reason: 'no dealership' }); continue; }
        const dup = await prisma.soldCar.findUnique({ where: { vin } });
        if (dup) { preview.push({ row: i + 1, status: 'duplicate', reason: 'VIN already sold' }); continue; }
        const salePrice = Number(pick(r, 'saleprice') || pick(r, 'sale_price') || 0);
        const margin = Number(pick(r, 'margin') || pick(r, 'manualmargin') || 0);
        preview.push({
          row: i + 1, status: 'valid',
          data: {
            name: pick(r, 'name') || null, phone: normalizePhone(phone), vin,
            model: pick(r, 'model'), brandId: brand.id, dealershipId: dealership.id,
            saleDate: pick(r, 'saledate') || pick(r, 'sale_date') || null,
            salePrice, manualMargin: margin,
            paymentType: (pick(r, 'paymenttype') || 'CASH').toUpperCase(),
          },
        });
      }
    } else if (type === 'aftersales_stock') {
      // §64: AfterSales Inventory Opening Stock.
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const itemName = pick(r, 'itemname') || pick(r, 'item_name') || pick(r, 'name');
        const category = (pick(r, 'category') || 'OTHER_PARTS').toUpperCase();
        if (!itemName) { preview.push({ row: i + 1, status: 'invalid', reason: 'missing item name' }); continue; }
        const dealership = await resolveDealership(pick(r, 'dealership'));
        if (!dealership) { preview.push({ row: i + 1, status: 'invalid', reason: 'no dealership' }); continue; }
        const qty = Number(pick(r, 'quantity') || pick(r, 'qty') || pick(r, 'quantityonhand') || 0);
        const sellingPrice = Number(pick(r, 'sellingprice') || 0);
        const purchaseCost = Number(pick(r, 'purchasecost') || pick(r, 'cost') || 0);
        preview.push({
          row: i + 1, status: 'valid',
          data: {
            dealershipId: dealership.id, category, itemName,
            unit: (pick(r, 'unit') || 'PIECE').toUpperCase(),
            quantityOnHand: qty, sellingPrice, purchaseCost,
            partNumber: pick(r, 'partnumber') || null,
            compatibleBrandModel: pick(r, 'compatible') || null,
          },
        });
      }
    } else {
      return reply.code(400).send({ error: 'UNSUPPORTED_IMPORT_TYPE' });
    }

    const validRows = preview.filter((p) => p.status === 'valid');
    const batch = await prisma.importBatch.create({
      data: {
        type, uploadedById: user.id,
        status: body.confirm ? 'CONFIRMED' : 'PREVIEW',
        totalRows: rows.length, validRows: validRows.length,
        invalidRows: preview.filter((p) => p.status === 'invalid').length,
        duplicateRows: preview.filter((p) => p.status === 'duplicate').length,
        summary: preview as unknown as never,
      },
    });

    // Only import on confirm — never silently import invalid rows (§64).
    if (body.confirm) {
      if (type === 'leads') {
        for (const p of validRows) {
          const d = p.data as { name: string | null; phone: string; brandId: string; dealershipId: string };
          await prisma.$transaction(async (tx) => {
            const { customerId } = await findOrCreateCustomer(tx, d.phone, d.name);
            const lead = await tx.lead.create({
              data: { customerId, dealershipId: d.dealershipId, brandId: d.brandId, source: 'OTHER', pipelineStatus: 'NEW' },
            });
            await tx.leadActivity.create({ data: { leadId: lead.id, event: 'LEAD_CREATED' } });
          });
        }
      } else if (type === 'inventory') {
        for (const p of validRows) {
          const d = p.data as { model: string; trim: string | null; color: string | null; vin: string; brandId: string; dealershipId: string };
          await prisma.inventoryVehicle.create({
            data: { model: d.model, trim: d.trim, color: d.color, vin: d.vin, brandId: d.brandId, dealershipId: d.dealershipId, status: 'AVAILABLE' },
          });
        }
      } else if (type === 'customers') {
        for (const p of validRows) {
          const d = p.data as { name: string | null; phone: string };
          await prisma.$transaction(async (tx) => {
            await findOrCreateCustomer(tx, d.phone, d.name);
          });
        }
      } else if (type === 'sold_cars') {
        for (const p of validRows) {
          const d = p.data as {
            name: string | null; phone: string; vin: string; model: string; brandId: string; dealershipId: string;
            saleDate: string | null; salePrice: number; manualMargin: number; paymentType: string;
          };
          await prisma.$transaction(async (tx) => {
            const { customerId } = await findOrCreateCustomer(tx, d.phone, d.name);
            const paymentType = (['CASH', 'CREDIT', 'OTHER'].includes(d.paymentType) ? d.paymentType : 'CASH') as 'CASH' | 'CREDIT' | 'OTHER';
            await tx.soldCar.create({
              data: {
                saleDate: d.saleDate ? new Date(d.saleDate) : new Date(),
                dealershipId: d.dealershipId, brandId: d.brandId, model: d.model, vin: d.vin,
                customerId, phone: d.phone, salePrice: d.salePrice, manualMargin: d.manualMargin,
                paymentType,
              },
            });
          });
        }
      } else if (type === 'aftersales_stock') {
        for (const p of validRows) {
          const d = p.data as {
            dealershipId: string; category: string; itemName: string; unit: string;
            quantityOnHand: number; sellingPrice: number; purchaseCost: number;
            partNumber: string | null; compatibleBrandModel: string | null;
          };
          const categories = ['ENGINE_OIL', 'OIL_FILTER', 'AIR_FILTER', 'CABIN_FILTER', 'FUEL_FILTER', 'BRAKE_FLUID', 'COOLANT', 'SPARK_PLUG', 'BRAKE_PADS', 'OTHER_PARTS', 'OTHER_CONSUMABLES'];
          const units = ['PIECE', 'LITER', 'SET', 'OTHER'];
          await prisma.afterSalesInventoryItem.create({
            data: {
              dealershipId: d.dealershipId,
              category: (categories.includes(d.category) ? d.category : 'OTHER_PARTS') as never,
              itemName: d.itemName,
              unit: (units.includes(d.unit) ? d.unit : 'PIECE') as never,
              quantityOnHand: d.quantityOnHand, sellingPrice: d.sellingPrice, purchaseCost: d.purchaseCost,
              partNumber: d.partNumber, compatibleBrandModel: d.compatibleBrandModel,
            },
          });
        }
      }
    }

    if (body.confirm) {
      await logAuditSafe({
        actorId: user.id, entity: 'ImportBatch', entityId: batch.id, action: 'CREATE',
        summary: `Imported ${validRows.length} ${type} rows`,
        newValue: { type, valid: validRows.length, invalid: batch.invalidRows, duplicate: batch.duplicateRows },
      });
    }

    return reply.send({ batchId: batch.id, preview, counts: { total: rows.length, valid: validRows.length, invalid: batch.invalidRows, duplicate: batch.duplicateRows } });
  });
}
