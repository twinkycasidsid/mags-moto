export type Role = 'admin' | 'cashier';

export interface UserPermissions {
  canVoidSales: boolean;
  canEditProducts: boolean;
  canManageInventory: boolean;
  canViewReports: boolean;
  canManageExpenses: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  pin?: string;
  active: boolean;
  permissions?: UserPermissions;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  productCount?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  categoryId: string;
  supplierId: string;
  unit: string; // 'pc', 'pack', 'bottle', 'kg', etc.
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  reorderLevel: number;
  maxStock?: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // percentage or fixed amount
}

export type PaymentMethod = 'cash' | 'gcash';

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  subtotal: number;
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  timestamp: string;
  cashierId: string;
  cashierName: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  totalCost: number;
  estimatedProfit: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeGiven: number;
  status: 'completed' | 'voided' | 'refunded';
  voidReason?: string;
}

export interface StockReceivingItem {
  productId: string;
  productName: string;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
}

export interface StockReceivingRecord {
  id: string;
  referenceNumber: string;
  supplierId: string;
  supplierName: string;
  deliveryDate: string;
  items: StockReceivingItem[];
  totalAmount: number;
  recordedBy: string;
  timestamp: string;
  notes?: string;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  adjustmentType: 'add' | 'remove';
  quantity: number;
  reason: 'damaged' | 'expired' | 'lost' | 'returned' | 'correction' | 'personal_use';
  previousStock: number;
  newStock: number;
  notes?: string;
  user: string;
  timestamp: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  referenceNumber?: string;
  recordedBy: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  action: string;
  affectedRecord: string;
  details: string;
}

export interface StoreSettings {
  storeName: string;
  storeLogo?: string;
  address?: string;
  phone?: string;
  email?: string;
  currencySymbol: string;
  taxRate?: number;
  allowNegativeStock: boolean;
  receiptFooter?: string;
}
