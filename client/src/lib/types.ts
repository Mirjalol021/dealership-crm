export type Role =
  | 'SUPER_ADMIN'
  | 'HEAD_OF_SALES'
  | 'SALES_MANAGER'
  | 'CALL_CENTER'
  | 'SERVICE_STAFF'
  | 'FINANCE';

export type Language = 'uz' | 'ru' | 'en';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  preferredLanguage: Language;
  dealershipIds: string[];
  brandIds: string[];
  capabilities: string[];
}

export interface Brand {
  id: string;
  name: string;
  code: string;
  active: boolean;
  logoUrl: string | null;
  sortOrder: number;
}

export interface Dealership {
  id: string;
  dealershipName: string;
  cityRegion: string;
  address: string | null;
  active: boolean;
  brands?: Brand[];
}
