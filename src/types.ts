export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  unit: string;
  location: string;
  updatedAt: string;
  price?: number;
  weight?: number;
  weightUnit?: string;
}

export type TransactionType = 'IN' | 'OUT' | 'RETURN';

export type ReturnStatus = 'RE_STOCK' | 'DAMAGED_WRITE_OFF' | 'PENDING_INSPECT';

export interface Transaction {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  type: TransactionType;
  quantity: number;
  date: string;
  reason: string;
  operator: string;
  // Dynamic fields based on type
  returnStatus?: ReturnStatus; // relevant only if type === 'RETURN'
  referenceNo?: string; // order number, invoice number, etc.
  weight?: number;
  weightUnit?: string;
}

export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  lowStockItemsCount: number;
  returnedItemsCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  role: 'ADMIN' | 'KEEPER' | 'AUDITOR';
  isActive: boolean;
  password?: string;
  securityQuestion?: string;
  securityAnswer?: string;
}

export interface AppSettings {
  appName: string;
  appSubtitle: string;
  appLogo: string;
  googleSheetsId?: string;
  googleSheetsUrl?: string;
  googleSheetsAutoSync?: boolean;
  googleSheetsLastSyncedAt?: string;
  lineChannelAccessToken?: string;
  lineChannelSecret?: string;
  lineBotEnabled?: boolean;
  lineBotSystemPrompt?: string;
}

export interface RolePermissions {
  manageProducts: boolean;
  recordTransactions: boolean;
  manageSettings: boolean;
  resetSystem: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Shelf {
  id: string;
  name: string;
  description?: string;
  zone?: string;
  createdAt?: string;
}


