import React, { useMemo, useState } from 'react';
import { Expense, StoreSettings, User } from '../types';
import { useFeedback } from './FeedbackProvider';
import { PaginationControls } from './PaginationControls';
import { DollarSign, Edit2, Plus, Trash2, X } from 'lucide-react';
import { parseSanitizedNumber, sanitizeNumericInput } from '../lib/numericInput';

interface ExpensesViewProps {
  expenses: Expense[];
  currentUser: User;
  settings: StoreSettings;
  onAddExpense: (expense: Expense) => Promise<void> | void;
  onEditExpense: (expense: Expense) => Promise<void> | void;
  onDeleteExpense: (expenseId: string) => Promise<void> | void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  currentUser,
  settings,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}) => {
  const { confirm, notify } = useFeedback();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [category, setCategory] = useState('');
  const [typeOfExpense, setTypeOfExpense] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [amountInput, setAmountInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null);

  const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date)),
    [expenses],
  );
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * 10;
    return sortedExpenses.slice(start, start + 10);
  }, [currentPage, sortedExpenses]);

  const resetForm = () => {
    setEditingExpense(null);
    setCategory('');
    setTypeOfExpense('');
    setAmount(0);
    setAmountInput('');
    setFormError(null);
    setFieldErrors({});
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setCategory(expense.category);
    setTypeOfExpense(expense.description);
    setAmount(expense.amount);
    setAmountInput(expense.amount.toString());
    setFormError(null);
    setFieldErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    const nextErrors: Record<string, string> = {};
    const normalizedCategory = category.trim().replace(/\s+/g, ' ');
    const normalizedType = typeOfExpense.trim().replace(/\s+/g, ' ');

    if (!normalizedCategory) {
      nextErrors.category = 'Expense category is required.';
    } else if (normalizedCategory.length > 120) {
      nextErrors.category = 'Expense category must be 120 characters or fewer.';
    }
    if (!normalizedType) {
      nextErrors.typeOfExpense = 'Type of expense is required.';
    } else if (normalizedType.length > 160) {
      nextErrors.typeOfExpense = 'Type of expense must be 160 characters or fewer.';
    }
    if (amount <= 0) {
      nextErrors.amount = 'Amount must be greater than zero.';
    } else if (amount > 100000000) {
      nextErrors.amount = 'Amount is too large.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please correct the highlighted fields.');
      return;
    }

    const expensePayload: Expense = {
      id: editingExpense ? editingExpense.id : `exp-${Date.now()}`,
      category: normalizedCategory,
      description: normalizedType,
      amount,
      date: editingExpense ? editingExpense.date : new Date().toISOString().split('T')[0],
      referenceNumber: editingExpense?.referenceNumber,
      recordedBy: editingExpense?.recordedBy ?? currentUser.name,
    };

    try {
      setIsSubmitting(true);
      if (editingExpense) {
        await onEditExpense(expensePayload);
        notify('Expense updated successfully.', 'success');
      } else {
        await onAddExpense(expensePayload);
        notify('Expense added successfully.', 'success');
      }
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentUser.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
            <DollarSign className="h-6 w-6 text-blue-600" />
            <span>Store Expenses</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Record and manage operating expenses to keep net profit reporting accurate.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-right">
            <p className="text-xs font-bold text-blue-800">Total Expenses Logged</p>
            <p className="text-xl font-black text-blue-700">
              {settings.currencySymbol}
              {totalExpense.toFixed(2)}
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-500"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Expense Category</th>
                <th className="px-4 py-3">Type of Expense</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Recorded By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No shop expenses logged yet.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3.5 font-mono text-slate-500">{expense.date}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{expense.category}</td>
                    <td className="px-4 py-3.5 text-slate-600">{expense.description}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      {settings.currencySymbol}
                      {expense.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{expense.recordedBy}</td>
                    <td className="space-x-1 px-4 py-3.5 text-right">
                      <button
                        onClick={() => openEditModal(expense)}
                        className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-200"
                        title="Edit Expense"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const approved = await confirm({
                            title: 'Delete expense entry?',
                            message: `This will permanently delete "${expense.description}". This action cannot be undone.`,
                            confirmLabel: 'Delete',
                            tone: 'danger',
                          });
                          if (!approved) {
                            return;
                          }
                          try {
                            setBusyExpenseId(expense.id);
                            await onDeleteExpense(expense.id);
                            notify('Expense deleted successfully.', 'success');
                          } catch (error) {
                            notify(
                              error instanceof Error ? error.message : 'Unable to delete expense.',
                              'error',
                            );
                          } finally {
                            setBusyExpenseId(null);
                          }
                        }}
                        disabled={busyExpenseId === expense.id}
                        className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50"
                        title="Delete Expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          currentPage={currentPage}
          totalItems={sortedExpenses.length}
          onPageChange={setCurrentPage}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </h3>
              <button onClick={closeModal} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Expense Category *</label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setFieldErrors((current) => ({ ...current, category: '' }));
                  }}
                  placeholder="e.g. Utilities"
                  maxLength={120}
                  className={`w-full rounded-xl border bg-slate-50 p-2.5 font-bold text-slate-900 ${
                    fieldErrors.category ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.category && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.category}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Type of Expense *</label>
                <input
                  type="text"
                  required
                  value={typeOfExpense}
                  onChange={(e) => {
                    setTypeOfExpense(e.target.value);
                    setFieldErrors((current) => ({ ...current, typeOfExpense: '' }));
                  }}
                  placeholder="e.g. Monthly Electricity Bill"
                  maxLength={160}
                  className={`w-full rounded-xl border bg-slate-50 p-2.5 font-bold text-slate-900 ${
                    fieldErrors.typeOfExpense ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.typeOfExpense && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.typeOfExpense}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Amount ({settings.currencySymbol}) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  required
                  value={amountInput}
                  onChange={(e) => {
                    const sanitizedValue = sanitizeNumericInput(e.target.value, {
                      allowDecimal: true,
                    });
                    setAmountInput(sanitizedValue);
                    setAmount(parseSanitizedNumber(sanitizedValue));
                    setFieldErrors((current) => ({ ...current, amount: '' }));
                  }}
                  className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                    fieldErrors.amount ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.amount && (
                  <p className="text-[11px] text-rose-600">{fieldErrors.amount}</p>
                )}
              </div>

              <div className="flex gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-1/2 rounded-xl bg-slate-100 py-2.5 font-bold text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 rounded-xl bg-blue-600 py-2.5 font-bold text-white shadow-md hover:bg-blue-500"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingExpense
                      ? 'Save Expense'
                      : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
