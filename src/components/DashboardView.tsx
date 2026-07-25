import React from 'react';
import { Expense, InventoryMovement, Product, StoreSettings, Transaction } from '../types';
import {
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';

interface DashboardViewProps {
  products: Product[];
  transactions: Transaction[];
  expenses: Expense[];
  inventoryMovements: InventoryMovement[];
  settings: StoreSettings;
  onOpenPos: () => void;
  onOpenSales: () => void;
  onOpenInventory: () => void;
  openAddProductModal: () => void;
}

const formatMovementType = (movementType: InventoryMovement['movementType']) => {
  switch (movementType) {
    case 'stock_in':
      return 'Stock In';
    case 'adjustment':
      return 'Adjustment';
    case 'sale':
      return 'POS Sale';
    case 'sale_void':
      return 'Sale Reversal';
    default:
      return movementType;
  }
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  transactions,
  expenses,
  inventoryMovements,
  settings,
  onOpenPos,
  onOpenSales,
  onOpenInventory,
  openAddProductModal,
}) => {
  const activeProducts = products.filter((product) => product.status === 'active');
  const lowStockProducts = activeProducts.filter(
    (product) => product.currentStock > 0 && product.currentStock <= product.reorderLevel,
  );
  const outOfStockProducts = activeProducts.filter((product) => product.currentStock <= 0);

  const completedTransactions = transactions.filter((transaction) => transaction.status === 'completed');
  const todaySalesTotal = completedTransactions.reduce((sum, transaction) => sum + transaction.grandTotal, 0);
  const todayEstimatedProfit = completedTransactions.reduce(
    (sum, transaction) => sum + transaction.estimatedProfit,
    0,
  );
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const inventoryValueAtCost = activeProducts.reduce(
    (sum, product) => sum + product.costPrice * Math.max(0, product.currentStock),
    0,
  );
  const recentStockActivities = inventoryMovements.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-700/60 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 text-white shadow-xl sm:p-8 md:flex-row md:items-center">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <span>{settings.storeName} Operations Overview</span>
          </h2>
          <p className="text-sm text-slate-300">
            Real-time sales, inventory value, stock alerts, and recent inventory activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenPos}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30 transition-all hover:-translate-y-0.5 hover:bg-blue-500"
          >
            <ShoppingCart className="h-4 w-4 stroke-[2.5]" />
            <span>New Sale (POS)</span>
          </button>

          <button
            onClick={openAddProductModal}
            className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-slate-700 sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>

          <button
            onClick={onOpenInventory}
            className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-slate-700 sm:text-sm"
          >
            <RefreshCw className="h-4 w-4 text-blue-400" />
            <span>Manage Inventory</span>
          </button>
        </div>
      </div>

      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-start space-x-3 sm:items-center">
            <div className="shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 sm:text-base">
                Stock Attention Required ({lowStockProducts.length + outOfStockProducts.length} Items)
              </h3>
              <p className="mt-0.5 text-xs text-amber-700">
                {outOfStockProducts.length} items are out of stock and {lowStockProducts.length} items are below the low-stock threshold.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenInventory}
            className="flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-700 sm:self-auto"
          >
            <span>Open Inventory</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Today's Total Sales</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {settings.currencySymbol}
            {todaySalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-blue-600">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{completedTransactions.length} sales completed</span>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inventory Value</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {settings.currencySymbol}
            {inventoryValueAtCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500">Based on current stock and weighted unit cost</p>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Products & Alerts</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{activeProducts.length}</span>
            <span className="text-xs text-slate-500">Total Products</span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
              {lowStockProducts.length} Low
            </span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
              {outOfStockProducts.length} Out
            </span>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Expenses Recorded</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {settings.currencySymbol}
            {totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500">Operating expenses logged in the system</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">Recent Sales Transactions</h3>
            </div>
            <button
              onClick={onOpenSales}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400">
                  <th className="px-2 py-2.5">Receipt #</th>
                  <th className="px-2 py-2.5">Time</th>
                  <th className="px-2 py-2.5">Cashier</th>
                  <th className="px-2 py-2.5 text-center">Items</th>
                  <th className="px-2 py-2.5 text-right">Total</th>
                  <th className="px-2 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.slice(0, 5).map((transaction) => (
                  <tr key={transaction.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-2 py-3 font-mono font-semibold text-slate-900">{transaction.receiptNumber}</td>
                    <td className="px-2 py-3 text-xs text-slate-500">{transaction.timestamp}</td>
                    <td className="px-2 py-3">{transaction.cashierName}</td>
                    <td className="px-2 py-3 text-center">
                      {transaction.items.reduce((sum, item) => sum + item.quantity, 0)}
                    </td>
                    <td className="px-2 py-3 text-right font-bold text-slate-900">
                      {settings.currencySymbol}
                      {transaction.grandTotal.toFixed(2)}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          transaction.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {transaction.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Recent Stock Activities</h3>
          </div>

          <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
            {recentStockActivities.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No inventory movement has been recorded yet.
              </p>
            ) : (
              recentStockActivities.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">{movement.productName}</p>
                    <p className="text-slate-500">{formatMovementType(movement.movementType)}</p>
                    <p className="text-[11px] text-slate-400">{movement.timestamp}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        movement.quantityChanged >= 0 ? 'text-blue-700' : 'text-rose-700'
                      }`}
                    >
                      {movement.quantityChanged > 0 ? '+' : ''}
                      {movement.quantityChanged}
                    </p>
                    <p className="text-[11px] text-slate-500">{movement.newStock} on hand</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={onOpenInventory}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4 text-blue-400" />
            <span>Open Inventory Module</span>
          </button>
        </div>
      </div>
    </div>
  );
};
