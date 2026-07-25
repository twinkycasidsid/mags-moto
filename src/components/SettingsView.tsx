import React, { useState } from 'react';
import { StoreSettings, User, AuditLog, Role, UserPermissions } from '../types';
import {
  Settings,
  Users,
  History,
  Store,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  Search,
  UserCheck,
  UserX,
  Upload,
  Image as ImageIcon,
  X,
} from 'lucide-react';

interface SettingsViewProps {
  settings: StoreSettings;
  users: User[];
  auditLogs: AuditLog[];
  currentUser: User;
  onSaveSettings: (newSettings: StoreSettings) => void;
  onAddUser: (user: User) => void;
  onEditUser: (user: User) => void;
  onToggleUserActive: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onResetUserPassword: (userId: string, newPin: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  users,
  auditLogs,
  currentUser,
  onSaveSettings,
  onAddUser,
  onEditUser,
  onToggleUserActive,
  onDeleteUser,
  onResetUserPassword,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'system' | 'history'>('users');

  // System Management State (ONLY Store Name & Store Logo)
  const [systemForm, setSystemForm] = useState<{ storeName: string; storeLogo: string }>({
    storeName: settings.storeName || 'Mags Moto',
    storeLogo: settings.storeLogo || '',
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // User Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<{
    name: string;
    username: string;
    role: Role;
    pin: string;
    permissions: UserPermissions;
  }>({
    name: '',
    username: '',
    role: 'cashier',
    pin: '1234',
    permissions: {
      canVoidSales: false,
      canEditProducts: false,
      canManageInventory: true,
      canViewReports: false,
      canManageExpenses: false,
    },
  });

  // Password Reset Modal State
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPinInput, setNewPinInput] = useState('');

  // History Logs Search & Filter State
  const [logSearch, setLogSearch] = useState('');
  const [logFilterAction, setLogFilterAction] = useState<string>('all');

  // System Management Submit
  const handleSaveSystemSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemForm.storeName.trim()) {
      alert('Store Name cannot be empty.');
      return;
    }

    onSaveSettings({
      ...settings,
      storeName: systemForm.storeName.trim(),
      storeLogo: systemForm.storeLogo,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Image Logo File Upload Handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Image file size should be less than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSystemForm((prev) => ({ ...prev, storeLogo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // User Modal Handlers
  const openAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      username: '',
      role: 'cashier',
      pin: '1234',
      permissions: {
        canVoidSales: false,
        canEditProducts: false,
        canManageInventory: true,
        canViewReports: false,
        canManageExpenses: false,
      },
    });
    setIsUserModalOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      username: user.username,
      role: user.role,
      pin: user.pin || '1234',
      permissions: user.permissions || {
        canVoidSales: user.role === 'admin',
        canEditProducts: user.role === 'admin',
        canManageInventory: true,
        canViewReports: user.role === 'admin',
        canManageExpenses: user.role === 'admin',
      },
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.name || !userFormData.username) {
      alert('Name and username are required.');
      return;
    }

    if (editingUser) {
      const updated: User = {
        ...editingUser,
        name: userFormData.name,
        username: userFormData.username,
        role: userFormData.role,
        pin: userFormData.pin,
        permissions: userFormData.permissions,
      };
      onEditUser(updated);
    } else {
      const newUser: User = {
        id: `usr-${Date.now()}`,
        name: userFormData.name,
        username: userFormData.username,
        role: userFormData.role,
        pin: userFormData.pin,
        active: true,
        permissions: userFormData.permissions,
      };
      onAddUser(newUser);
    }

    setIsUserModalOpen(false);
  };

  const handleConfirmResetPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPinInput) return;
    onResetUserPassword(resetModalUser.id, newPinInput);
    alert(`Password / PIN updated successfully for ${resetModalUser.name}.`);
    setResetModalUser(null);
    setNewPinInput('');
  };

  // Filter audit logs
  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.affectedRecord.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(logSearch.toLowerCase());

    if (logFilterAction === 'all') return matchesSearch;
    if (logFilterAction === 'login') return matchesSearch && log.action.toLowerCase().includes('login');
    if (logFilterAction === 'logout') return matchesSearch && log.action.toLowerCase().includes('logout');
    if (logFilterAction === 'products') return matchesSearch && (log.action.includes('Product') || log.action.includes('Price'));
    if (logFilterAction === 'inventory') return matchesSearch && log.action.includes('Inventory');
    if (logFilterAction === 'users') return matchesSearch && log.action.includes('User');
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <span>Mags Moto System Control Panel</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage store identity, user roles & permissions, and review system audit history logs.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-blue-600" />
            <span>User Management</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'system' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-4 h-4 text-blue-600" />
            <span>System Management</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-blue-600" />
            <span>History Logs ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">System Users & Security Permissions</h3>
              <p className="text-xs text-slate-500">
                Configure user roles (Admin & Cashier), reset access credentials, and activate/deactivate accounts.
              </p>
            </div>
            <button
              onClick={openAddUser}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add New User</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4">User Name & Account</th>
                    <th className="py-3 px-4 text-center">System Role</th>
                    <th className="py-3 px-4 text-center">Account Status</th>
                    <th className="py-3 px-4">Granted Permissions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => {
                    const perms = u.permissions || {
                      canVoidSales: u.role === 'admin',
                      canEditProducts: u.role === 'admin',
                      canManageInventory: true,
                      canViewReports: u.role === 'admin',
                      canManageExpenses: u.role === 'admin',
                    };

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{u.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            Username: @{u.username} | PIN: {u.pin ? '••••' : 'None'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs uppercase ${
                              u.role === 'admin'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {u.active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {perms.canVoidSales && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                Void Sales
                              </span>
                            )}
                            {perms.canEditProducts && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                Edit Products
                              </span>
                            )}
                            {perms.canManageInventory && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                Manage Inventory
                              </span>
                            )}
                            {perms.canViewReports && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                View Reports
                              </span>
                            )}
                            {perms.canManageExpenses && (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                Expenses
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1">
                          <button
                            onClick={() => openEditUser(u)}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
                            title="Edit User Details & Permissions"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => {
                              setResetModalUser(u);
                              setNewPinInput(u.pin || '1234');
                            }}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Reset User PIN / Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onToggleUserActive(u.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.active
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.active ? 'Deactivate User' : 'Activate User'}
                          >
                            {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>

                          {users.length > 1 && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete user "${u.name}"?`)) {
                                  onDeleteUser(u.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Delete User Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SYSTEM MANAGEMENT (ONLY STORE NAME & STORE LOGO) */}
      {activeTab === 'system' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Store Title & Logo Branding</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize your store name and upload a custom shop logo for system branding.
              </p>
            </div>

            <form onSubmit={handleSaveSystemSettings} className="space-y-5 text-xs">
              {/* Store Name Input */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Store / Shop Name *</label>
                <input
                  type="text"
                  required
                  value={systemForm.storeName}
                  onChange={(e) => setSystemForm({ ...systemForm, storeName: e.target.value })}
                  placeholder="e.g. Mags Moto"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-extrabold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Store Logo Input & Image Preview */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700">Store Logo</label>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-md shrink-0 border border-slate-200">
                    {systemForm.storeLogo ? (
                      <img
                        src={systemForm.storeLogo}
                        alt="Store Logo Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-8 h-8 stroke-[2]" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <p className="text-xs text-slate-600 font-medium">
                      Upload an image file (PNG/JPG) or enter image web URL.
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-800 font-bold cursor-pointer flex items-center gap-1.5 shadow-xs">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        <span>Upload Image File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>

                      {systemForm.storeLogo && (
                        <button
                          type="button"
                          onClick={() => setSystemForm({ ...systemForm, storeLogo: '' })}
                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-semibold text-slate-500">Or Image URL</label>
                  <input
                    type="url"
                    value={systemForm.storeLogo}
                    onChange={(e) => setSystemForm({ ...systemForm, storeLogo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>System Branding Saved Successfully!</span>
                  </>
                ) : (
                  <span>Save Store Name & Logo</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 3: HISTORY LOGS / AUDIT TRAIL */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search audit logs by user, action, or affected record..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-600">Filter Activity:</label>
              <select
                value={logFilterAction}
                onChange={(e) => setLogFilterAction(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2"
              >
                <option value="all">All System Actions</option>
                <option value="login">User Login</option>
                <option value="logout">User Logout</option>
                <option value="products">Product & Price Changes</option>
                <option value="inventory">Inventory Adjustments</option>
                <option value="users">User Account Modifications</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Action Performed</th>
                    <th className="py-3 px-4">Affected Record</th>
                    <th className="py-3 px-4">Details / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        No audit history logs found.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {log.userName}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800 text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                          {log.affectedRecord || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT USER */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? 'Edit User Details' : 'Create New User Account'}
              </h3>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="e.g. Maria Clara"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Username *</label>
                  <input
                    type="text"
                    required
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">System Role *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as Role })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="admin">Administrator</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">PIN / Access Code</label>
                <input
                  type="password"
                  maxLength={6}
                  value={userFormData.pin}
                  onChange={(e) => setUserFormData({ ...userFormData, pin: e.target.value })}
                  placeholder="1234"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-900 text-xs">Manage User Permissions</label>
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.canVoidSales}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          permissions: { ...userFormData.permissions, canVoidSales: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>Can Void Completed Sales Transactions</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.canEditProducts}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          permissions: { ...userFormData.permissions, canEditProducts: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>Can Add & Edit Products</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.canManageInventory}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          permissions: { ...userFormData.permissions, canManageInventory: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>Can Adjust Inventory & Receive Deliveries</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.canViewReports}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          permissions: { ...userFormData.permissions, canViewReports: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>Can Access Financial Reports</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormData.permissions.canManageExpenses}
                      onChange={(e) =>
                        setUserFormData({
                          ...userFormData,
                          permissions: { ...userFormData.permissions, canManageExpenses: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                    <span>Can Log Overhead Expenses</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Save User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD / PIN */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-2 text-blue-600 border-b border-slate-100 pb-3">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">
                Reset Credentials for {resetModalUser.name}
              </h3>
            </div>

            <form onSubmit={handleConfirmResetPin} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">New PIN / Password *</label>
                <input
                  type="text"
                  required
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="e.g. 5678"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
