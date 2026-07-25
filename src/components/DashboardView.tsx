import React from 'react';
import { Product, Transaction, Expense, StoreSettings } from '../types';
import { ShoppingCart, DollarSign, Package, AlertTriangle, TrendingUp, Plus, ArrowDownToLine, Receipt, ArrowRight, ShieldAlert } from 'lucide-react';

interface DashboardViewProps {
  products: Product[];
  transactions: Transaction[];
  expenses: Expense[];
  settings: StoreSettings;
  setActiveTab: (tab: string) => void;
  openAddProductModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  transactions,
  expenses,
  settings,
  setActiveTab,
  openAddProductModal,
}) => {
  // Calculated Metrics
  const activeProducts = products.filter((p) => p.status === 'active');
  const lowStockProducts = activeProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel);
  const outOfStockProducts = activeProducts.filter((p) => p.currentStock <= 0);

  const completedTransactions = transactions.filter((t) => t.status === 'completed');
  const todaySalesTotal = completedTransactions.reduce((sum, t) => sum + t.grandTotal, 0);
  const todayEstimatedProfit = completedTransactions.reduce((sum, t) => sum + t.estimatedProfit, 0);

  const inventoryValueAtCost = activeProducts.reduce((sum, p) => sum + p.costPrice * Math.max(0, p.currentStock), 0);
  const inventoryValueAtSelling = activeProducts.reduce((sum, p) => sum + p.sellingPrice * Math.max(0, p.currentStock), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span>{settings.storeName} Operations Overview</span>
          </h2>
          <p className="text-slate-300 text-sm">
            Real-time shop sales, parts inventory stock, and cashier operations.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 transition-all transform hover:-translate-y-0.5"
          >
            <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
            <span>New Sale (POS)</span>
          </button>

          <button
            onClick={openAddProductModal}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Part / Item</span>
          </button>

          <button
            onClick={() => setActiveTab('stockin')}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 transition-all"
          >
            <ArrowDownToLine className="w-4 h-4 text-blue-400" />
            <span>Receive Stock</span>
          </button>
        </div>
      </div>

      {/* Low Stock & Out of Stock Alert Banner */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-sm sm:text-base">
                Stock Attention Required ({lowStockProducts.length + outOfStockProducts.length} Items)
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {outOfStockProducts.length} items out of stock and {lowStockProducts.length} items are below reorder level.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('inventory')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors shrink-0 self-start sm:self-auto flex items-center gap-1.5"
          >
            <span>View Low Stock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Today's Total Sales</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {settings.currencySymbol}{todaySalesTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center space-x-1.5 text-xs text-blue-600 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{completedTransactions.length} sales completed</span>
          </div>
        </div>

        {/* Today Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Estimated Gross Profit</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {settings.currencySymbol}{todayEstimatedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500">Based on parts cost records</p>
        </div>

        {/* Inventory Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inventory Retail Value</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {settings.currencySymbol}{inventoryValueAtSelling.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500">
            At cost: {settings.currencySymbol}{inventoryValueAtCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Stock Status Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Inventory Status</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{activeProducts.length}</span>
            <span className="text-xs text-slate-500">Total Motorcycle Parts</span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
              {lowStockProducts.length} Low
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
              {outOfStockProducts.length} Out
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Transactions & Quick Inventory Breakdown */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Sales Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base">Recent Sales Transactions</h3>
            </div>
            <button
              onClick={() => setActiveTab('sales')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold text-xs">
                  <th className="py-2.5 px-2">Receipt #</th>
                  <th className="py-2.5 px-2">Time</th>
                  <th className="py-2.5 px-2">Cashier</th>
                  <th className="py-2.5 px-2 text-center">Items</th>
                  <th className="py-2.5 px-2 text-right">Total</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.slice(0, 5).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-2 font-mono font-semibold text-slate-900">{tx.receiptNumber}</td>
                    <td className="py-3 px-2 text-xs text-slate-500">{tx.timestamp}</td>
                    <td className="py-3 px-2">{tx.cashierName}</td>
                    <td className="py-3 px-2 text-center">{tx.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="py-3 px-2 text-right font-bold text-slate-900">
                      {settings.currencySymbol}{tx.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          tx.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {tx.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Items Quick Action Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-base">Low Stock Parts Alert</h3>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {[...outOfStockProducts, ...lowStockProducts].length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">All motorcycle parts are sufficiently stocked!</p>
            ) : (
              [...outOfStockProducts, ...lowStockProducts].map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-slate-500">SKU: {item.sku} | Unit: {item.unit}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md font-bold text-[11px] ${
                        item.currentStock <= 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.currentStock <= 0 ? 'Out of Stock' : `${item.currentStock} left`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => setActiveTab('stockin')}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowDownToLine className="w-4 h-4 text-blue-400" />
            <span>Record Stock Delivery</span>
          </button>
        </div>
      </div>
    </div>
  );
};
