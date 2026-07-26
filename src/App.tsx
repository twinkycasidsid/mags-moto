import React, { useMemo, useState } from 'react';
import { BrowserRouter, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { POSView } from './components/POSView';
import { ProductManagementView } from './components/ProductManagementView';
import { CategoriesView } from './components/CategoriesView';
import { InventoryView } from './components/InventoryView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { ExpensesView } from './components/ExpensesView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { LoginPage } from './components/LoginPage';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { FeedbackProvider } from './components/FeedbackProvider';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { useAppData } from './hooks/useAppData';
import { supabase } from './lib/supabase';
import type { Product, StoreSettings, User } from './types';

const ADMIN_PATHS = new Set([
  '/dashboard',
  '/pos',
  '/products',
  '/categories',
  '/inventory',
  '/sales',
  '/expenses',
  '/reports',
  '/settings',
]);

const CASHIER_PATHS = new Set(['/pos', '/sales', '/products', '/inventory']);

const defaultUserSettings: StoreSettings = {
  storeName: 'Mags Moto',
  storeLogo: '/Mags%20Moto%20Logo.png',
  address: '',
  phone: '',
  email: '',
  currencySymbol: '₱',
  taxRate: 0,
  allowNegativeStock: false,
  receiptFooter: '',
};

const isUuid = (value?: string) =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const defaultRoute = (role: User['role']) => (role === 'admin' ? '/dashboard' : '/pos');

const LoadingScreen = ({ label }: { label: string }) => (
  <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
    <div className="text-center space-y-3">
      <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 mx-auto animate-spin" />
      <p className="text-sm font-semibold text-slate-300">{label}</p>
    </div>
  </div>
);

const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, loggingIn, login, logout } = useAuth();
  const accessToken = session?.access_token ?? null;
  const shouldLoadAdminUsers = location.pathname === '/settings';
  const {
    snapshot,
    publicSettings,
    loading,
    error,
    saveProduct,
    createCategory,
    updateCategory,
    setCategoryActive,
    deleteCategory,
    toggleArchiveProduct,
    deleteProduct,
    completeTransaction,
    voidTransaction,
    receiveStock,
    adjustStock,
    addExpense,
    updateExpense,
    deleteExpense,
    saveSettings,
    saveUser,
    toggleUserActive,
    deleteUser,
    resetUserPassword,
    recordSessionEvent,
  } = useAppData(profile, accessToken, { loadAdminUsers: shouldLoadAdminUsers });

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  const currentUser = useMemo<User | null>(() => {
    if (!profile) {
      return null;
    }

    return (
      snapshot.users.find((user) => user.id === profile.id) ?? {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        role: profile.role,
        active: profile.active,
        permissions:
          profile.role === 'admin'
            ? {
                canVoidSales: true,
                canEditProducts: true,
                canManageInventory: true,
                canViewReports: true,
                canManageExpenses: true,
              }
            : {
                canVoidSales: false,
                canEditProducts: false,
                canManageInventory: false,
                canViewReports: false,
                canManageExpenses: false,
              },
      }
    );
  }, [profile, snapshot.users]);

  const activeProducts = snapshot.products.filter((product) => product.status === 'active');
  const lowStockCount = activeProducts.filter(
    (product) => product.currentStock > 0 && product.currentStock <= product.reorderLevel,
  ).length;
  const outOfStockCount = activeProducts.filter((product) => product.currentStock <= 0).length;

  if (authLoading) {
    return <LoadingScreen label="Restoring session..." />;
  }

  if (!session || !profile || !currentUser) {
    if (location.pathname !== '/login') {
      return <Navigate to="/login" replace />;
    }

    return (
      <LoginPage
        settings={publicSettings}
        isSubmitting={loggingIn}
        onLogin={async (username, password) => {
          const loggedInProfile = await login(username, password);
          await supabase.rpc('record_session_event', { p_action: 'User Login' });
          navigate(defaultRoute(loggedInProfile.role), { replace: true });
        }}
      />
    );
  }

  if (location.pathname === '/login') {
    return <Navigate to={defaultRoute(profile.role)} replace />;
  }

  const allowedPaths = profile.role === 'admin' ? ADMIN_PATHS : CASHIER_PATHS;
  if (location.pathname === '/' || !allowedPaths.has(location.pathname)) {
    return <Navigate to={defaultRoute(profile.role)} replace />;
  }

  if (loading) {
    return <LoadingScreen label="Loading store data..." />;
  }

  const settings = snapshot.settings.storeName ? snapshot.settings : publicSettings ?? defaultUserSettings;

  const handleLogout = async () => {
    await recordSessionEvent('User Logout');
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSaveProduct = async (product: Product, totalPurchaseCost?: number) => {
    await saveProduct({
      id: isUuid(product.id) ? product.id : undefined,
      sku: product.sku || undefined,
      barcode: product.barcode || undefined,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      unit: product.unit,
      costPrice: product.costPrice,
      totalPurchaseCost,
      sellingPrice: product.sellingPrice,
      currentStock: product.currentStock,
      reorderLevel: product.reorderLevel,
      maxStock: product.maxStock,
      status: product.status,
    });
  };

  const renderPage = () => {
    switch (location.pathname) {
      case '/dashboard':
        return (
          <DashboardView
            products={snapshot.products}
            transactions={snapshot.transactions}
            expenses={snapshot.expenses}
            inventoryMovements={snapshot.inventoryMovements}
            settings={settings}
            onOpenPos={() => navigate('/pos')}
            onOpenSales={() => navigate('/sales')}
            onOpenInventory={() => navigate('/inventory')}
            openAddProductModal={() => {
              setIsAddProductModalOpen(true);
              navigate('/products');
            }}
          />
        );
      case '/pos':
        return (
          <POSView
            products={snapshot.products}
            categories={snapshot.categories}
            currentUser={currentUser}
            settings={settings}
            onCompleteTransaction={completeTransaction}
          />
        );
      case '/products':
        return (
          <ProductManagementView
            products={snapshot.products}
            categories={snapshot.categories}
            settings={settings}
            currentUser={currentUser}
            onSaveProduct={handleSaveProduct}
            onToggleArchiveProduct={toggleArchiveProduct}
            onDeleteProduct={deleteProduct}
            isAddModalOpen={isAddProductModalOpen}
            setIsAddModalOpen={setIsAddProductModalOpen}
          />
        );
      case '/categories':
        return (
          <CategoriesView
            categories={snapshot.categories}
            currentUser={currentUser}
            onCreateCategory={createCategory}
            onUpdateCategory={updateCategory}
            onSetCategoryActive={setCategoryActive}
            onDeleteCategory={deleteCategory}
          />
        );
      case '/inventory':
        return (
          <InventoryView
            products={snapshot.products}
            categories={snapshot.categories}
            inventoryMovements={snapshot.inventoryMovements}
            currentUser={currentUser}
            settings={settings}
            onStockAdjustment={adjustStock}
            onReceiveStock={receiveStock}
          />
        );
      case '/sales':
        return (
          <SalesHistoryView
            transactions={snapshot.transactions}
            currentUser={currentUser}
            settings={settings}
            onVoidTransaction={voidTransaction}
          />
        );
      case '/expenses':
        return (
          <ExpensesView
            expenses={snapshot.expenses}
            currentUser={currentUser}
            settings={settings}
            onAddExpense={async (expense) =>
              addExpense({
                category: expense.category,
                description: expense.description,
                amount: expense.amount,
                referenceNumber: expense.referenceNumber,
              })
            }
            onEditExpense={async (expense) =>
              updateExpense(expense.id, {
                category: expense.category,
                description: expense.description,
                amount: expense.amount,
                referenceNumber: expense.referenceNumber,
              })
            }
            onDeleteExpense={deleteExpense}
          />
        );
      case '/reports':
        return (
          <ReportsView
            transactions={snapshot.transactions}
            expenses={snapshot.expenses}
            products={snapshot.products}
            categories={snapshot.categories}
            settings={settings}
            currentUser={currentUser}
          />
        );
      case '/settings':
        return (
          <SettingsView
            settings={settings}
            users={snapshot.users}
            auditLogs={snapshot.auditLogs}
            currentUser={currentUser}
            onSaveSettings={saveSettings}
            onAddUser={async (user) =>
              saveUser({
                name: user.name,
                username: user.username,
                role: user.role,
                password: user.pin,
                active: user.active,
              })
            }
            onEditUser={async (user) =>
              saveUser({
                id: isUuid(user.id) ? user.id : undefined,
                name: user.name,
                username: user.username,
                role: user.role,
                password: user.pin || undefined,
                active: user.active,
              })
            }
            onToggleUserActive={async (userId) => {
              const targetUser = snapshot.users.find((user) => user.id === userId);
              if (!targetUser) {
                throw new Error('User not found.');
              }
              await toggleUserActive(userId, !targetUser.active);
            }}
            onDeleteUser={deleteUser}
            onResetUserPassword={resetUserPassword}
          />
        );
      default:
        return <Navigate to={defaultRoute(profile.role)} replace />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      <Header
        pathname={location.pathname}
        onNavigate={navigate}
        currentUser={currentUser}
        settings={settings}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
        onLogout={() => {
          void handleLogout();
        }}
      />

      <main className="mx-auto flex-1 w-full max-w-7xl space-y-4 p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <FeedbackProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </FeedbackProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}
