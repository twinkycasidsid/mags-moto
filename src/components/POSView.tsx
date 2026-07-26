import React, { useState } from 'react';
import { Product, Category, CartItem, PaymentMethod, Transaction, User, StoreSettings, SaleCheckoutInput } from '../types';
import { useFeedback } from './FeedbackProvider';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, DollarSign, Check, X } from 'lucide-react';
import { sanitizeNumericInput } from '../lib/numericInput';

interface POSViewProps {
  products: Product[];
  categories: Category[];
  currentUser: User;
  settings: StoreSettings;
  onCompleteTransaction: (transaction: SaleCheckoutInput) => Promise<Transaction>;
}

export const POSView: React.FC<POSViewProps> = ({
  products,
  categories,
  currentUser,
  settings,
  onCompleteTransaction,
}) => {
  const { confirm, notify } = useFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Checkout Modal state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [checkoutErrors, setCheckoutErrors] = useState<Record<string, string>>({});
  const [checkoutFormError, setCheckoutFormError] = useState<string | null>(null);
  
  // Completed Receipt Modal state
  const [lastCompletedTx, setLastCompletedTx] = useState<Transaction | null>(null);

  // Filter active products
  const activeProducts = products.filter((p) => p.status === 'active');
  const filteredProducts = activeProducts.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.currentStock <= 0 && !settings.allowNegativeStock) {
      notify(`Cannot add "${product.name}" because it is out of stock.`, 'error');
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock && !settings.allowNegativeStock) {
          notify(`Only ${product.currentStock} item(s) are available for "${product.name}".`, 'error');
          return prevCart;
        }
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.currentStock && !settings.allowNegativeStock) {
              notify(`Only ${item.product.currentStock} item(s) are available in stock.`, 'error');
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
  const totalCost = cart.reduce((sum, item) => sum + item.product.costPrice * item.quantity, 0);

  // Checkout process
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setAmountReceived(subtotal.toFixed(2));
    setDiscountAmount('');
    setPaymentMethod('cash');
    setCheckoutErrors({});
    setCheckoutFormError(null);
    setIsCheckoutOpen(true);
  };

  const handleProcessSale = async () => {
    if (isProcessingSale) {
      return;
    }

    const receivedNum = parseFloat(amountReceived) || 0;
    const discountVal = Math.max(0, parseFloat(discountAmount) || 0);
    const netTotal = Math.max(0, subtotal - discountVal);
    const nextErrors: Record<string, string> = {};

    if (cart.length === 0) {
      setCheckoutFormError('Cart is empty.');
      return;
    }

    if (discountAmount && Number.isNaN(parseFloat(discountAmount))) {
      nextErrors.discountAmount = 'Discount amount must be a valid number.';
    } else if (discountVal >= subtotal && subtotal > 0) {
      nextErrors.discountAmount = 'Discount must be less than the subtotal.';
    }

    if (!amountReceived.trim()) {
      nextErrors.amountReceived = 'Amount received is required.';
    } else if (Number.isNaN(parseFloat(amountReceived))) {
      nextErrors.amountReceived = 'Amount received must be a valid number.';
    } else if (receivedNum < netTotal) {
      nextErrors.amountReceived = `Amount received must be at least ${settings.currencySymbol}${netTotal.toFixed(2)}.`;
    }

    setCheckoutErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setCheckoutFormError('Please correct the highlighted fields.');
      return;
    }

    setCheckoutFormError(null);
    setIsProcessingSale(true);
    try {
      const transaction = await onCompleteTransaction({
        paymentMethod,
        amountReceived: receivedNum,
        discountTotal: discountVal,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      setLastCompletedTx(transaction);
      setIsCheckoutOpen(false);
      clearCart();
      notify('Sale completed successfully.', 'success');
    } catch (error) {
      setCheckoutFormError(error instanceof Error ? error.message : 'Unable to complete sale.');
    } finally {
      setIsProcessingSale(false);
    }
  };

  const discountVal = Math.max(0, parseFloat(discountAmount) || 0);
  const netTotal = Math.max(0, subtotal - discountVal);
  const receivedNum = parseFloat(amountReceived) || 0;
  const calculatedChange = Math.max(0, receivedNum - netTotal);

  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Catalog & Motorcycle Parts (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search & Category Header */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search part name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories ({activeProducts.length})
            </button>
            {categories.map((cat) => {
              const count = activeProducts.filter((p) => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
          {filteredProducts.map((p) => {
            const isOutOfStock = p.currentStock <= 0;
            const isLowStock = p.currentStock > 0 && p.currentStock <= p.reorderLevel;

            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={isOutOfStock && !settings.allowNegativeStock}
                className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2 relative group ${
                  isOutOfStock && !settings.allowNegativeStock
                    ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span />
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                        isOutOfStock
                          ? 'bg-rose-100 text-rose-800'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {p.currentStock} {p.unit}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 mt-1">{p.name}</h4>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between w-full">
                  <span className="text-sm font-extrabold text-blue-600">
                    {settings.currencySymbol}{p.sellingPrice.toFixed(2)}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center transition-colors">
                    <Plus className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Active Cart & Checkout (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-md p-5 space-y-4 sticky top-20">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">Current Cart ({cart.length})</h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={async () => {
                const approved = await confirm({
                  title: 'Clear current cart?',
                  message: 'This removes all items from the current sale.',
                  confirmLabel: 'Clear Cart',
                  tone: 'danger',
                });
                if (approved) {
                  clearCart();
                  notify('Cart cleared.', 'info');
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Cart</span>
            </button>
          )}
        </div>

        {/* Cart Item List */}
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ShoppingCart className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-xs font-medium">Cart is empty. Click any part or product on the left to add.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
              >
                <div className="space-y-0.5 max-w-[160px]">
                  <p className="font-bold text-slate-900 truncate">{item.product.name}</p>
                  <p className="text-slate-500 font-mono">
                    {settings.currencySymbol}{item.product.sellingPrice.toFixed(2)} / {item.product.unit}
                  </p>
                </div>

                {/* Qty Controls */}
                <div className="flex items-center space-x-1.5 bg-white rounded-lg border border-slate-200 p-1">
                  <button
                    onClick={() => updateQuantity(item.product.id, -1)}
                    className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-slate-900 w-5 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, 1)}
                    className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right">
                  <p className="font-extrabold text-slate-900">
                    {settings.currencySymbol}{(item.product.sellingPrice * item.quantity).toFixed(2)}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-[10px] text-rose-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order Summary */}
        {cart.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-200">
              <span>Total Amount</span>
              <span className="text-blue-600">{settings.currencySymbol}{subtotal.toFixed(2)}</span>
            </div>

            <button
              onClick={handleOpenCheckout}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
              <span>Complete Payment ({settings.currencySymbol}{subtotal.toFixed(2)})</span>
            </button>
          </div>
        )}
      </div>

      {/* Checkout Payment Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <span>Process Payment</span>
              </h3>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {checkoutFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {checkoutFormError}
                </div>
              )}

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center space-y-1">
                <p className="text-xs text-blue-800 font-medium">Subtotal Due</p>
                <p className="text-3xl font-black text-blue-700">
                  {settings.currencySymbol}{subtotal.toFixed(2)}
                </p>
                {discountVal > 0 && (
                  <p className="text-xs font-bold text-blue-800">
                    Net Total After Discount: {settings.currencySymbol}{netTotal.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Payment Method Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Payment Method</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'gcash', label: 'GCash' },
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        paymentMethod === pm.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Received Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Amount Received</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-400">
                    {settings.currencySymbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.]?[0-9]*"
                    value={amountReceived}
                    onChange={(e) => {
                      setAmountReceived(
                        sanitizeNumericInput(e.target.value, { allowDecimal: true }),
                      );
                      setCheckoutErrors((current) => ({ ...current, amountReceived: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 py-2.5 pl-8 pr-4 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                      checkoutErrors.amountReceived
                        ? 'border-rose-300 focus:ring-rose-400'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                </div>
                {checkoutErrors.amountReceived && (
                  <p className="text-[11px] text-rose-600">{checkoutErrors.amountReceived}</p>
                )}
              </div>

              {/* Optional Discount Field below Amount Received */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Discount Amount</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2 font-bold text-slate-400 text-xs">
                    {settings.currencySymbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.]?[0-9]*"
                    placeholder="0.00"
                    value={discountAmount}
                    onChange={(e) => {
                      setDiscountAmount(
                        sanitizeNumericInput(e.target.value, { allowDecimal: true }),
                      );
                      setCheckoutErrors((current) => ({ ...current, discountAmount: '' }));
                    }}
                    className={`w-full rounded-xl border bg-slate-50 py-2 pl-8 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                      checkoutErrors.discountAmount
                        ? 'border-rose-300 focus:ring-rose-400'
                        : 'border-slate-200 focus:ring-blue-500'
                    }`}
                  />
                </div>
                {checkoutErrors.discountAmount && (
                  <p className="text-[11px] text-rose-600">{checkoutErrors.discountAmount}</p>
                )}
              </div>

              {/* Change Calculation */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600">Calculated Change:</span>
                <span className="font-extrabold text-sm text-slate-900">
                  {settings.currencySymbol}{calculatedChange.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  if (!isProcessingSale) {
                    setIsCheckoutOpen(false);
                  }
                }}
                disabled={isProcessingSale}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessSale}
                disabled={isProcessingSale}
                className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md"
              >
                {isProcessingSale ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Completed Receipt Modal */}
      {lastCompletedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Transaction Completed!</h3>
              <p className="text-xs text-slate-500">{lastCompletedTx.timestamp}</p>
            </div>

            {/* Receipt Summary View */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs space-y-2">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <p className="font-bold text-slate-900 text-sm">{settings.storeName}</p>
                <p className="text-[10px] font-bold text-slate-700 mt-1">Receipt #: {lastCompletedTx.receiptNumber}</p>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
                {lastCompletedTx.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.quantity}x {item.productName.slice(0, 16)}
                    </span>
                    <span>{settings.currencySymbol}{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-right font-sans pt-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{settings.currencySymbol}{lastCompletedTx.subtotal.toFixed(2)}</span>
                </div>
                {lastCompletedTx.discountTotal > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Discount:</span>
                    <span>-{settings.currencySymbol}{lastCompletedTx.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span>{settings.currencySymbol}{lastCompletedTx.grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                  <span>Paid ({lastCompletedTx.paymentMethod.toUpperCase()}):</span>
                  <span>{settings.currencySymbol}{lastCompletedTx.amountReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-blue-600">
                  <span>Change:</span>
                  <span>{settings.currencySymbol}{lastCompletedTx.changeGiven.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setLastCompletedTx(null)}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
