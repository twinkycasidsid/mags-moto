import React, { useState } from 'react';
import { Product, Category, Supplier, StockAdjustment, StockReceivingRecord, User, StoreSettings } from '../types';
import {
  Search,
  RefreshCw,
  AlertTriangle,
  Plus,
  ArrowDownToLine,
  SlidersHorizontal,
  X,
  Trash2,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  adjustments: StockAdjustment[];
  receivingRecords?: StockReceivingRecord[];
  currentUser: User;
  settings: StoreSettings;
  onStockAdjustment: (adjustment: StockAdjustment) => void;
  onReceiveStock: (record: StockReceivingRecord) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categories,
  suppliers,
  adjustments,
  receivingRecords = [],
  currentUser,
  settings,
  onStockAdjustment,
  onReceiveStock,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'receive' | 'logs'>('overview');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Adjust Stock Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('remove');
  const [adjQuantity, setAdjQuantity] = useState<number>(1);
  const [reason, setReason] = useState<
    'damaged' | 'expired' | 'lost' | 'returned' | 'correction' | 'personal_use'
  >('damaged');
  const [notes, setNotes] = useState('');

  // Stock Receiving Delivery Form State
  const activeProducts = products.filter((p) => p.status === 'active');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [referenceNumber, setReferenceNumber] = useState(`DEL-${Date.now().toString().slice(-6)}`);
  const [receivingNotes, setReceivingNotes] = useState('');
  const [receivingItems, setReceivingItems] = useState<
    { productId: string; quantityReceived: number; unitCost: number }[]
  >([
    { productId: activeProducts[0]?.id || '', quantityReceived: 10, unitCost: activeProducts[0]?.costPrice || 100 },
  ]);

  const filteredProducts = activeProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);

    if (stockFilter === 'low') return matchesSearch && p.currentStock > 0 && p.currentStock <= p.reorderLevel;
    if (stockFilter === 'out') return matchesSearch && p.currentStock <= 0;
    return matchesSearch;
  });

  const handleOpenAdjustment = (product: Product) => {
    setSelectedProduct(product);
    setAdjustmentType('remove');
    setAdjQuantity(1);
    setReason('damaged');
    setNotes('');
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || adjQuantity <= 0) return;

    const previousStock = selectedProduct.currentStock;
    const newStock =
      adjustmentType === 'add' ? previousStock + adjQuantity : previousStock - adjQuantity;

    if (newStock < 0 && !settings.allowNegativeStock) {
      alert(`Cannot adjust stock below 0.`);
      return;
    }

    const adjustmentRecord: StockAdjustment = {
      id: `adj-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      adjustmentType,
      quantity: adjQuantity,
      reason,
      previousStock,
      newStock,
      notes,
      user: currentUser.name,
      timestamp: new Date().toLocaleString(),
    };

    onStockAdjustment(adjustmentRecord);
    alert(`Stock for "${selectedProduct.name}" adjusted from ${previousStock} to ${newStock}.`);
    setSelectedProduct(null);
  };

  // Receiving Delivery Handlers
  const handleAddReceivingLine = () => {
    setReceivingItems([
      ...receivingItems,
      {
        productId: activeProducts[0]?.id || '',
        quantityReceived: 10,
        unitCost: activeProducts[0]?.costPrice || 100,
      },
    ]);
  };

  const handleRemoveReceivingLine = (index: number) => {
    if (receivingItems.length <= 1) return;
    setReceivingItems(receivingItems.filter((_, i) => i !== index));
  };

  const handleReceivingItemChange = (index: number, field: string, value: any) => {
    const updated = [...receivingItems];
    if (field === 'productId') {
      const prod = activeProducts.find((p) => p.id === value);
      updated[index] = {
        ...updated[index],
        productId: value,
        unitCost: prod ? prod.costPrice : updated[index].unitCost,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setReceivingItems(updated);
  };

  const totalReceivingCost = receivingItems.reduce(
    (sum, item) => sum + item.quantityReceived * item.unitCost,
    0
  );

  const handleConfirmReceiving = (e: React.FormEvent) => {
    e.preventDefault();
    if (receivingItems.some((i) => i.quantityReceived <= 0)) {
      alert('Delivery items must have a quantity greater than 0.');
      return;
    }

    const supplier = suppliers.find((s) => s.id === supplierId);

    const record: StockReceivingRecord = {
      id: `rec-${Date.now()}`,
      referenceNumber,
      supplierId,
      supplierName: supplier?.name || 'Supplier',
      deliveryDate: new Date().toISOString().split('T')[0],
      items: receivingItems.map((item) => {
        const prod = activeProducts.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          productName: prod?.name || 'Product',
          quantityReceived: item.quantityReceived,
          unitCost: item.unitCost,
          totalCost: item.quantityReceived * item.unitCost,
        };
      }),
      totalAmount: totalReceivingCost,
      recordedBy: currentUser.name,
      timestamp: new Date().toLocaleString(),
      notes: receivingNotes,
    };

    onReceiveStock(record);
    alert(`Delivery invoice #${referenceNumber} confirmed! Inventory stock increased successfully.`);

    // Reset Form
    setReferenceNumber(`DEL-${Date.now().toString().slice(-6)}`);
    setReceivingNotes('');
    setReceivingItems([
      { productId: activeProducts[0]?.id || '', quantityReceived: 10, unitCost: activeProducts[0]?.costPrice || 100 },
    ]);
    setActiveSubTab('overview');
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-600" />
            <span>Unified Inventory Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor real-time stock levels, record stock deliveries, and log quantity adjustments.
          </p>
        </div>

        {/* Sub-module Toggle Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Stock Levels</span>
          </button>

          <button
            onClick={() => setActiveSubTab('receive')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'receive' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600" />
            <span>Receive Stock Delivery</span>
          </button>

          <button
            onClick={() => setActiveSubTab('logs')}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
            <span>Adjustment Logs ({adjustments.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Stock Levels Overview */}
      {activeSubTab === 'overview' && (
        <>
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search inventory by product name, SKU, or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStockFilter('all')}
                className={`px-3 py-2 rounded-xl font-bold ${
                  stockFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Products ({activeProducts.length})
              </button>
              <button
                onClick={() => setStockFilter('low')}
                className={`px-3 py-2 rounded-xl font-bold ${
                  stockFilter === 'low'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                Low Stock
              </button>
              <button
                onClick={() => setStockFilter('out')}
                className={`px-3 py-2 rounded-xl font-bold ${
                  stockFilter === 'out'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                Out of Stock
              </button>

              <button
                onClick={() => setActiveSubTab('receive')}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Receive Delivery</span>
              </button>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4">Product Name & Barcode</th>
                    <th className="py-3 px-4 text-center">Available Stock</th>
                    <th className="py-3 px-4 text-center">Reorder Level</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-right">Total Inventory Value</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredProducts.map((p) => {
                    const isLow = p.currentStock > 0 && p.currentStock <= p.reorderLevel;
                    const isOut = p.currentStock <= 0;
                    const totalVal = Math.max(0, p.currentStock) * p.sellingPrice;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            SKU: {p.sku} | Barcode: {p.barcode}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full font-bold text-xs ${
                              isOut
                                ? 'bg-rose-100 text-rose-800'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-50 text-blue-800'
                            }`}
                          >
                            {p.currentStock} {p.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                          {p.reorderLevel} {p.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {settings.currencySymbol}
                          {p.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {settings.currencySymbol}
                          {totalVal.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenAdjustment(p)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
                          >
                            Adjust Quantity
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Sub-Tab 2: Receive Stock Delivery Form */}
      {activeSubTab === 'receive' && (
        <form
          onSubmit={handleConfirmReceiving}
          className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-blue-600" />
                <span>Receive Stock Delivery / Stock-In</span>
              </h3>
              <p className="text-xs text-slate-500">
                Log items delivered by suppliers to increase inventory stock counts automatically.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Select Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.contactPerson})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Delivery Invoice / Reference # *</label>
              <input
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
              />
            </div>
          </div>

          {/* Delivered Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Delivered Items List
              </h4>
              <button
                type="button"
                onClick={handleAddReceivingLine}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product Row</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {receivingItems.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                >
                  <div className="col-span-5 space-y-0.5">
                    <label className="text-[10px] text-slate-400 font-semibold">Product</label>
                    <select
                      value={item.productId}
                      onChange={(e) => handleReceivingItemChange(index, 'productId', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold"
                    >
                      {activeProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3 space-y-0.5">
                    <label className="text-[10px] text-slate-400 font-semibold">Qty Delivered</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantityReceived}
                      onChange={(e) =>
                        handleReceivingItemChange(index, 'quantityReceived', parseInt(e.target.value) || 0)
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-3 space-y-0.5">
                    <label className="text-[10px] text-slate-400 font-semibold">
                      Unit Cost ({settings.currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) =>
                        handleReceivingItemChange(index, 'unitCost', parseFloat(e.target.value) || 0)
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-1 text-center pt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveReceivingLine(index)}
                      disabled={receivingItems.length <= 1}
                      className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Delivery Notes / Remarks</label>
              <textarea
                value={receivingNotes}
                onChange={(e) => setReceivingNotes(e.target.value)}
                placeholder="e.g. Received via courier express"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 h-16"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <p className="text-xs text-blue-800 font-bold">Total Delivery Value</p>
                <p className="text-[11px] text-blue-600">Stock counts will be updated instantly</p>
              </div>
              <p className="text-2xl font-black text-blue-700">
                {settings.currencySymbol}
                {totalReceivingCost.toFixed(2)}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setActiveSubTab('overview')}
                className="w-1/3 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-2/3 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm Delivery & Update Inventory</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Sub-Tab 3: Adjustment Logs */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Historical Inventory Adjustments & Stock Logs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="p-2.5">Date & Time</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5 text-center">Type</th>
                  <th className="p-2.5 text-center">Qty Adjusted</th>
                  <th className="p-2.5">Reason</th>
                  <th className="p-2.5">Adjusted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No stock adjustments logged yet.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono text-slate-500">{adj.timestamp}</td>
                      <td className="p-2.5 font-bold text-slate-900">{adj.productName}</td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            adj.adjustmentType === 'add'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {adj.adjustmentType}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-bold">{adj.quantity}</td>
                      <td className="p-2.5 capitalize text-slate-600">
                        {adj.reason.replace('_', ' ')}
                      </td>
                      <td className="p-2.5 text-slate-500">{adj.user}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Adjust Physical Stock</h3>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <p className="font-bold text-slate-900">{selectedProduct.name}</p>
              <p className="text-slate-500 font-mono">
                Current Stock: {selectedProduct.currentStock} {selectedProduct.unit}
              </p>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Action Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('add')}
                    className={`p-2 rounded-xl font-bold border ${
                      adjustmentType === 'add'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    + Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('remove')}
                    className={`p-2 rounded-xl font-bold border ${
                      adjustmentType === 'remove'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    - Deduct Stock
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjQuantity}
                    onChange={(e) => setAdjQuantity(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700"
                  >
                    <option value="damaged">Damaged / Defective</option>
                    <option value="lost">Lost / Missing</option>
                    <option value="returned">Customer Returned</option>
                    <option value="correction">Stock Count Correction</option>
                    <option value="personal_use">Shop Usage</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Physical inventory audit count"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="w-1/2 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md"
                >
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
