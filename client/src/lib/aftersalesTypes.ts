export type AfterSalesCategory =
  | 'ENGINE_OIL' | 'OIL_FILTER' | 'AIR_FILTER' | 'CABIN_FILTER' | 'FUEL_FILTER'
  | 'BRAKE_FLUID' | 'COOLANT' | 'SPARK_PLUG' | 'BRAKE_PADS' | 'OTHER_PARTS' | 'OTHER_CONSUMABLES';

export type InventoryUnit = 'PIECE' | 'LITER' | 'SET' | 'OTHER';

export interface AsItem {
  id: string;
  category: AfterSalesCategory;
  itemName: string;
  compatibleBrandModel: string | null;
  partNumber: string | null;
  unit: InventoryUnit;
  quantityOnHand: number;
  sellingPrice: number;
  minimumStock: number | null;
  notes: string | null;
  active: boolean;
  purchaseCost?: number; // only for cost-authorized roles
}

export interface ServiceVisit {
  id: string;
  serviceDate: string;
  mileage: number | null;
  workPerformed: string;
  extraWorkPerformed: string | null;
  serviceRevenue: number;
  paymentMethod: string | null;
  nextServiceMileage: number | null;
  nextServiceDate: string | null;
  customerName: string | null;
  brand: string;
  model: string;
  vin: string;
  serviceStaff: string | null;
  itemsUsed: { itemId: string; itemName: string; quantity: number; unit: string; sellingPrice: number }[];
  inventoryCost?: number;
  serviceContribution?: number;
}

export interface CustomerToCall {
  soldCarId: string;
  customerName: string | null;
  phone: string;
  brand: string;
  model: string;
  vin: string;
  currentMileage: number | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  nextServiceMileage: number | null;
  bucket: 'DUE_SOON' | 'OVERDUE' | 'NEVER_SERVICED' | 'OK';
  serviceCount: number;
}

export interface AsSoldCar {
  id: string;
  customerName: string | null;
  phone: string;
  brand: string;
  model: string;
  vin: string;
  purchaseDate: string;
  salesManager: string | null;
  paymentType: string;
  currentMileage: number | null;
  lastServiceDate: string | null;
  nextServiceMileage: number | null;
  nextServiceDate: string | null;
  notes: string | null;
}

export const AS_CATEGORIES: AfterSalesCategory[] = [
  'ENGINE_OIL', 'OIL_FILTER', 'AIR_FILTER', 'CABIN_FILTER', 'FUEL_FILTER',
  'BRAKE_FLUID', 'COOLANT', 'SPARK_PLUG', 'BRAKE_PADS', 'OTHER_PARTS', 'OTHER_CONSUMABLES',
];

export const UNITS: InventoryUnit[] = ['PIECE', 'LITER', 'SET', 'OTHER'];
