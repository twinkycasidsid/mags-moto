import React, { useEffect, useMemo, useState } from 'react';
import { User, StoreSettings } from '../types';
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  FolderTree,
  Receipt,
  DollarSign,
  BarChart3,
  Settings,
  RefreshCw,
  Wrench,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface HeaderProps {
  pathname: string;
  onNavigate: (path: string) => void;
  currentUser: User;
  settings: StoreSettings;
  lowStockCount: number;
  outOfStockCount: number;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  pathname,
  onNavigate,
  currentUser,
  settings,
  onLogout,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentUserName = currentUser.name.replace(/\s*\([^)]*\)/g, '').trim();
  const isAdmin = currentUser.role === 'admin';

  const navItems = useMemo(
    () =>
      isAdmin
        ? [
            { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/pos', label: 'Point of Sale (POS)', icon: ShoppingCart, highlight: true },
            { path: '/products', label: 'Products', icon: Package },
            { path: '/categories', label: 'Categories', icon: FolderTree },
            { path: '/inventory', label: 'Inventory', icon: RefreshCw },
            { path: '/sales', label: 'Sales History', icon: Receipt },
            { path: '/expenses', label: 'Expenses', icon: DollarSign },
            { path: '/reports', label: 'Reports', icon: BarChart3 },
            { path: '/settings', label: 'Settings', icon: Settings },
          ]
        : [
            { path: '/pos', label: 'Point of Sale (POS)', icon: ShoppingCart, highlight: true },
            { path: '/products', label: 'Products', icon: Package },
            { path: '/inventory', label: 'Inventory', icon: RefreshCw },
            { path: '/sales', label: 'Sales History', icon: Receipt },
          ],
    [isAdmin],
  );

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileMenuOpen]);

  const navButtonClass = (isActive: boolean, highlight?: boolean) =>
    `flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm ${
      isActive
        ? 'bg-blue-600 font-semibold text-white'
        : highlight
          ? 'border border-blue-500/30 bg-blue-950/40 text-blue-400 hover:bg-blue-900/60'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  const handleNavigate = (path: string) => {
    onNavigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-white shadow-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div
              className="flex min-w-0 cursor-pointer items-center space-x-3"
              onClick={() => handleNavigate(isAdmin ? '/dashboard' : '/pos')}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30">
                {settings.storeLogo ? (
                  <img
                    src={settings.storeLogo}
                    alt={settings.storeName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Wrench className="h-5 w-5 stroke-[2.5]" />
                )}
              </div>
              <div>
                <h1 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
                  {settings.storeName}
                </h1>
              </div>
            </div>

            <div className="hidden items-center rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-1.5 text-xs font-medium sm:text-sm lg:flex">
              <div className="flex items-center gap-2">
                <span className="max-w-32 truncate font-bold tracking-wide text-white">
                  {currentUserName}
                </span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                    currentUser.role === 'admin'
                      ? 'border-blue-500/40 bg-blue-600/30 text-blue-300'
                      : 'border-emerald-500/40 bg-emerald-600/30 text-emerald-300'
                  }`}
                >
                  {currentUser.role === 'admin' ? 'Admin' : 'Cashier'}
                </span>
              </div>
              <span className="mx-2.5 text-slate-500">|</span>
              <button
                onClick={onLogout}
                className="flex cursor-pointer items-center gap-1.5 font-bold text-rose-400 transition-colors hover:text-rose-300"
                title="Logout session"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="hidden border-t border-slate-800 lg:block">
            <nav className="flex items-center space-x-1 overflow-x-auto py-2 text-xs scrollbar-none sm:text-sm">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={navButtonClass(isActive, item.highlight)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close mobile menu overlay"
          />
          <div className="absolute inset-x-4 top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-2.5 text-sm font-medium">
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{currentUserName}</p>
                <p className="text-xs text-slate-400">
                  {currentUser.role === 'admin' ? 'Administrator' : 'Cashier'}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 font-bold text-rose-400 transition-colors hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>

            <nav className="grid gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className={`${navButtonClass(isActive, item.highlight)} w-full justify-start`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};
