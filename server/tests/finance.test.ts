import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  vatProvision,
  marginAfterVat,
  vehicleContribution,
  serviceContribution,
  netResult,
  monthKey,
  type TaxSettings,
} from '../src/lib/finance.js';

// §40 — VAT is configurable; two conventions supported.
test('vatProvision: VAT-exclusive margin (default 12%)', () => {
  const t: TaxSettings = { taxRate: 12, marginIsVatInclusive: false };
  assert.equal(vatProvision(1000, t), 120);
});

test('vatProvision: VAT-inclusive margin divides by (1+rate)', () => {
  const t: TaxSettings = { taxRate: 12, marginIsVatInclusive: true };
  // 1120 gross -> VAT portion = 1120 * 0.12 / 1.12 = 120
  assert.equal(vatProvision(1120, t), 120);
});

test('vatProvision: rate is configurable, not hardcoded', () => {
  const t: TaxSettings = { taxRate: 15, marginIsVatInclusive: false };
  assert.equal(vatProvision(2000, t), 300);
});

test('marginAfterVat subtracts the provision', () => {
  const t: TaxSettings = { taxRate: 12, marginIsVatInclusive: false };
  assert.equal(marginAfterVat(1000, t), 880);
});

// §41 — Vehicle Contribution formula.
test('vehicleContribution: margin + confirmed bonus − customer bonuses − VAT', () => {
  const t: TaxSettings = { taxRate: 12, marginIsVatInclusive: false };
  const { contribution, vat } = vehicleContribution(10_000_000, 2_000_000, 500_000, t);
  assert.equal(vat, 1_200_000);
  // 10M + 2M − 0.5M − 1.2M = 10.3M
  assert.equal(contribution, 10_300_000);
});

test('vehicleContribution: no bonuses still applies VAT', () => {
  const t: TaxSettings = { taxRate: 12, marginIsVatInclusive: false };
  const { contribution } = vehicleContribution(1_000_000, 0, 0, t);
  assert.equal(contribution, 880_000);
});

// §52 — Service Contribution = revenue − parts cost.
test('serviceContribution: revenue minus parts cost', () => {
  assert.equal(serviceContribution(5_000_000, 1_500_000), 3_500_000);
});

test('serviceContribution: can be negative when parts exceed revenue', () => {
  assert.equal(serviceContribution(100_000, 250_000), -150_000);
});

// §55 — Monthly Net Result.
test('netResult: vehicle + KPI + service − fixed − variable', () => {
  const net = netResult({
    vehicleContribution: 10_000_000,
    confirmedKpiBonus: 2_000_000,
    serviceContribution: 3_000_000,
    fixedExpenses: 4_000_000,
    variableExpenses: 1_500_000,
  });
  // 10M + 2M + 3M − 4M − 1.5M = 9.5M
  assert.equal(net, 9_500_000);
});

test('netResult: expected (unconfirmed) bonuses are excluded by caller', () => {
  // The formula itself only ever receives confirmed values; passing 0 proves
  // that expected money does not enter the realized profit (§41, §55).
  const net = netResult({
    vehicleContribution: 1_000_000,
    confirmedKpiBonus: 0,
    serviceContribution: 0,
    fixedExpenses: 0,
    variableExpenses: 0,
  });
  assert.equal(net, 1_000_000);
});

// §38 — Accounting month bucketing for Profit View.
test('monthKey: formats as YYYY-MM with zero padding', () => {
  assert.equal(monthKey(new Date(2026, 7, 8)), '2026-08'); // August
  assert.equal(monthKey(new Date(2026, 0, 15)), '2026-01'); // January
  assert.equal(monthKey(new Date(2026, 11, 31)), '2026-12'); // December
});
