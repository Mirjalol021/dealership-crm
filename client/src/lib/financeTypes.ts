export type ExpenseType = 'FIXED' | 'VARIABLE';
export type ExpenseStatus = 'PENDING' | 'PAID';

export interface Expense {
  id: string;
  accountingMonth: string;
  paymentDate: string | null;
  category: string;
  expenseType: ExpenseType;
  amount: number;
  paymentMethod: 'LLC_ACCOUNT' | 'CASH' | 'CARD' | null;
  status: ExpenseStatus;
  comment: string | null;
  dealership: string | null;
  brand: string | null;
}

export interface KpiBonus {
  id: string;
  month: string;
  amount: number;
  status: 'EXPECTED' | 'CONFIRMED' | 'PAID';
  receivedDate: string | null;
  receivedVia: string | null;
  comment: string | null;
  brand: string;
  dealership: string | null;
}

export interface DashboardCards {
  totalTurnover: number;
  vehicleMargin: number;
  marginBeforeVat: number;
  marginAfterVat: number;
  serviceRevenue: number;
  serviceContribution: number;
  vinBonuses: number;
  vinBonusesExpected: number;
  kpiBonuses: number;
  kpiBonusesExpected: number;
  customerBonuses: number;
  vatProvision: number;
  totalExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;
  netResult: number;
}

export interface MonthlyTrendPoint {
  month: string;
  turnover: number;
  margin: number;
  expenses: number;
  net: number;
}

export interface FinanceSettings {
  taxName: string;
  taxRate: number;
  taxBase: string;
  marginIsVatInclusive: boolean;
}

export const EXPENSE_CATEGORIES = [
  'Rent', 'Salaries', 'Electricity', 'Water', 'Utilities', 'Internet',
  'Marketing', 'Office', 'Security', 'Software', 'Repairs', 'Other',
];
