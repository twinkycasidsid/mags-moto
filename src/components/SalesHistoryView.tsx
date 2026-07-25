import React, { useState } from 'react';
import { Transaction, User, StoreSettings } from '../types';
import { Search, Receipt, AlertTriangle, Eye, X } from 'lucide-react';

interface SalesHistoryViewProps {
  transactions: Transaction[];
  currentUser: User;
  settings: StoreSettings;
  onVoidTransaction: (transactionId: string, reason: string) => void;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  transactions,
  currentUser,
  settings,
  onVoidTransaction,
}) => {
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [txToVoid, setTxToVoid] = useState<Transaction | null>(null);

  const filteredTransactions = transactions.filter(
    (t) =>
      t.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.cashierName.toLowerCase().includes(search.toLowerCase())
  );

  const openVoidModal = (tx: Transaction) => {
    if (currentUser.role !== 'admin') {
      alert('Only Store Owner / Admin can void completed sales.');
      return;
    }
    setTxToVoid(tx);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txToVoid || !voidReason) {
      alert('Please provide a mandatory reason for voiding this receipt.');
      return;
    }

    onVoidTransaction(txToVoid.id, voidReason);
    alert(`Receipt #${txToVoid.receiptNumber} voided. Restored product stock automatically.`);
    setIsVoidModalOpen(false);
    setTxToVoid(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600" />
            <span>Sales History & Receipt Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review completed checkouts or void sales with admin authorization.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search receipt # or cashier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4 text-center">Payment Method</th>
                <th className="py-3 px-4 text-right">Total Bill</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{tx.receiptNumber}</td>
                  <td className="py-3.5 px-4 text-slate-500 text-xs">{tx.timestamp}</td>
                  <td className="py-3.5 px-4 font-medium">{tx.cashierName}</td>
                  <td className="py-3.5 px-4 text-center capitalize font-semibold text-slate-600">
                    {tx.paymentMethod}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {settings.currencySymbol}{tx.grandTotal.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        tx.status === 'completed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {tx.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      title="View Receipt Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {tx.status === 'completed' && currentUser.role === 'admin' && (
                      <button
                        onClick={() => openVoidModal(tx)}
                        className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Receipt Details: {selectedTx.receiptNumber}
              </h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs space-y-2">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <p className="font-bold text-slate-900">{settings.storeName}</p>
                <p className="text-[10px] text-slate-500">{selectedTx.timestamp}</p>
                <p className="text-[10px] text-slate-500">Cashier: {selectedTx.cashierName}</p>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
                {selectedTx.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.quantity}x {item.productName}
                    </span>
                    <span>{settings.currencySymbol}{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-right font-sans pt-1">
                <div className="flex justify-between font-bold text-slate-900 text-sm">
                  <span>TOTAL:</span>
                  <span>{settings.currencySymbol}{selectedTx.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Authorization Modal */}
      {isVoidModalOpen && txToVoid && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-2 text-rose-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">
                Confirm Voiding Receipt #{txToVoid.receiptNumber}
              </h3>
            </div>

            <form onSubmit={handleConfirmVoid} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Voiding a transaction will restore item stock levels back to inventory and log an audit entry.
              </p>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Mandatory Void Reason *</label>
                <input
                  type="text"
                  required
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Cashier error, duplicate ring-up, customer changed mind"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
