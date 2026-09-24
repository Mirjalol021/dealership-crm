export type VehicleStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';
export type PaymentType = 'CASH' | 'CREDIT' | 'OTHER';
export type PaymentMethod = 'LLC_ACCOUNT' | 'CASH' | 'CARD';
export type BonusStatus = 'EXPECTED' | 'CONFIRMED' | 'PAID';
export type BonusType = 'TONIROVKA' | 'POLIK' | 'REGISTRATION' | 'FUEL' | 'GIFT' | 'OTHER';

export interface Vehicle {
  id: string;
  model: string;
  trim: string | null;
  color: string | null;
  vin: string;
  arrivalDate: string;
  reservedAt: string | null;
  soldAt: string | null;
  sellingPrice: number | null;
  status: VehicleStatus;
  notes: string | null;
  brand: string;
  dealership: string;
  region: string;
}

export interface Reservation {
  id: string;
  reservationDate: string;
  depositAmount: number;
  depositPaymentMethod: PaymentMethod | null;
  expirationDate: string | null;
  comment: string | null;
  customerName: string | null;
  phone: string;
  vin: string;
  model: string;
  salesManager: string | null;
}

export interface Sale {
  id: string;
  saleDate: string;
  model: string;
  vin: string;
  paymentType: PaymentType;
  financeProductText: string | null;
  discountedSale: boolean;
  customerName: string | null;
  phone: string;
  brand: string;
  dealership: string;
  salesManager: string | null;
  // cost fields — only present for cost-authorized roles
  salePrice?: number;
  manualMargin?: number;
  discountAmount?: number | null;
  discountComment?: string | null;
}

export interface CustomerBonus {
  id: string;
  bonusType: BonusType;
  amount: number;
  date: string;
  paidFrom: PaymentMethod;
  comment: string | null;
}

export interface VinBonus {
  id: string;
  amount: number;
  accountingMonth: string;
  status: BonusStatus;
  receivedDate: string | null;
  receivedVia: PaymentMethod | null;
  comment: string | null;
}
