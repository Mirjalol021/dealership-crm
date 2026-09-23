import type { Role } from './types';

// Navigation per spec §77. Each item maps to a route path and i18n key.
export interface NavItem {
  path: string;
  labelKey: string; // i18n key under "nav."
  capability?: string; // required capability to see it
}

const ITEMS: Record<string, NavItem> = {
  dashboard: { path: '/', labelKey: 'dashboard' },
  leads: { path: '/leads', labelKey: 'leads', capability: 'leads.view.all' },
  appointments: { path: '/appointments', labelKey: 'appointments' },
  inventory: { path: '/inventory', labelKey: 'inventory', capability: 'inventory.view' },
  reservations: { path: '/reservations', labelKey: 'reservations', capability: 'sales.view' },
  sales: { path: '/sales', labelKey: 'sales', capability: 'sales.view' },
  aftersales: { path: '/aftersales', labelKey: 'aftersales', capability: 'aftersales.view' },
  aftersalesInventory: { path: '/aftersales/inventory', labelKey: 'aftersalesInventory', capability: 'aftersales.view' },
  stockMovements: { path: '/aftersales/stock-movements', labelKey: 'stockMovements', capability: 'aftersales.view' },
  finance: { path: '/finance', labelKey: 'finance', capability: 'finance.view' },
  reports: { path: '/reports', labelKey: 'reports' },
  users: { path: '/users', labelKey: 'users', capability: 'users.manage' },
  settings: { path: '/settings', labelKey: 'settings', capability: 'settings.manage' },
  management: { path: '/management', labelKey: 'management', capability: 'leads.view.all' },

  // Staff-focused items
  today: { path: '/today', labelKey: 'today' },
  leadPool: { path: '/lead-pool', labelKey: 'leadPool', capability: 'leads.take' },
  kanban: { path: '/kanban', labelKey: 'kanban', capability: 'leads.view.own' },
  myLeads: { path: '/my-leads', labelKey: 'myLeads', capability: 'leads.view.own' },
  newLeads: { path: '/new-leads', labelKey: 'newLeads', capability: 'leads.view.all' },
  followUps: { path: '/follow-ups', labelKey: 'followUps' },
  qualified: { path: '/qualified', labelKey: 'qualified', capability: 'leads.assign' },
  customersToCall: { path: '/customers-to-call', labelKey: 'customersToCall', capability: 'aftersales.view' },
  soldCars: { path: '/sold-cars', labelKey: 'soldCars', capability: 'sales.view' },
  serviceVisits: { path: '/service-visits', labelKey: 'serviceVisits', capability: 'aftersales.view' },
  financeOverview: { path: '/finance', labelKey: 'financeOverview', capability: 'finance.view' },
  expenses: { path: '/expenses', labelKey: 'expenses', capability: 'finance.view' },
  soldCarsFinance: { path: '/sold-cars-finance', labelKey: 'soldCarsFinance', capability: 'finance.view' },
  distributorBonuses: { path: '/distributor-bonuses', labelKey: 'distributorBonuses', capability: 'finance.view' },
  financeSettings: { path: '/finance/settings', labelKey: 'taxSettings', capability: 'finance.manage' },
};

// Ordered navigation per role (spec §77).
const ROLE_NAV: Record<Role, string[]> = {
  SUPER_ADMIN: [
    'dashboard', 'leads', 'management', 'appointments', 'inventory', 'reservations', 'soldCars', 'sales',
    'aftersales', 'serviceVisits', 'aftersalesInventory', 'stockMovements', 'finance', 'expenses', 'distributorBonuses', 'financeSettings', 'reports', 'users', 'settings',
  ],
  HEAD_OF_SALES: [
    'dashboard', 'leads', 'management', 'appointments', 'inventory', 'reservations', 'soldCars', 'sales', 'reports',
  ],
  SALES_MANAGER: [
    'today', 'leadPool', 'myLeads', 'kanban', 'appointments', 'inventory', 'reservations', 'soldCars',
  ],
  CALL_CENTER: [
    'newLeads', 'followUps', 'qualified',
  ],
  SERVICE_STAFF: [
    'customersToCall', 'aftersales', 'serviceVisits', 'aftersalesInventory', 'stockMovements',
  ],
  FINANCE: [
    'financeOverview', 'expenses', 'distributorBonuses', 'financeSettings', 'reports',
  ],
};

export function navForRole(role: Role): NavItem[] {
  return ROLE_NAV[role].map((k) => ITEMS[k]);
}

// The default landing route for a role (Sales Manager lands on Today — §16).
export function homeForRole(role: Role): string {
  if (role === 'SALES_MANAGER') return '/today';
  return '/';
}
