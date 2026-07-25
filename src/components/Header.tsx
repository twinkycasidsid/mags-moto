import React from 'react';
import { User, StoreSettings } from '../types';
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  Receipt,
  DollarSign,
  BarChart3,
  Settings,
  Shield,
  RefreshCw,
  Wrench,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  settings: StoreSettings;
  lowStockCount: number;
  outOfStockCount: number;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  settings,
  lowStockCount,
  outOfStockCount,
  onLogout,
}) => {
  const totalAlerts = lowStockCount + outOfStockCount;
  // Clean user name dynamically from active user session
  const currentUserName = currentUser.name.replace(/\s*\([^)]*\)/g, '').trim();

  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Store Name */}
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/30 overflow-hidden shrink-0">
              {settings.storeLogo ? (
                <img
                  src={settings.storeLogo}
                  alt={settings.storeName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Wrench className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                {settings.storeName}
              </h1>
            </div>
          </div>

          {/* Current User Name with Admin / Cashier Role Indicator | Logout Display */}
          <div className="flex items-center bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/80 space-x-2.5 text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white tracking-wide">{currentUserName}</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                currentUser.role === 'admin'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
              }`}>
                {currentUser.role === 'admin' ? 'Admin' : 'Cashier'}
              </span>
            </div>
            <span className="text-slate-500 font-normal">|</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
              title="Logout session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto py-2 border-t border-slate-800 scrollbar-none text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'pos'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-blue-400 bg-blue-950/40 border border-blue-500/30 hover:bg-blue-900/60'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Point of Sale (POS)</span>
          </button>

          {/* Products */}
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'products'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Products</span>
          </button>

          {/* Inventory */}
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Sales History</span>
          </button>

          {/* Admin Restricted Views */}
          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'expenses'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Expenses</span>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'reports'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Reports</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
