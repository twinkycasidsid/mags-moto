import React, { useState } from 'react';
import { Expense, User, StoreSettings } from '../types';
import { DollarSign } from 'lucide-react';

interface ExpensesViewProps {
  expenses: Expense[];
  currentUser: User;
  settings: StoreSettings;
  onAddExpense: (expense: Expense) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  currentUser,
  settings,
  onAddExpense,
}) => {
  const [category, setCategory] = useState('Utilities');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || amount <= 0) return;

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      category,
      description,
      amount,
      date: new Date().toISOString().split('T')[0],
      recordedBy: currentUser.name,
    };

    onAddExpense(newExp);
    setDescription('');
    setAmount(0);
  };

  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-blue-600" />
            <span>Store Overhead Expenses Manager</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record Mags Moto operating costs (electricity, rent, salaries, shop tools) to calculate net profit.
          </p>
        </div>

        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-right">
          <p className="text-xs text-blue-800 font-bold">Total Expenses Logged</p>
          <p className="text-xl font-black text-blue-700">
            {settings.currencySymbol}{totalExpense.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Record Expense Form */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Record Shop Expense</h3>
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Expense Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
              >
                <option value="Utilities">Utilities (Power, Water, Net)</option>
                <option value="Rent">Shop Rent</option>
                <option value="Salaries">Mechanic / Staff Salaries</option>
                <option value="Shop Supplies">Shop Supplies (Bags, Tools, Cleaning)</option>
                <option value="Repairs">Repairs & Maintenance</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Description / Details *</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Monthly Electricity Bill"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">Amount ({settings.currencySymbol}) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-900"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-colors"
            >
              Log Expense
            </button>
          </form>
        </div>

        {/* Expenses List */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Expense History Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5 text-right">Amount</th>
                  <th className="p-2.5">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No shop expenses logged yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="p-2.5 text-slate-500 font-mono">{exp.date}</td>
                      <td className="p-2.5 font-bold text-slate-900">{exp.category}</td>
                      <td className="p-2.5 text-slate-600">{exp.description}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {settings.currencySymbol}{exp.amount.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-slate-500">{exp.recordedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
