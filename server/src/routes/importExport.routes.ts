import type { FastifyInstance } from 'fastify';
import ExcelJS from 'exceljs';
import { prisma } from '../db.js';
import { requireAuth, requirePermission } from '../auth/guard.js';
import { can } from '../auth/permissions.js';
import { normalizePhone } from '../lib/phone.js';
import { findOrCreateCustomer } from '../lib/leadService.js';

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
      const where: Record<string, unknown> = {};
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
      const vehicles = await prisma.inventoryVehicle.findMany({ include: { brand: true, dealership: true } });
      headers = ['Brand', 'Model', 'Trim', 'Color', 'VIN', 'ArrivalDate', 'SellingPrice', 'Status'];
      rows = vehicles.map((v) => [
        v.brand.name, v.model, v.trim, v.color, v.vin, v.arrivalDate.toISOString(),
        v.sellingPrice != null ? Number(v.sellingPrice) : '', v.status,
      ]);
    } else if (type === 'expenses') {
      sheet = 'Expenses';
      const expenses = await prisma.expense.findMany({ orderBy: { accountingMonth: 'desc' } });
      headers = ['AccountingMonth', 'PaymentDate', 'Category', 'Type', 'Amount', 'Method', 'Status'];
      rows = expenses.map((e) => [
        e.accountingMonth, e.paymentDate?.toISOString() ?? '', e.category, e.expenseType,
        Number(e.amount), e.paymentMethod ?? '', e.status,
      ]);
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
  app.post('/api/import/:type', { preHandler: [requirePermission('settings.manage')] }, async (req, reply) => {
    const user = req.user!;
    const { type } = req.params as { type: string };
    const body = req.body as { rows?: Record<string, string>[]; confirm?: boolean };
    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return reply.code(400).send({ error: 'NO_ROWS' });
    }

    const preview: { row: number; status: 'valid' | 'invalid' | 'duplicate'; reason?: string; data?: Record<string, unknown> }[] = [];

    if (type === 'leads') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const phone = r.phone ?? r.Phone ?? '';
        const brandCode = (r.brand ?? r.Brand ?? '').toUpperCase();
        if (!phone || !brandCode) {
          preview.push({ row: i + 1, status: 'invalid', reason: 'missing phone or brand' });
          continue;
        }
        const brand = await prisma.brand.findFirst({ where: { code: brandCode } });
        if (!brand) { preview.push({ row: i + 1, status: 'invalid', reason: `unknown brand: ${brandCode}` }); continue; }
        const dealership = await prisma.dealership.findFirst();
        if (!dealership) { preview.push({ row: i + 1, status: 'invalid', reason: 'no dealership' }); continue; }

        const normalized = normalizePhone(phone);
        const existingPhone = await prisma.leadPhone.findFirst({ where: { phone: normalized } });
        if (existingPhone) {
          preview.push({ row: i + 1, status: 'duplicate', reason: 'phone already exists' });
          continue;
        }
        preview.push({ row: i + 1, status: 'valid', data: { name: r.name ?? r.Name ?? null, phone: normalized, brandId: brand.id, dealershipId: dealership.id } });
      }
    } else if (type === 'inventory') {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const vin = r.vin ?? r.VIN ?? '';
        const brandCode = (r.brand ?? r.Brand ?? '').toUpperCase();
        if (!vin || !brandCode) { preview.push({ row: i + 1, status: 'invalid', reason: 'missing vin or brand' }); continue; }
        const brand = await prisma.brand.findFirst({ where: { code: brandCode } });
        if (!brand) { preview.push({ row: i + 1, status: 'invalid', reason: `unknown brand: ${brandCode}` }); continue; }
        const dealership = await prisma.dealership.findFirst();
        if (!dealership) { preview.push({ row: i + 1, status: 'invalid', reason: 'no dealership' }); continue; }
        const dup = await prisma.inventoryVehicle.findUnique({ where: { vin } });
        if (dup) { preview.push({ row: i + 1, status: 'duplicate', reason: 'VIN already exists' }); continue; }
        preview.push({ row: i + 1, status: 'valid', data: { model: r.model ?? r.Model ?? '', vin, brandId: brand.id, dealershipId: dealership.id } });
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
          const d = p.data as { model: string; vin: string; brandId: string; dealershipId: string };
          await prisma.inventoryVehicle.create({
            data: { model: d.model, vin: d.vin, brandId: d.brandId, dealershipId: d.dealershipId, status: 'AVAILABLE' },
          });
        }
      }
    }

    return reply.send({ batchId: batch.id, preview, counts: { total: rows.length, valid: validRows.length, invalid: batch.invalidRows, duplicate: batch.duplicateRows } });
  });
}
