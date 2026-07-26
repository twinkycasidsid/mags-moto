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
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  productCount?: number;
  active?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId: string;
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
  occurredAt: string;
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
  adjustmentType: 'increase' | 'decrease';
  quantity: number;
  reason:
    | 'damaged'
    | 'lost'
    | 'returned'
    | 'physical_count_correction'
    | 'shop_use'
    | 'encoding_error'
    | 'other';
  previousStock: number;
  newStock: number;
  notes?: string;
  user: string;
  timestamp: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  movementType: 'stock_in' | 'adjustment' | 'sale' | 'sale_void';
  previousStock: number;
  quantityChanged: number;
  newStock: number;
  unitCost?: number;
  referenceNumber?: string;
  notes?: string;
  user: string;
  occurredAt: string;
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

export interface AuthProfile {
  id: string;
  name: string;
  username: string;
  role: Role;
  active: boolean;
}

export interface AppSnapshot {
  settings: StoreSettings;
  users: User[];
  categories: Category[];
  products: Product[];
  transactions: Transaction[];
  expenses: Expense[];
  adjustments: StockAdjustment[];
  receivingRecords: StockReceivingRecord[];
  inventoryMovements: InventoryMovement[];
  auditLogs: AuditLog[];
}

export interface ProductInput {
  id?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId: string;
  unit: string;
  costPrice: number;
  totalPurchaseCost?: number;
  sellingPrice: number;
  currentStock: number;
  reorderLevel: number;
  maxStock?: number;
  status: 'active' | 'archived';
  allowBelowCost?: boolean;
}

export interface CategoryInput {
  name: string;
  description?: string;
}

export interface SaleCheckoutItemInput {
  productId: string;
  quantity: number;
}

export interface SaleCheckoutInput {
  paymentMethod: PaymentMethod;
  amountReceived: number;
  discountTotal: number;
  items: SaleCheckoutItemInput[];
}

export interface ExpenseInput {
  category: string;
  description: string;
  amount: number;
  referenceNumber?: string;
}

export interface UserUpsertInput {
  id?: string;
  name: string;
  username: string;
  password?: string;
  role: Role;
  active?: boolean;
}
