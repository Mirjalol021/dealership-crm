// Backend-enforced permission model (spec §5, §73).
// Frontend hiding is NOT sufficient — every route must call requirePermission.

export type Role =
  | 'SUPER_ADMIN'
  | 'HEAD_OF_SALES'
  | 'SALES_MANAGER'
  | 'CALL_CENTER'
  | 'SERVICE_STAFF'
  | 'FINANCE';

// Capability keys. Keep this list small and meaningful.
export type Capability =
  | 'settings.manage'        // dealerships, brands, integrations, users
  | 'users.manage'
  | 'leads.view.all'
  | 'leads.view.own'
  | 'leads.assign'
  | 'leads.take'
  | 'leads.create'
  | 'finance.view'
  | 'finance.manage'
  | 'costs.view'             // purchase cost, margin, service profit
  | 'aftersales.view'
  | 'aftersales.manage'
  | 'sales.view'
  | 'sales.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'reports.sales'
  | 'reports.finance'
  | 'reports.marketing'
  | 'reports.aftersales';

const ALL: Capability[] = [
  'settings.manage', 'users.manage',
  'leads.view.all', 'leads.view.own', 'leads.assign', 'leads.take', 'leads.create',
  'finance.view', 'finance.manage', 'costs.view',
  'aftersales.view', 'aftersales.manage',
  'sales.view', 'sales.manage',
  'inventory.view', 'inventory.manage',
  'reports.sales', 'reports.finance', 'reports.marketing', 'reports.aftersales',
];

// Single source of truth for what each role can do.
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  SUPER_ADMIN: ALL,

  HEAD_OF_SALES: [
    'leads.view.all', 'leads.assign', 'leads.take', 'leads.create',
    'sales.view', 'sales.manage',
    'inventory.view',
    'reports.sales', 'reports.marketing',
  ],

  SALES_MANAGER: [
    'leads.view.own', 'leads.take', 'leads.create',
    'sales.view', 'sales.manage',
    'inventory.view',
  ],

  CALL_CENTER: [
    'leads.view.all', 'leads.assign', 'leads.take',
  ],

  SERVICE_STAFF: [
    'aftersales.view', 'aftersales.manage',
    'sales.view', // sold cars, read-only in UI
  ],

  FINANCE: [
    'finance.view', 'finance.manage', 'costs.view',
    'sales.view',
    'aftersales.view',
    'reports.finance', 'reports.sales', 'reports.aftersales',
  ],
};

export function can(role: Role, cap: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
}

// Roles that must NEVER see cost/finance data (§5.2, §5.3, §5.4, §5.5, §46).
export const COST_HIDDEN_ROLES: Role[] = [
  'HEAD_OF_SALES', 'SALES_MANAGER', 'CALL_CENTER', 'SERVICE_STAFF',
];
