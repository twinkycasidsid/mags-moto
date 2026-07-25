import React, { useState } from 'react';
import {
  initialSettings,
  initialUsers,
  initialCategories,
  initialSuppliers,
  initialProducts,
  initialTransactions,
  initialExpenses,
  initialAuditLogs,
} from './data/mockData';
import {
  Product,
  Category,
  Supplier,
  Transaction,
  Expense,
  StockAdjustment,
  StockReceivingRecord,
  StoreSettings,
  User,
  AuditLog,
} from './types';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { POSView } from './components/POSView';
import { ProductManagementView } from './components/ProductManagementView';
import { InventoryView } from './components/InventoryView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { ExpensesView } from './components/ExpensesView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { KeyRound, Shield, LogIn, X } from 'lucide-react';
import { LoginPage } from './components/LoginPage';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [settings, setSettings] = useState<StoreSettings>(initialSettings);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [currentUser, setCurrentUser] = useState<User>(initialUsers[0]); // Default to Store Owner
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);

  const [categories] = useState<Category[]>(initialCategories);
  const [suppliers] = useState<Supplier[]>(initialSuppliers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  // Helper to record audit log
  const addAuditLog = (action: string, affectedRecord: string, details: string) => {
    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      userName: currentUser ? currentUser.name : 'System',
      action,
      affectedRecord,
      details,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // 1. Logout Handler -> Direct to Login Page
  const handleLogout = () => {
    addAuditLog('User Logout', 'Session', `User ${currentUser.name} logged out from the system`);
    setIsLoggedIn(false);
  };

  // 2. Login Handler
  const handleLoginSuccess = (loggedInUser: User) => {
    setCurrentUser(loggedInUser);
    setIsLoggedIn(true);

    const timestamp = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const loginLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp,
      userName: loggedInUser.name,
      action: 'User Login',
      affectedRecord: 'Session',
      details: `User ${loggedInUser.name} (${loggedInUser.role.toUpperCase()}) logged into system`,
    };
    setAuditLogs((prev) => [loginLog, ...prev]);
  };

  // 3. Save or Edit Product
  const handleSaveProduct = (savedProduct: Product) => {
    const isNew = !products.some((p) => p.id === savedProduct.id);

    setProducts((prev) => {
      if (!isNew) {
        return prev.map((p) => (p.id === savedProduct.id ? savedProduct : p));
      }
      return [savedProduct, ...prev];
    });

    addAuditLog(
      isNew ? 'Product Added' : 'Product Edited',
      savedProduct.name,
      `SKU: ${savedProduct.sku} | Price: ₱${savedProduct.sellingPrice.toFixed(2)} | Stock: ${savedProduct.currentStock}`
    );
  };

  // 4. Archive or Restore Product
  const handleToggleArchiveProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const nextStatus = prod.status === 'active' ? 'archived' : 'active';

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          return { ...p, status: nextStatus };
        }
        return p;
      })
    );

    addAuditLog(
      nextStatus === 'archived' ? 'Product Archived' : 'Product Restored',
      prod.name,
      `Changed status to ${nextStatus}`
    );
  };

  // 5. Complete Sale (POS) -> Reduce stock automatically
  const handleCompleteTransaction = (tx: Transaction) => {
    setTransactions((prev) => [tx, ...prev]);

    // Automatically decrease product inventory stock
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const itemSold = tx.items.find((i) => i.productId === p.id);
        if (itemSold) {
          return {
            ...p,
            currentStock: p.currentStock - itemSold.quantity,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return p;
      })
    );

    addAuditLog(
      'Sale Completed',
      tx.receiptNumber,
      `Completed ${tx.paymentMethod.toUpperCase()} transaction for ₱${tx.grandTotal.toFixed(2)} (${tx.items.length} items)`
    );
  };

  // 6. Record Stock Receiving Delivery -> Increase stock automatically
  const handleReceiveStock = (record: StockReceivingRecord) => {
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const itemDelivered = record.items.find((i) => i.productId === p.id);
        if (itemDelivered) {
          return {
            ...p,
            currentStock: p.currentStock + itemDelivered.quantityReceived,
            costPrice: itemDelivered.unitCost,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return p;
      })
    );

    addAuditLog(
      'Stock Delivery Received',
      record.referenceNumber,
      `Received supplier delivery from ${record.supplierName}, total value ₱${record.totalAmount.toFixed(2)}`
    );
  };

  // 7. Stock Adjustments (Damage, Expired, Correction)
  const handleStockAdjustment = (adj: StockAdjustment) => {
    setAdjustments((prev) => [adj, ...prev]);

    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        if (p.id === adj.productId) {
          return {
            ...p,
            currentStock: adj.newStock,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return p;
      })
    );

    addAuditLog(
      'Inventory Adjustment',
      adj.productName,
      `Adjusted ${adj.adjustmentType.toUpperCase()} ${adj.quantity} units (Reason: ${adj.reason.replace('_', ' ')})`
    );
  };

  // 8. Void Transaction -> Restore stock automatically
  const handleVoidTransaction = (transactionId: string, reason: string) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;

    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, status: 'voided', voidReason: reason } : t))
    );

    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const itemInTx = tx.items.find((i) => i.productId === p.id);
        if (itemInTx) {
          return {
            ...p,
            currentStock: p.currentStock + itemInTx.quantity,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return p;
      })
    );

    addAuditLog(
      'Sale Voided',
      tx.receiptNumber,
      `Voided transaction of ₱${tx.grandTotal.toFixed(2)}. Reason: ${reason}`
    );
  };

  // 9. Add Expense
  const handleAddExpense = (newExp: Expense) => {
    setExpenses((prev) => [newExp, ...prev]);
    addAuditLog(
      'Expense Logged',
      newExp.category,
      `Recorded overhead expense of ₱${newExp.amount.toFixed(2)}: ${newExp.description}`
    );
  };

  // 10. Store Settings Save
  const handleSaveSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
    addAuditLog(
      'Store Settings Modified',
      newSettings.storeName,
      `Updated store title and logo configuration`
    );
  };

  // 11. User Management Actions
  const handleAddUser = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    addAuditLog(
      'User Account Created',
      newUser.name,
      `Created new user @${newUser.username} with role: ${newUser.role.toUpperCase()}`
    );
  };

  const handleEditUser = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    addAuditLog(
      'User Account Modified',
      updatedUser.name,
      `Updated user account details and permissions`
    );
  };

  const handleToggleUserActive = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const nextActive = !targetUser.active;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, active: nextActive } : u))
    );

    addAuditLog(
      'User Account Status Changed',
      targetUser.name,
      nextActive ? 'Activated user account' : 'Deactivated user account'
    );
  };

  const handleDeleteUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    setUsers((prev) => prev.filter((u) => u.id !== userId));
    addAuditLog('User Account Deleted', targetUser.name, 'Deleted user account permanently');
  };

  const handleResetUserPassword = (userId: string, newPin: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pin: newPin } : u))
    );

    addAuditLog('User Password Reset', targetUser.name, 'Reset access PIN / password');
  };

  // Stock Alerts Count
  const activeProds = products.filter((p) => p.status === 'active');
  const lowStockCount = activeProds.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel).length;
  const outOfStockCount = activeProds.filter((p) => p.currentStock <= 0).length;

  // If not logged in, render the Login Page
  if (!isLoggedIn || !currentUser) {
    return (
      <LoginPage
        settings={settings}
        users={users}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* App Header & Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        setCurrentUser={(user) => {
          setCurrentUser(user);
          const timestamp = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          const switchLog: AuditLog = {
            id: `log-${Date.now()}`,
            timestamp,
            userName: user.name,
            action: 'User Switched',
            affectedRecord: 'Session',
            details: `Active user switched to ${user.name} (${user.role.toUpperCase()})`,
          };
          setAuditLogs((prev) => [switchLog, ...prev]);
        }}
        users={users}
        settings={settings}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
        onLogout={handleLogout}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            products={products}
            transactions={transactions}
            expenses={expenses}
            settings={settings}
            setActiveTab={setActiveTab}
            openAddProductModal={() => setIsAddProductModalOpen(true)}
          />
        )}

        {activeTab === 'pos' && (
          <POSView
            products={products}
            categories={categories}
            currentUser={currentUser}
            settings={settings}
            onCompleteTransaction={handleCompleteTransaction}
          />
        )}

        {activeTab === 'products' && (
          <ProductManagementView
            products={products}
            categories={categories}
            suppliers={suppliers}
            settings={settings}
            currentUser={currentUser}
            onSaveProduct={handleSaveProduct}
            onToggleArchiveProduct={handleToggleArchiveProduct}
            isAddModalOpen={isAddProductModalOpen}
            setIsAddModalOpen={setIsAddProductModalOpen}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            products={products}
            categories={categories}
            suppliers={suppliers}
            adjustments={adjustments}
            currentUser={currentUser}
            settings={settings}
            onStockAdjustment={handleStockAdjustment}
            onReceiveStock={handleReceiveStock}
          />
        )}

        {activeTab === 'sales' && (
          <SalesHistoryView
            transactions={transactions}
            currentUser={currentUser}
            settings={settings}
            onVoidTransaction={handleVoidTransaction}
          />
        )}

        {activeTab === 'expenses' && currentUser.role === 'admin' && (
          <ExpensesView
            expenses={expenses}
            currentUser={currentUser}
            settings={settings}
            onAddExpense={handleAddExpense}
          />
        )}

        {activeTab === 'reports' && currentUser.role === 'admin' && (
          <ReportsView
            transactions={transactions}
            expenses={expenses}
            products={products}
            categories={categories}
            settings={settings}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'settings' && currentUser.role === 'admin' && (
          <SettingsView
            settings={settings}
            users={users}
            auditLogs={auditLogs}
            currentUser={currentUser}
            onSaveSettings={handleSaveSettings}
            onAddUser={handleAddUser}
            onEditUser={handleEditUser}
            onToggleUserActive={handleToggleUserActive}
            onDeleteUser={handleDeleteUser}
            onResetUserPassword={handleResetUserPassword}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-400">
        <p>
          <strong className="text-white">{settings.storeName}</strong> • Motorcycle Parts & Accessories System • Operating Mode:{' '}
          <span className="text-blue-400 font-bold">{currentUser.role.toUpperCase()}</span>
        </p>
      </footer>
    </div>
  );
}
