import React, { useMemo, useState } from 'react';
import { Category, Product, StoreSettings, User } from '../types';
import { useFeedback } from './FeedbackProvider';
import { PaginationControls } from './PaginationControls';
import {
  Archive,
  Download,
  Edit2,
  Eye,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { parseSanitizedNumber, sanitizeNumericInput } from '../lib/numericInput';

interface ProductManagementViewProps {
  products: Product[];
  categories: Category[];
  settings: StoreSettings;
  currentUser: User;
  onSaveProduct: (
    product: Product,
    totalPurchaseCost?: number,
    options?: { allowBelowCost?: boolean },
  ) => Promise<void> | void;
  onToggleArchiveProduct: (productId: string) => Promise<void> | void;
  onDeleteProduct: (productId: string) => Promise<void> | void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

const calculateLowStockLevel = (stock: number) => Math.max(1, Math.ceil(Math.max(0, stock) * 0.3));

export const ProductManagementView: React.FC<ProductManagementViewProps> = ({
  products,
  categories,
  settings,
  currentUser,
  onSaveProduct,
  onToggleArchiveProduct,
  onDeleteProduct,
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const { confirm, notify } = useFeedback();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPurchaseCost, setTotalPurchaseCost] = useState<number>(0);
  const [totalPurchaseCostInput, setTotalPurchaseCostInput] = useState('');
  const [initialStockQuantity, setInitialStockQuantity] = useState<number>(1);
  const [initialStockQuantityInput, setInitialStockQuantityInput] = useState('1');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const activeCategories = categories.filter((category) => category.active !== false);
  const formatMoney = (value: number) => `${settings.currencySymbol}${value.toFixed(2)}`;

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    sku: '',
    categoryId: activeCategories[0]?.id || categories[0]?.id || '',
    unit: 'pc',
    costPrice: 0,
    sellingPrice: 0,
    currentStock: 0,
    reorderLevel: calculateLowStockLevel(1),
    status: 'active',
  });
  const [sellingPriceInput, setSellingPriceInput] = useState('');

  const lowStockLevel = useMemo(
    () => calculateLowStockLevel(editingProduct ? editingProduct.currentStock : initialStockQuantity),
    [editingProduct, initialStockQuantity],
  );
  const calculatedUnitCost = useMemo(() => {
    if (editingProduct) {
      return Number(formData.costPrice) || 0;
    }

    if (totalPurchaseCost <= 0 || initialStockQuantity <= 0) {
      return 0;
    }

    return Number((totalPurchaseCost / initialStockQuantity).toFixed(2));
  }, [editingProduct, formData.costPrice, initialStockQuantity, totalPurchaseCost]);
  const sellingPriceValue = Number(formData.sellingPrice) || 0;
  const unitCostDifference = Number((sellingPriceValue - calculatedUnitCost).toFixed(2));
  const isBreakEvenPricing = sellingPriceValue > 0 && calculatedUnitCost > 0 && unitCostDifference === 0;
  const isBelowCostPricing = sellingPriceValue > 0 && calculatedUnitCost > 0 && unitCostDifference < 0;

  const openAdd = () => {
    setFormError(null);
    setFieldErrors({});
    setEditingProduct(null);
    setTotalPurchaseCost(0);
    setTotalPurchaseCostInput('');
    setInitialStockQuantity(1);
    setInitialStockQuantityInput('1');
    setFormData({
      name: '',
      sku: '',
      categoryId: activeCategories[0]?.id || categories[0]?.id || '',
      unit: 'pc',
      costPrice: 0,
      sellingPrice: 0,
      currentStock: 0,
      reorderLevel: calculateLowStockLevel(1),
      status: 'active',
    });
    setSellingPriceInput('');
    setIsAddModalOpen(true);
  };

  const openEdit = (product: Product) => {
    setFormError(null);
    setFieldErrors({});
    setEditingProduct(product);
    setTotalPurchaseCost(0);
    setTotalPurchaseCostInput('');
    setInitialStockQuantity(product.currentStock);
    setInitialStockQuantityInput(product.currentStock.toString());
    setFormData(product);
    setSellingPriceInput(product.sellingPrice.toString());
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }
    const nextErrors: Record<string, string> = {};
    setFormError(null);
    const normalizedName = formData.name?.trim().replace(/\s+/g, ' ') ?? '';

    if (!normalizedName) {
      nextErrors.name = 'Product name is required.';
    } else if (normalizedName.length > 160) {
      nextErrors.name = 'Product name must be 160 characters or fewer.';
    }

    if (!formData.categoryId) {
      nextErrors.categoryId = 'Please select a category.';
    }

    if (!formData.unit?.trim()) {
      nextErrors.unit = 'Unit of measurement is required.';
    }

    if ((Number(formData.sellingPrice) || 0) < 0) {
      nextErrors.sellingPrice = 'Selling price cannot be negative.';
    } else if ((Number(formData.sellingPrice) || 0) === 0) {
      nextErrors.sellingPrice = 'Selling price must be greater than zero.';
    }

    if (!editingProduct) {
      if (totalPurchaseCost <= 0) {
        nextErrors.totalPurchaseCost = 'Total purchase cost must be greater than zero.';
      }

      if (initialStockQuantity <= 0) {
        nextErrors.initialStockQuantity = 'Initial stock quantity must be greater than zero.';
      }
    }

    const duplicateProduct = products.find(
      (product) =>
        product.id !== editingProduct?.id &&
        product.name.trim().toLowerCase() === normalizedName.toLowerCase(),
    );
    if (duplicateProduct) {
      nextErrors.name = 'A product with this name already exists.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please correct the highlighted fields.');
      return;
    }

    const productToSave: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      sku: editingProduct?.sku || formData.sku || '',
      name: normalizedName,
      description: editingProduct?.description ?? '',
      categoryId: formData.categoryId!,
      unit: formData.unit || 'pc',
      costPrice: editingProduct ? Number(formData.costPrice) || 0 : calculatedUnitCost,
      sellingPrice: Number(formData.sellingPrice) || 0,
      currentStock: editingProduct ? editingProduct.currentStock : initialStockQuantity,
      reorderLevel: editingProduct ? editingProduct.reorderLevel : lowStockLevel,
      status: formData.status || 'active',
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    try {
      setIsSubmitting(true);
      let allowBelowCost = false;
      if (productToSave.sellingPrice < productToSave.costPrice) {
        const lossPerUnit = Number((productToSave.costPrice - productToSave.sellingPrice).toFixed(2));
        const estimatedProfitOrLoss = Number((productToSave.sellingPrice - productToSave.costPrice).toFixed(2));
        const approved = await confirm({
          title: 'Selling Price Below Cost',
          message: `The selling price you entered (${formatMoney(productToSave.sellingPrice)}) is lower than the product's unit cost (${formatMoney(productToSave.costPrice)}).`,
          confirmLabel: 'Save Anyway',
          cancelLabel: 'Go Back',
          tone: 'warning',
          details: (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>Selling this product at this price will result in a loss of {formatMoney(lossPerUnit)} per unit.</p>
              <div className="mt-3 space-y-1 text-xs font-semibold">
                <div className="flex justify-between gap-4">
                  <span>Unit Cost</span>
                  <span>{formatMoney(productToSave.costPrice)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Selling Price</span>
                  <span>{formatMoney(productToSave.sellingPrice)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Loss per Unit</span>
                  <span>-{formatMoney(lossPerUnit)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-amber-200 pt-2 font-bold">
                  <span>Estimated Profit or Loss</span>
                  <span>-{formatMoney(Math.abs(estimatedProfitOrLoss))}</span>
                </div>
              </div>
            </div>
          ),
        });

        if (!approved) {
          setIsSubmitting(false);
          return;
        }

        allowBelowCost = true;
      }

      await onSaveProduct(productToSave, editingProduct ? undefined : totalPurchaseCost, {
        allowBelowCost,
      });
      notify(editingProduct ? 'Product updated successfully.' : 'Product created successfully.', 'success');
      setFormError(null);
      setFieldErrors({});
      setIsAddModalOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || product.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * 10;
    return filteredProducts.slice(start, start + 10);
  }, [currentPage, filteredProducts]);

  const handleExportCSV = () => {
    const headers = [
      'Product Name',
      'Category',
      'Unit',
      'Unit Cost',
      'Selling Price',
      'Number of Stocks',
      'Status',
    ];
    const rows = filteredProducts.map((product) => [
      `"${product.name.replace(/"/g, '""')}"`,
      categories.find((category) => category.id === product.categoryId)?.name || 'Uncategorized',
      product.unit,
      product.costPrice,
      product.sellingPrice,
      product.currentStock,
      product.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((entry) => entry.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mags_moto_products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openView = (product: Product) => {
    setViewingProduct(product);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <Package className="h-6 w-6 text-blue-600" />
            <span>Products Catalog</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Maintain product information, selling prices, unit costs, and product status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          {currentUser.role === 'admin' && (
            <button
              onClick={openAdd}
              className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-500"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'active' | 'archived' | 'all')}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700"
          >
            <option value="active">Active Items</option>
            <option value="archived">Archived Items</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="px-4 py-3">Product Details</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-center">Unit</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Selling Price</th>
                <th className="px-4 py-3 text-center">Number of Stocks</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No products found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => {
                  const categoryName =
                    categories.find((category) => category.id === product.categoryId)?.name || 'Uncategorized';

                  return (
                    <tr key={product.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900">{product.name}</p>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{categoryName}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-600">{product.unit}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-slate-500">
                        {settings.currencySymbol}
                        {product.costPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                        {settings.currencySymbol}
                        {product.sellingPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                        {product.currentStock}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            product.status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {product.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="space-x-1 px-4 py-3.5 text-right">
                        <button
                          onClick={() => openView(product)}
                          className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                          title="View Product"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {currentUser.role === 'admin' && (
                          <>
                            <button
                              onClick={() => openEdit(product)}
                              className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                              title="Edit Product"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  setBusyProductId(product.id);
                                  await onToggleArchiveProduct(product.id);
                                  notify(
                                    product.status === 'active'
                                      ? 'Product archived successfully.'
                                      : 'Product restored successfully.',
                                    'success',
                                  );
                                } catch (error) {
                                  notify(
                                    error instanceof Error
                                      ? error.message
                                      : 'Unable to update product status.',
                                    'error',
                                  );
                                } finally {
                                  setBusyProductId(null);
                                }
                              }}
                              disabled={busyProductId === product.id}
                              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title={product.status === 'active' ? 'Archive Product' : 'Restore Product'}
                            >
                              {product.status === 'active' ? (
                                <Archive className="h-4 w-4" />
                              ) : (
                                <RotateCcw className="h-4 w-4 text-blue-600" />
                              )}
                            </button>
                            <button
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: `Delete ${product.name}?`,
                                  message:
                                    'This permanently removes the product. Deletion only succeeds if it has no sales or inventory history.',
                                  confirmLabel: 'Delete',
                                  tone: 'danger',
                                });
                                if (!confirmed) {
                                  return;
                                }

                                try {
                                  setBusyProductId(product.id);
                                  await onDeleteProduct(product.id);
                                  notify('Product deleted successfully.', 'success');
                                } catch (error) {
                                  notify(
                                    error instanceof Error ? error.message : 'Unable to delete product.',
                                    'error',
                                  );
                                } finally {
                                  setBusyProductId(null);
                                }
                              }}
                              disabled={busyProductId === product.id}
                              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                              title="Delete Product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalItems={filteredProducts.length}
          onPageChange={setCurrentPage}
        />
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Product Information' : 'Add Product'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setFormError(null);
                  setFieldErrors({});
                }}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 pt-4 text-xs">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setFieldErrors((current) => ({ ...current, name: '' }));
                  }}
                  maxLength={160}
                  placeholder="e.g. Premium Stainless Water Bottle"
                  className={`w-full rounded-xl border bg-slate-50 p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    fieldErrors.name ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.name && <p className="text-[11px] text-rose-600">{fieldErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Category *</label>
                  <select
                    value={formData.categoryId || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, categoryId: e.target.value });
                      setFieldErrors((current) => ({ ...current, categoryId: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 p-2.5 font-bold text-slate-900 ${
                      fieldErrors.categoryId ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  >
                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.categoryId && (
                    <p className="text-[11px] text-rose-600">{fieldErrors.categoryId}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unit of Measurement</label>
                  <select
                    value={formData.unit || 'pc'}
                    onChange={(e) => {
                      setFormData({ ...formData, unit: e.target.value });
                      setFieldErrors((current) => ({ ...current, unit: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 p-2.5 font-bold text-slate-900 ${
                      fieldErrors.unit ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  >
                    <option value="pc">Piece (pc)</option>
                    <option value="set">Set</option>
                    <option value="pair">Pair</option>
                    <option value="bottle">Bottle</option>
                    <option value="can">Can</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                  </select>
                  {fieldErrors.unit && <p className="text-[11px] text-rose-600">{fieldErrors.unit}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {editingProduct ? 'Stored Unit Cost' : `Total Purchase Cost (${settings.currencySymbol}) *`}
                  </label>
                  {editingProduct ? (
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 font-mono font-bold text-slate-700">
                      {settings.currencySymbol}
                      {(Number(formData.costPrice) || 0).toFixed(2)}
                    </div>
                  ) : (
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
                        setFieldErrors((current) => ({ ...current, totalPurchaseCost: '' }));
                      }}
                      placeholder="e.g. 3000.00"
                      className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                        fieldErrors.totalPurchaseCost ? 'border-rose-300' : 'border-slate-200'
                      }`}
                    />
                  )}
                  {fieldErrors.totalPurchaseCost && (
                    <p className="text-[11px] text-rose-600">{fieldErrors.totalPurchaseCost}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    Selling Price per Unit ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.]?[0-9]*"
                    required
                    value={sellingPriceInput}
                    onChange={(e) => {
                      const sanitizedValue = sanitizeNumericInput(e.target.value, {
                        allowDecimal: true,
                      });
                      setSellingPriceInput(sanitizedValue);
                      setFormData({
                        ...formData,
                        sellingPrice: parseSanitizedNumber(sanitizedValue),
                      });
                      setFieldErrors((current) => ({ ...current, sellingPrice: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                      fieldErrors.sellingPrice ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  />
                  {fieldErrors.sellingPrice && (
                    <p className="text-[11px] text-rose-600">{fieldErrors.sellingPrice}</p>
                  )}
                  {!fieldErrors.sellingPrice && isBelowCostPricing && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      Warning: this price is below the unit cost by {formatMoney(Math.abs(unitCostDifference))} per unit. Saving will require confirmation.
                    </div>
                  )}
                  {!fieldErrors.sellingPrice && isBreakEvenPricing && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      Warning: This product will generate no profit because the selling price is equal to the unit cost.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">
                    {editingProduct ? 'Current Stock (Read-only)' : 'Initial Stock Quantity *'}
                  </label>
                  {editingProduct ? (
                    <div className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 font-mono font-bold text-slate-700">
                      {editingProduct.currentStock} {editingProduct.unit}
                    </div>
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={initialStockQuantityInput}
                      onChange={(e) => {
                        const sanitizedValue = sanitizeNumericInput(e.target.value);
                        setInitialStockQuantityInput(sanitizedValue);
                        setInitialStockQuantity(parseSanitizedNumber(sanitizedValue));
                        setFieldErrors((current) => ({ ...current, initialStockQuantity: '' }));
                      }}
                      className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                        fieldErrors.initialStockQuantity ? 'border-rose-300' : 'border-slate-200'
                      }`}
                    />
                  )}
                  {fieldErrors.initialStockQuantity && (
                    <p className="text-[11px] text-rose-600">{fieldErrors.initialStockQuantity}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Unit Cost (Auto)</label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 font-mono font-bold text-slate-700">
                    {settings.currencySymbol}
                    {calculatedUnitCost.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setFormError(null);
                    setFieldErrors({});
                  }}
                  className="w-1/2 rounded-xl bg-slate-100 py-2.5 font-bold text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 rounded-xl bg-blue-600 py-2.5 font-bold text-white shadow-md hover:bg-blue-500"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Product Information</h3>
              <button
                onClick={() => setViewingProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 pt-4 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-slate-900">{viewingProduct.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category</p>
                  <p className="mt-1 font-bold text-slate-900">
                    {categories.find((category) => category.id === viewingProduct.categoryId)?.name || 'Uncategorized'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unit</p>
                  <p className="mt-1 font-bold text-slate-900">{viewingProduct.unit}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unit Cost</p>
                  <p className="mt-1 font-mono font-bold text-slate-900">
                    {settings.currencySymbol}
                    {viewingProduct.costPrice.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Selling Price</p>
                  <p className="mt-1 font-mono font-bold text-slate-900">
                    {settings.currencySymbol}
                    {viewingProduct.sellingPrice.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Number of Stocks</p>
                  <p className="mt-1 font-bold text-slate-900">{viewingProduct.currentStock}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</p>
                  <p className="mt-1 font-bold text-slate-900">{viewingProduct.status.toUpperCase()}</p>
                </div>
              </div>

              <button
                onClick={() => setViewingProduct(null)}
                className="w-full rounded-xl bg-slate-100 py-2.5 font-bold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
