import React, { useMemo, useState } from 'react';
import {
  Category,
  InventoryMovement,
  Product,
  StockAdjustment,
  StockReceivingRecord,
  StoreSettings,
  User,
} from '../types';
import {
  ArrowDownToLine,
  ClipboardList,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useFeedback } from './FeedbackProvider';
import { parseSanitizedNumber, sanitizeNumericInput } from '../lib/numericInput';

interface InventoryViewProps {
  products: Product[];
  categories: Category[];
  inventoryMovements: InventoryMovement[];
  currentUser: User;
  settings: StoreSettings;
  onStockAdjustment: (adjustment: StockAdjustment) => Promise<void> | void;
  onReceiveStock: (record: StockReceivingRecord) => Promise<void> | void;
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

const formatAdjustmentReason = (reason: StockAdjustment['reason']) =>
  reason
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  categories,
  inventoryMovements,
  currentUser,
  settings,
  onStockAdjustment,
  onReceiveStock,
}) => {
  const { notify } = useFeedback();
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<Product | null>(null);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);

  const [quantityReceived, setQuantityReceived] = useState(1);
  const [quantityReceivedInput, setQuantityReceivedInput] = useState('1');
  const [totalPurchaseCost, setTotalPurchaseCost] = useState(0);
  const [totalPurchaseCostInput, setTotalPurchaseCostInput] = useState('');
  const [receivingNotes, setReceivingNotes] = useState('');
  const [stockInErrors, setStockInErrors] = useState<Record<string, string>>({});
  const [stockInFormError, setStockInFormError] = useState<string | null>(null);
  const [isSubmittingStockIn, setIsSubmittingStockIn] = useState(false);

  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('decrease');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(1);
  const [adjustmentQuantityInput, setAdjustmentQuantityInput] = useState('1');
  const [adjustmentReason, setAdjustmentReason] =
    useState<StockAdjustment['reason']>('damaged');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [adjustmentErrors, setAdjustmentErrors] = useState<Record<string, string>>({});
  const [adjustmentFormError, setAdjustmentFormError] = useState<string | null>(null);
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | InventoryMovement['movementType']>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'active'),
    [products],
  );

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase());
      const isLowStock = product.currentStock > 0 && product.currentStock <= product.reorderLevel;
      const isOutOfStock = product.currentStock <= 0;

      if (stockFilter === 'low') {
        return matchesSearch && isLowStock;
      }

      if (stockFilter === 'out') {
        return matchesSearch && isOutOfStock;
      }

      if (stockFilter === 'in') {
        return matchesSearch && product.currentStock > product.reorderLevel;
      }

      return matchesSearch;
    });
  }, [activeProducts, search, stockFilter]);

  const calculatedUnitCost =
    totalPurchaseCost > 0 && quantityReceived > 0
      ? Number((totalPurchaseCost / quantityReceived).toFixed(2))
      : 0;

  const newStockAfterAdjustment =
    selectedProductForAdjust == null
      ? 0
      : adjustmentType === 'increase'
        ? selectedProductForAdjust.currentStock + adjustmentQuantity
        : selectedProductForAdjust.currentStock - adjustmentQuantity;

  const historyRows = useMemo(() => {
    if (!selectedProductForHistory) {
      return [];
    }

    return inventoryMovements.filter((movement) => {
      if (movement.productId !== selectedProductForHistory.id) {
        return false;
      }

      if (historyTypeFilter !== 'all' && movement.movementType !== historyTypeFilter) {
        return false;
      }

      const movementDate = movement.occurredAt.slice(0, 10);
      if (historyStartDate && movementDate < historyStartDate) {
        return false;
      }

      if (historyEndDate && movementDate > historyEndDate) {
        return false;
      }

      return true;
    });
  }, [historyEndDate, historyStartDate, historyTypeFilter, inventoryMovements, selectedProductForHistory]);

  const resetAddStockForm = (product: Product) => {
    setSelectedProductForAdd(product);
    setQuantityReceived(1);
    setQuantityReceivedInput('1');
    setTotalPurchaseCost(0);
    setTotalPurchaseCostInput('');
    setReceivingNotes('');
    setStockInErrors({});
    setStockInFormError(null);
  };

  const resetAdjustmentForm = (product: Product) => {
    setSelectedProductForAdjust(product);
    setAdjustmentType('decrease');
    setAdjustmentQuantity(1);
    setAdjustmentQuantityInput('1');
    setAdjustmentReason('damaged');
    setAdjustmentNotes('');
    setAdjustmentErrors({});
    setAdjustmentFormError(null);
  };

  const handleSaveStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdd || isSubmittingStockIn) {
      return;
    }

    const nextErrors: Record<string, string> = {};
    if (quantityReceived <= 0) {
      nextErrors.quantityReceived = 'Quantity received must be greater than zero.';
    }

    if (totalPurchaseCost <= 0) {
      nextErrors.totalPurchaseCost = 'Total purchase cost must be greater than zero.';
    }

    if (receivingNotes.trim().length > 300) {
      nextErrors.notes = 'Notes must be 300 characters or fewer.';
    }

    setStockInErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStockInFormError('Please correct the highlighted fields.');
      return;
    }

    try {
      setIsSubmittingStockIn(true);
      await onReceiveStock({
        id: `rec-${Date.now()}`,
        referenceNumber: '',
        deliveryDate: '',
        totalAmount: totalPurchaseCost,
        recordedBy: currentUser.name,
        timestamp: new Date().toISOString(),
        notes: receivingNotes.trim(),
        items: [
          {
            productId: selectedProductForAdd.id,
            productName: selectedProductForAdd.name,
            quantityReceived,
            unitCost: calculatedUnitCost,
            totalCost: totalPurchaseCost,
          },
        ],
      });
      notify('Stock added successfully.', 'success');
      setSelectedProductForAdd(null);
    } catch (error) {
      setStockInFormError(error instanceof Error ? error.message : 'Unable to add stock.');
    } finally {
      setIsSubmittingStockIn(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust || isSubmittingAdjustment) {
      return;
    }

    const nextErrors: Record<string, string> = {};
    if (adjustmentQuantity <= 0) {
      nextErrors.quantity = 'Quantity must be greater than zero.';
    }

    if (!adjustmentReason) {
      nextErrors.reason = 'Reason is required.';
    }

    if (newStockAfterAdjustment < 0) {
      nextErrors.quantity = 'This adjustment would make stock negative.';
    }

    if (adjustmentNotes.trim().length > 300) {
      nextErrors.notes = 'Notes must be 300 characters or fewer.';
    }

    setAdjustmentErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setAdjustmentFormError('Please correct the highlighted fields.');
      return;
    }

    try {
      setIsSubmittingAdjustment(true);
      await onStockAdjustment({
        id: `adj-${Date.now()}`,
        productId: selectedProductForAdjust.id,
        productName: selectedProductForAdjust.name,
        adjustmentType,
        quantity: adjustmentQuantity,
        reason: adjustmentReason,
        previousStock: selectedProductForAdjust.currentStock,
        newStock: newStockAfterAdjustment,
        notes: adjustmentNotes.trim(),
        user: currentUser.name,
        timestamp: new Date().toISOString(),
      });
      notify('Inventory adjusted successfully.', 'success');
      setSelectedProductForAdjust(null);
    } catch (error) {
      setAdjustmentFormError(error instanceof Error ? error.message : 'Unable to save stock adjustment.');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            <span>Inventory Management</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage stock quantities, stock movements, inventory value, and stock status from one table.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search inventory by product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setStockFilter('all')}
            className={`rounded-xl px-3 py-2 font-bold ${
              stockFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => setStockFilter('in')}
            className={`rounded-xl px-3 py-2 font-bold ${
              stockFilter === 'in'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            In Stock
          </button>
          <button
            onClick={() => setStockFilter('low')}
            className={`rounded-xl px-3 py-2 font-bold ${
              stockFilter === 'low'
                ? 'bg-amber-500 text-slate-950'
                : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setStockFilter('out')}
            className={`rounded-xl px-3 py-2 font-bold ${
              stockFilter === 'out'
                ? 'bg-rose-600 text-white'
                : 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-center">Available Stock</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Selling Price</th>
                <th className="px-4 py-3 text-right">Inventory Value</th>
                <th className="px-4 py-3 text-center">Stock Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No inventory records found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const categoryName =
                    categories.find((category) => category.id === product.categoryId)?.name || 'Uncategorized';
                  const isLowStock =
                    product.currentStock > 0 && product.currentStock <= product.reorderLevel;
                  const isOutOfStock = product.currentStock <= 0;
                  const inventoryValue = Math.max(0, product.currentStock) * product.costPrice;
                  const stockStatus = isOutOfStock
                    ? 'Out of Stock'
                    : isLowStock
                      ? 'Low Stock'
                      : 'In Stock';

                  return (
                    <tr key={product.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900">{product.name}</p>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{categoryName}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-800'
                              : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-50 text-blue-800'
                          }`}
                        >
                          {product.currentStock} {product.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-500">
                        {settings.currencySymbol}
                        {product.costPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {settings.currencySymbol}
                        {product.sellingPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {settings.currencySymbol}
                        {inventoryValue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-800'
                              : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {stockStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                        {currentUser.role === 'admin' && (
                          <>
                            <button
                              onClick={() => resetAddStockForm(product)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => resetAdjustmentForm(product)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200"
                            >
                              Adjust
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedProductForHistory(product)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-200"
                        >
                          View
                        </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProductForAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ArrowDownToLine className="h-5 w-5 text-blue-600" />
                <span>Add Stock</span>
              </h3>
              <button onClick={() => setSelectedProductForAdd(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockIn} className="space-y-4 pt-4 text-xs">
              {stockInFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {stockInFormError}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{selectedProductForAdd.name}</p>
                <p className="mt-0.5 font-mono text-slate-500">Current Stock: {selectedProductForAdd.currentStock} {selectedProductForAdd.unit}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Quantity Received *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={quantityReceivedInput}
                    onChange={(e) => {
                      const sanitizedValue = sanitizeNumericInput(e.target.value);
                      setQuantityReceivedInput(sanitizedValue);
                      setQuantityReceived(parseSanitizedNumber(sanitizedValue));
                      setStockInErrors((current) => ({ ...current, quantityReceived: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                      stockInErrors.quantityReceived ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  />
                  {stockInErrors.quantityReceived && (
                    <p className="text-[11px] text-rose-600">{stockInErrors.quantityReceived}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Total Purchase Cost ({settings.currencySymbol}) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.]?[0-9]*"
                    required
                    value={totalPurchaseCostInput}
                    onChange={(e) => {
                      const sanitizedValue = sanitizeNumericInput(e.target.value, {
                        allowDecimal: true,
                      });
                      setTotalPurchaseCostInput(sanitizedValue);
                      setTotalPurchaseCost(parseSanitizedNumber(sanitizedValue));
                      setStockInErrors((current) => ({ ...current, totalPurchaseCost: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                      stockInErrors.totalPurchaseCost ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  />
                  {stockInErrors.totalPurchaseCost && (
                    <p className="text-[11px] text-rose-600">{stockInErrors.totalPurchaseCost}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Unit Cost (Auto)</label>
                <div className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 font-mono font-bold text-slate-700">
                  {settings.currencySymbol}
                  {calculatedUnitCost.toFixed(2)}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notes</label>
                <textarea
                  value={receivingNotes}
                  onChange={(e) => {
                    setReceivingNotes(e.target.value);
                    setStockInErrors((current) => ({ ...current, notes: '' }));
                  }}
                  maxLength={300}
                  placeholder="Optional receiving notes"
                  className={`h-20 w-full rounded-xl border bg-slate-50 p-2.5 text-slate-900 ${
                    stockInErrors.notes ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                <div className="flex items-center justify-between">
                  {stockInErrors.notes ? (
                    <p className="text-[11px] text-rose-600">{stockInErrors.notes}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[11px] text-slate-400">{receivingNotes.length}/300</p>
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedProductForAdd(null)}
                  className="w-1/2 rounded-xl bg-slate-100 py-2.5 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStockIn}
                  className="w-1/2 rounded-xl bg-blue-600 py-2.5 font-bold text-white shadow-md hover:bg-blue-500"
                >
                  {isSubmittingStockIn ? 'Saving...' : 'Save Stock Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedProductForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <SlidersHorizontal className="h-5 w-5 text-blue-600" />
                <span>Adjust Stock</span>
              </h3>
              <button onClick={() => setSelectedProductForAdjust(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <p className="font-bold text-slate-900">{selectedProductForAdjust.name}</p>
              <p className="mt-0.5 font-mono text-slate-500">
                Current Stock: {selectedProductForAdjust.currentStock} {selectedProductForAdjust.unit}
              </p>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 pt-4 text-xs">
              {adjustmentFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {adjustmentFormError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('increase')}
                    className={`rounded-xl border p-2 font-bold ${
                      adjustmentType === 'increase'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    Increase
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('decrease')}
                    className={`rounded-xl border p-2 font-bold ${
                      adjustmentType === 'decrease'
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    Decrease
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Quantity *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={adjustmentQuantityInput}
                    onChange={(e) => {
                      const sanitizedValue = sanitizeNumericInput(e.target.value);
                      setAdjustmentQuantityInput(sanitizedValue);
                      setAdjustmentQuantity(parseSanitizedNumber(sanitizedValue));
                      setAdjustmentErrors((current) => ({ ...current, quantity: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 p-2.5 font-bold text-slate-900 ${
                      adjustmentErrors.quantity ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  />
                  {adjustmentErrors.quantity && (
                    <p className="text-[11px] text-rose-600">{adjustmentErrors.quantity}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Reason *</label>
                  <select
                    value={adjustmentReason}
                    onChange={(e) => {
                      setAdjustmentReason(e.target.value as StockAdjustment['reason']);
                      setAdjustmentErrors((current) => ({ ...current, reason: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 p-2.5 font-bold text-slate-700 ${
                      adjustmentErrors.reason ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  >
                    <option value="damaged">Damaged</option>
                    <option value="lost">Lost</option>
                    <option value="returned">Returned</option>
                    <option value="physical_count_correction">Physical Count Correction</option>
                    <option value="shop_use">Shop Use</option>
                    <option value="encoding_error">Encoding Error</option>
                    <option value="other">Other</option>
                  </select>
                  {adjustmentErrors.reason && (
                    <p className="text-[11px] text-rose-600">{adjustmentErrors.reason}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Notes</label>
                <textarea
                  value={adjustmentNotes}
                  onChange={(e) => {
                    setAdjustmentNotes(e.target.value);
                    setAdjustmentErrors((current) => ({ ...current, notes: '' }));
                  }}
                  maxLength={300}
                  placeholder="Optional adjustment notes"
                  className={`h-20 w-full rounded-xl border bg-slate-50 p-2.5 text-slate-900 ${
                    adjustmentErrors.notes ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                <div className="flex items-center justify-between">
                  {adjustmentErrors.notes ? (
                    <p className="text-[11px] text-rose-600">{adjustmentErrors.notes}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[11px] text-slate-400">{adjustmentNotes.length}/300</p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-bold text-blue-800">Resulting Stock</p>
                <p className="mt-1 font-mono text-sm font-bold text-blue-900">
                  {selectedProductForAdjust.currentStock}{' '}
                  {adjustmentType === 'increase' ? '+' : '-'} {adjustmentQuantity} = {newStockAfterAdjustment}
                </p>
                <p className="mt-1 text-[11px] text-blue-700">
                  Reason: {formatAdjustmentReason(adjustmentReason)}
                </p>
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedProductForAdjust(null)}
                  className="w-1/2 rounded-xl bg-slate-100 py-2.5 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjustment}
                  className="w-1/2 rounded-xl bg-blue-600 py-2.5 font-bold text-white shadow-md hover:bg-blue-500"
                >
                  {isSubmittingAdjustment ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedProductForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                <span>Stock History: {selectedProductForHistory.name}</span>
              </h3>
              <button onClick={() => setSelectedProductForHistory(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Start Date</label>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">End Date</label>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Transaction Type</label>
                <select
                  value={historyTypeFilter}
                  onChange={(e) =>
                    setHistoryTypeFilter(
                      e.target.value as 'all' | InventoryMovement['movementType'],
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-bold text-slate-900"
                >
                  <option value="all">All Types</option>
                  <option value="stock_in">Stock In</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="sale">POS Sale</option>
                  <option value="sale_void">Sale Reversal</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setHistoryStartDate('');
                    setHistoryEndDate('');
                    setHistoryTypeFilter('all');
                  }}
                  className="w-full rounded-xl bg-slate-200 py-2.5 font-bold text-slate-700 hover:bg-slate-300"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Transaction Type</th>
                      <th className="px-4 py-3 text-center">Previous Stock</th>
                      <th className="px-4 py-3 text-center">Quantity Changed</th>
                      <th className="px-4 py-3 text-center">New Stock</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">Reference Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {historyRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No stock history found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      historyRows.map((movement) => (
                        <tr key={movement.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3.5 font-mono text-slate-500">{movement.timestamp}</td>
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {formatMovementType(movement.movementType)}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold">{movement.previousStock}</td>
                          <td className="px-4 py-3.5 text-center font-bold">
                            <span
                              className={
                                movement.quantityChanged >= 0 ? 'text-blue-700' : 'text-rose-700'
                              }
                            >
                              {movement.quantityChanged > 0 ? '+' : ''}
                              {movement.quantityChanged}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold">{movement.newStock}</td>
                          <td className="px-4 py-3.5">{movement.user}</td>
                          <td className="px-4 py-3.5 text-slate-600">{movement.notes || '—'}</td>
                          <td className="px-4 py-3.5 font-mono text-slate-500">
                            {movement.referenceNumber || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
