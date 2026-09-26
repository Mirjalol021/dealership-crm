import type { Role } from './types';
import type { IconName } from '../components/Icons';

// Navigation per spec §77. Each item maps to a route path and i18n key.
export interface NavItem {
  path: string;
  labelKey: string; // i18n key under "nav."
  capability?: string; // required capability to see it
  icon?: IconName; // sidebar glyph
}

const ITEMS: Record<string, NavItem> = {
  dashboard: { path: '/', labelKey: 'dashboard', icon: 'Dashboard' },
  leads: { path: '/leads', labelKey: 'leads', capability: 'leads.view.all', icon: 'Leads' },
  appointments: { path: '/appointments', labelKey: 'appointments', icon: 'Calendar' },
  inventory: { path: '/inventory', labelKey: 'inventory', capability: 'inventory.view', icon: 'Car' },
  reservations: { path: '/reservations', labelKey: 'reservations', capability: 'sales.view', icon: 'Bookmark' },
  aftersales: { path: '/aftersales', labelKey: 'aftersales', capability: 'aftersales.view', icon: 'Car' },
  aftersalesInventory: { path: '/aftersales/inventory', labelKey: 'aftersalesInventory', capability: 'aftersales.view', icon: 'Box' },
  stockMovements: { path: '/aftersales/stock-movements', labelKey: 'stockMovements', capability: 'aftersales.view', icon: 'Truck' },
  finance: { path: '/finance', labelKey: 'finance', capability: 'finance.view', icon: 'Coin' },
  reports: { path: '/reports', labelKey: 'reports', icon: 'Chart' },
  users: { path: '/users', labelKey: 'users', capability: 'users.manage', icon: 'Users' },
  settings: { path: '/settings', labelKey: 'settings', capability: 'settings.manage', icon: 'Settings' },
  management: { path: '/management', labelKey: 'management', capability: 'leads.view.all', icon: 'Chart' },
  importData: { path: '/import', labelKey: 'importData', capability: 'settings.manage', icon: 'Upload' },
  leadForms: { path: '/lead-forms', labelKey: 'leadForms', capability: 'settings.manage', icon: 'Form' },

  // Staff-focused items
  today: { path: '/today', labelKey: 'today', icon: 'Today' },
  leadPool: { path: '/lead-pool', labelKey: 'leadPool', capability: 'leads.take', icon: 'Spark' },
  kanban: { path: '/kanban', labelKey: 'kanban', capability: 'leads.view.own', icon: 'Kanban' },
  myLeads: { path: '/my-leads', labelKey: 'myLeads', capability: 'leads.view.own', icon: 'Leads' },
  newLeads: { path: '/new-leads', labelKey: 'newLeads', capability: 'leads.view.all', icon: 'Leads' },
  followUps: { path: '/follow-ups', labelKey: 'followUps', icon: 'Calendar' },
  qualified: { path: '/qualified', labelKey: 'qualified', capability: 'leads.assign', icon: 'Spark' },
  customersToCall: { path: '/customers-to-call', labelKey: 'customersToCall', capability: 'aftersales.view', icon: 'Leads' },
  soldCars: { path: '/sold-cars', labelKey: 'soldCars', capability: 'sales.view', icon: 'Car' },
  serviceVisits: { path: '/service-visits', labelKey: 'serviceVisits', capability: 'aftersales.view', icon: 'Wrench' },
  financeOverview: { path: '/finance', labelKey: 'financeOverview', capability: 'finance.view', icon: 'Coin' },
  expenses: { path: '/expenses', labelKey: 'expenses', capability: 'finance.view', icon: 'Receipt' },
  soldCarsFinance: { path: '/sold-cars-finance', labelKey: 'soldCarsFinance', capability: 'finance.view', icon: 'Car' },
  distributorBonuses: { path: '/distributor-bonuses', labelKey: 'distributorBonuses', capability: 'finance.view', icon: 'Coin' },
  financeSettings: { path: '/finance/settings', labelKey: 'taxSettings', capability: 'finance.manage', icon: 'Settings' },
};

// Ordered navigation per role (spec §77).
const ROLE_NAV: Record<Role, string[]> = {
  SUPER_ADMIN: [
    'dashboard', 'leads', 'management', 'appointments', 'inventory', 'reservations', 'soldCars',
    'aftersales', 'serviceVisits', 'aftersalesInventory', 'stockMovements', 'finance', 'expenses', 'distributorBonuses', 'financeSettings', 'reports', 'leadForms', 'importData', 'users', 'settings',
  ],
  HEAD_OF_SALES: [
    'dashboard', 'leads', 'management', 'appointments', 'inventory', 'reservations', 'soldCars', 'reports',
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
