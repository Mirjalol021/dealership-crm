// Finance calculation engine (§35, §38-§41, §51-§55).
// VAT convention is configurable (§40): margin VAT-inclusive (÷1.12) or exclusive (×rate).

export interface TaxSettings {
  taxRate: number;              // percent, e.g. 12
  marginIsVatInclusive: boolean; // if true, margin already contains VAT
}

// VAT provision on a vehicle margin (§40).
export function vatProvision(margin: number, t: TaxSettings): number {
  const rate = t.taxRate / 100;
  if (t.marginIsVatInclusive) {
    // margin is gross; VAT portion = margin * rate / (1 + rate)
    return round2((margin * rate) / (1 + rate));
  }
  // margin is net; VAT = margin * rate
  return round2(margin * rate);
}

export function marginAfterVat(margin: number, t: TaxSettings): number {
  return round2(margin - vatProvision(margin, t));
}

// Vehicle Contribution (§41):
//   Manual Margin
//   + Confirmed/Paid Extra Distributor Bonus
//   − Customer Bonuses
//   − VAT Provision
export function vehicleContribution(
  manualMargin: number,
  confirmedDistributorBonus: number,
  customerBonuses: number,
  t: TaxSettings,
): { contribution: number; vat: number } {
  const vat = vatProvision(manualMargin, t);
  const contribution = round2(
    manualMargin + confirmedDistributorBonus - customerBonuses - vat,
  );
  return { contribution, vat };
}

// Service Contribution (§52): revenue − cost of parts used.
export function serviceContribution(revenue: number, inventoryCost: number): number {
  return round2(revenue - inventoryCost);
}

// Monthly Net Result (§55). Expected (unconfirmed) bonuses are excluded by default.
export function netResult(inputs: {
  vehicleContribution: number;
  confirmedKpiBonus: number;
  serviceContribution: number;
  fixedExpenses: number;
  variableExpenses: number;
}): number {
  return round2(
    inputs.vehicleContribution
    + inputs.confirmedKpiBonus
    + inputs.serviceContribution
    - inputs.fixedExpenses
    - inputs.variableExpenses,
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Which month a value belongs to for Profit View (accountingMonth, "YYYY-MM").
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
