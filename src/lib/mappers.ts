import type {
  AuditLog,
  Category,
  Expense,
  InventoryMovement,
  Product,
  StockAdjustment,
  StockReceivingRecord,
  StoreSettings,
  Supplier,
  Transaction,
  User,
} from '../types';
import { formatDateOnly, formatDateTime } from './format';

export const mapSettings = (row: any): StoreSettings => ({
  storeName: row?.store_name ?? 'Mags Moto',
  storeLogo: row?.store_logo ?? '/Mags%20Moto%20Logo.png',
  address: row?.address ?? '',
  phone: row?.phone ?? '',
  email: row?.email ?? '',
  currencySymbol: row?.currency_symbol ?? '₱',
  taxRate: Number(row?.tax_rate ?? 0),
  allowNegativeStock: Boolean(row?.allow_negative_stock),
  receiptFooter: row?.receipt_footer ?? '',
});

export const mapUser = (row: any): User => ({
  id: row.id,
  name: row.name,
  username: row.username,
  role: row.role,
  active: row.active,
  permissions:
    row.role === 'admin'
      ? {
          canVoidSales: true,
          canEditProducts: true,
          canManageInventory: true,
          canViewReports: true,
          canManageExpenses: true,
        }
      : {
          canVoidSales: false,
          canEditProducts: false,
          canManageInventory: false,
          canViewReports: false,
          canManageExpenses: false,
        },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapCategory = (row: any): Category => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  productCount:
    typeof row.products?.[0]?.count === 'number'
      ? row.products[0].count
      : typeof row.product_count === 'number'
        ? row.product_count
        : 0,
  active: typeof row.active === 'boolean' ? row.active : true,
});

export const mapSupplier = (row: any): Supplier => ({
  id: row.id,
  name: row.name,
  contactPerson: row.contact_person ?? '',
  phone: row.phone ?? '',
  email: row.email ?? '',
  address: row.address ?? '',
  active: Boolean(row.active),
});

export const mapProduct = (row: any): Product => ({
  id: row.id,
  sku: row.sku,
  barcode: row.barcode ?? '',
  name: row.name,
  description: row.description ?? '',
  categoryId: row.category_id,
  supplierId: row.supplier_id,
  unit: row.unit,
  costPrice: Number(row.cost_price),
  sellingPrice: Number(row.selling_price),
  currentStock: Number(row.current_stock),
  reorderLevel: Number(row.reorder_level),
  maxStock: row.max_stock ?? undefined,
  status: row.status,
  createdAt: formatDateOnly(row.created_at),
  updatedAt: formatDateOnly(row.updated_at),
});

export const mapTransaction = (row: any): Transaction => ({
  id: row.id,
  receiptNumber: row.receipt_number,
  occurredAt: row.sold_at,
  timestamp: formatDateTime(row.sold_at),
  cashierId: row.cashier_id,
  cashierName: row.cashier?.name ?? 'Unknown',
  items: (row.transaction_items ?? []).map((item: any) => ({
    productId: item.product_id,
    productName: item.product_name,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
    costPrice: Number(item.cost_price),
    discount: Number(item.discount),
    subtotal: Number(item.subtotal),
  })),
  subtotal: Number(row.subtotal),
  discountTotal: Number(row.discount_total),
  taxTotal: Number(row.tax_total),
  grandTotal: Number(row.grand_total),
  totalCost: Number(row.total_cost),
  estimatedProfit: Number(row.estimated_profit),
  paymentMethod: row.payment_method,
  amountReceived: Number(row.amount_received),
  changeGiven: Number(row.change_given),
  status: row.status,
  voidReason: row.void_reason ?? undefined,
});

export const mapExpense = (row: any): Expense => ({
  id: row.id,
  category: row.category,
  description: row.description,
  amount: Number(row.amount),
  date: row.expense_date,
  referenceNumber: row.reference_number ?? undefined,
  recordedBy: row.recorder?.name ?? 'Unknown',
});

export const mapStockAdjustment = (row: any): StockAdjustment => ({
  id: row.id,
  productId: row.product_id,
  productName: row.product?.name ?? 'Unknown',
  adjustmentType: row.adjustment_type,
  quantity: Number(row.quantity),
  reason: row.reason,
  previousStock: Number(row.previous_stock),
  newStock: Number(row.new_stock),
  notes: row.notes ?? undefined,
  user: row.adjuster?.name ?? 'Unknown',
  timestamp: formatDateTime(row.created_at),
});

export const mapReceivingRecord = (row: any): StockReceivingRecord => ({
  id: row.id,
  referenceNumber: row.reference_number,
  supplierId: row.supplier_id ?? undefined,
  supplierName: row.supplier?.name ?? undefined,
  deliveryDate: row.delivery_date,
  totalAmount: Number(row.total_amount),
  recordedBy: row.recorder?.name ?? 'Unknown',
  timestamp: formatDateTime(row.created_at),
  notes: row.notes ?? undefined,
  items: (row.stock_receiving_items ?? []).map((item: any) => ({
    productId: item.product_id,
    productName: item.product?.name ?? 'Unknown',
    quantityReceived: Number(item.quantity_received),
    unitCost: Number(item.unit_cost),
    totalCost: Number(item.total_cost),
  })),
});

export const mapInventoryMovement = (row: any): InventoryMovement => ({
  id: row.id,
  productId: row.product_id,
  productName: row.product?.name ?? 'Unknown',
  movementType: row.movement_type,
  previousStock: Number(row.previous_stock),
  quantityChanged: Number(row.quantity_changed),
  newStock: Number(row.new_stock),
  unitCost:
    row.unit_cost === null || row.unit_cost === undefined ? undefined : Number(row.unit_cost),
  referenceNumber: row.reference_number ?? undefined,
  notes: row.notes ?? undefined,
  user: row.creator?.name ?? 'Unknown',
  occurredAt: row.created_at,
  timestamp: formatDateTime(row.created_at),
});

export const mapAuditLog = (row: any): AuditLog => ({
  id: row.id,
  timestamp: formatDateTime(row.created_at),
  userName: row.user_name,
  action: row.action,
  affectedRecord: row.affected_record,
  details: row.details,
});
