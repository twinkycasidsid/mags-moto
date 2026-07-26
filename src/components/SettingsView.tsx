import React, { useMemo, useState } from 'react';
import { StoreSettings, User, AuditLog, Role } from '../types';
import { useFeedback } from './FeedbackProvider';
import { PaginationControls } from './PaginationControls';
import {
  Settings,
  Users,
  History,
  Store,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  CheckCircle2,
  Search,
  UserCheck,
  UserX,
  Upload,
  X,
} from 'lucide-react';

interface SettingsViewProps {
  settings: StoreSettings;
  users: User[];
  auditLogs: AuditLog[];
  currentUser: User;
  onSaveSettings: (newSettings: StoreSettings, logoFile?: File | null) => void | Promise<void>;
  onAddUser: (user: User) => void | Promise<void>;
  onEditUser: (user: User) => void | Promise<void>;
  onToggleUserActive: (userId: string) => void | Promise<void>;
  onDeleteUser: (userId: string) => void | Promise<void>;
  onResetUserPassword: (userId: string, newPassword: string) => void | Promise<void>;
}

const rolePermissions = (role: Role) =>
  role === 'admin'
    ? [
        'Full system access',
        'Manage products, inventory, expenses, reports',
        'Manage users, store settings, and audit logs',
      ]
    : ['POS access only', 'Sales history access only', 'No admin-page access'];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  users,
  auditLogs,
  onSaveSettings,
  onAddUser,
  onEditUser,
  onToggleUserActive,
  onDeleteUser,
  onResetUserPassword,
}) => {
  const { confirm, notify } = useFeedback();
  const [activeTab, setActiveTab] = useState<'users' | 'system' | 'history'>('users');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [systemErrors, setSystemErrors] = useState<Record<string, string>>({});
  const [systemFormError, setSystemFormError] = useState<string | null>(null);
  const [isSavingSystem, setIsSavingSystem] = useState(false);

  const [systemForm, setSystemForm] = useState({
    storeName: settings.storeName || 'Mags Moto',
    storeLogo: settings.storeLogo || '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(settings.storeLogo || '');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    username: '',
    role: 'cashier' as Role,
    password: '',
  });
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({});
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [logPage, setLogPage] = useState(1);

  const [logSearch, setLogSearch] = useState('');
  const [logFilterAction, setLogFilterAction] = useState('all');

  const filteredLogs = useMemo(
    () =>
      auditLogs.filter((log) => {
        const matchesSearch =
          log.userName.toLowerCase().includes(logSearch.toLowerCase()) ||
          log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
          log.affectedRecord.toLowerCase().includes(logSearch.toLowerCase()) ||
          log.details.toLowerCase().includes(logSearch.toLowerCase());

        if (logFilterAction === 'all') return matchesSearch;
        if (logFilterAction === 'login') return matchesSearch && log.action.toLowerCase().includes('login');
        if (logFilterAction === 'logout') return matchesSearch && log.action.toLowerCase().includes('logout');
        if (logFilterAction === 'products') return matchesSearch && log.action.includes('Product');
        if (logFilterAction === 'inventory') return matchesSearch && log.action.includes('Inventory');
        if (logFilterAction === 'users') return matchesSearch && log.action.includes('User');
        return matchesSearch;
      }),
    [auditLogs, logFilterAction, logSearch],
  );
  const paginatedUsers = useMemo(() => users.slice((userPage - 1) * 10, userPage * 10), [userPage, users]);
  const paginatedLogs = useMemo(
    () => filteredLogs.slice((logPage - 1) * 10, logPage * 10),
    [filteredLogs, logPage],
  );

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSystem) {
      return;
    }

    const normalizedStoreName = systemForm.storeName.trim().replace(/\s+/g, ' ');
    const nextErrors: Record<string, string> = {};
    if (!normalizedStoreName) {
      nextErrors.storeName = 'Store name is required.';
    } else if (normalizedStoreName.length > 120) {
      nextErrors.storeName = 'Store name must be 120 characters or fewer.';
    }

    setSystemErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSystemFormError('Please correct the highlighted fields.');
      return;
    }

    try {
      setIsSavingSystem(true);
      setSystemFormError(null);
      await onSaveSettings(
        {
          ...settings,
          storeName: normalizedStoreName,
          storeLogo: logoFile ? '' : systemForm.storeLogo,
        },
        logoFile,
      );

      setSavedSuccess(true);
      notify('Store settings saved successfully.', 'success');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      setSystemFormError(error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setIsSavingSystem(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSystemFormError('Image file size should be less than 2MB.');
      notify('Image file size should be less than 2MB.', 'error');
      e.target.value = '';
      return;
    }

    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      setSystemFormError('Please upload a valid image file.');
      notify('Please upload a valid image file.', 'error');
      e.target.value = '';
      return;
    }

    setSystemFormError(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      username: '',
      role: 'cashier',
      password: '',
    });
    setUserFormErrors({});
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      name: user.name,
      username: user.username,
      role: user.role,
      password: '',
    });
    setUserFormErrors({});
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingUser) {
      return;
    }

    const nextErrors: Record<string, string> = {};
    const normalizedName = userFormData.name.trim().replace(/\s+/g, ' ');
    const normalizedUsername = userFormData.username.trim().toLowerCase();

    if (!normalizedName) {
      nextErrors.name = 'Full name is required.';
    } else if (normalizedName.length > 120) {
      nextErrors.name = 'Full name must be 120 characters or fewer.';
    }

    if (!normalizedUsername) {
      nextErrors.username = 'Username is required.';
    } else if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
      nextErrors.username = 'Username may only contain letters, numbers, dots, underscores, and hyphens.';
    } else if (normalizedUsername.length < 3 || normalizedUsername.length > 50) {
      nextErrors.username = 'Username must be between 3 and 50 characters.';
    }

    if (!editingUser && userFormData.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    if (editingUser && userFormData.password && userFormData.password.length < 6) {
      nextErrors.password = 'New password must be at least 6 characters.';
    }

    setUserFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setUserFormError('Please correct the highlighted fields.');
      return;
    }

    const payload: User = {
      id: editingUser?.id ?? `usr-${Date.now()}`,
      name: normalizedName,
      username: normalizedUsername,
      role: userFormData.role,
      pin: userFormData.password,
      active: editingUser?.active ?? true,
      permissions:
        userFormData.role === 'admin'
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
    };

    try {
      setIsSavingUser(true);
      setUserFormError(null);
      if (editingUser) {
        await onEditUser(payload);
        notify('User updated successfully.', 'success');
      } else {
        await onAddUser(payload);
        notify('User created successfully.', 'success');
      }

      setIsUserModalOpen(false);
    } catch (error) {
      setUserFormError(error instanceof Error ? error.message : 'Unable to save user.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || isResettingPassword) {
      return;
    }

    if (newPasswordInput.length < 6) {
      setResetPasswordError('Password must be at least 6 characters.');
      return;
    }

    try {
      setIsResettingPassword(true);
      setResetPasswordError(null);
      await onResetUserPassword(resetModalUser.id, newPasswordInput);
      notify('Password reset successfully.', 'success');
      setResetModalUser(null);
      setNewPasswordInput('');
    } catch (error) {
      setResetPasswordError(error instanceof Error ? error.message : 'Unable to reset password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <span>Mags Moto System Control Panel</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage store identity, role-based accounts, and review audit history.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          {[
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'system', label: 'System Management', icon: Store },
            { id: 'history', label: `History Logs (${auditLogs.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'users' | 'system' | 'history')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 text-blue-600" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">System Users & Fixed Role Access</h3>
              <p className="text-xs text-slate-500">
                Admin accounts have full access. Cashier accounts are restricted to POS and Sales History.
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
                    <th className="py-3 px-4">User Name</th>
                    <th className="py-3 px-4 text-center">System Role</th>
                    <th className="py-3 px-4 text-center">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{user.name}</p>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs uppercase ${
                            user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            user.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {user.active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => openEditUser(user)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setResetModalUser(user);
                            setNewPasswordInput('');
                          }}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Reset User Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await onToggleUserActive(user.id);
                              notify(
                                user.active ? 'User deactivated successfully.' : 'User activated successfully.',
                                'success',
                              );
                            } catch (error) {
                              notify(
                                error instanceof Error ? error.message : 'Unable to update user status.',
                                'error',
                              );
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={user.active ? 'Deactivate User' : 'Activate User'}
                        >
                          {user.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        {users.length > 1 && (
                          <button
                            onClick={async () => {
                              const approved = await confirm({
                                title: `Delete ${user.name}?`,
                                message: 'This permanently deletes the user account and cannot be undone.',
                                confirmLabel: 'Delete',
                                tone: 'danger',
                              });
                              if (!approved) {
                                return;
                              }

                              try {
                                await onDeleteUser(user.id);
                                notify('User deleted successfully.', 'success');
                              } catch (error) {
                                notify(
                                  error instanceof Error ? error.message : 'Unable to delete user.',
                                  'error',
                                );
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
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={userPage}
              totalItems={users.length}
              onPageChange={setUserPage}
            />
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Store Title & Logo Branding</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update the store name and logo without changing the current design.
              </p>
            </div>

            <form onSubmit={handleSaveSystemSettings} className="space-y-5 text-xs">
              {systemFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {systemFormError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Store / Shop Name *</label>
                <input
                  type="text"
                  required
                  value={systemForm.storeName}
                  onChange={(e) => {
                    setSystemForm((prev) => ({ ...prev, storeName: e.target.value }));
                    setSystemErrors((current) => ({ ...current, storeName: '' }));
                  }}
                  maxLength={120}
                  className={`w-full rounded-xl border bg-slate-50 p-3 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 ${
                    systemErrors.storeName
                      ? 'border-rose-300 focus:ring-rose-400'
                      : 'border-slate-200 focus:ring-blue-500'
                  }`}
                />
                <div className="flex items-center justify-between">
                  {systemErrors.storeName ? (
                    <p className="text-[11px] text-rose-600">{systemErrors.storeName}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[11px] text-slate-400">{systemForm.storeName.length}/120</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700">Store Logo</label>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-md shrink-0 border border-slate-200">
                    {logoPreview || systemForm.storeLogo ? (
                      <img
                        src={logoPreview || systemForm.storeLogo}
                        alt="Store Logo Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-8 h-8 stroke-[2]" />
                    )}
                  </div>

                  <div className="space-y-2 flex-1">
                    <p className="text-xs text-slate-600 font-medium">
                      Upload a PNG/JPG logo. The file will be stored in Supabase Storage.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-800 font-bold cursor-pointer flex items-center gap-1.5 shadow-xs">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        <span>Upload Image File</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>

                      {(logoPreview || systemForm.storeLogo) && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview('');
                            setSystemForm((prev) => ({ ...prev, storeLogo: '' }));
                          }}
                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSystem}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {isSavingSystem ? (
                  <span>Saving Changes...</span>
                ) : savedSuccess ? (
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
                <option value="products">Product Changes</option>
                <option value="inventory">Inventory Adjustments</option>
                <option value="users">User Account Changes</option>
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
                    paginatedLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{log.userName}</td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800 text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-blue-700">{log.affectedRecord || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={logPage}
              totalItems={filteredLogs.length}
              onPageChange={setLogPage}
            />
          </div>
        </div>
      )}

      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? 'Edit User Account' : 'Create New User Account'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              {userFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {userFormError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => {
                    setUserFormData((prev) => ({ ...prev, name: e.target.value }));
                    setUserFormErrors((current) => ({ ...current, name: '' }));
                  }}
                  maxLength={120}
                  className={`w-full rounded-xl border bg-slate-50 p-2.5 font-bold text-slate-900 ${
                    userFormErrors.name ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                {userFormErrors.name && <p className="text-[11px] text-rose-600">{userFormErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Username *</label>
                  <input
                    type="text"
                    required
                    value={userFormData.username}
                    onChange={(e) => {
                      setUserFormData((prev) => ({ ...prev, username: e.target.value }));
                      setUserFormErrors((current) => ({ ...current, username: '' }));
                    }}
                    maxLength={50}
                    className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                      userFormErrors.username ? 'border-rose-300' : 'border-slate-200'
                    }`}
                  />
                  {userFormErrors.username && (
                    <p className="text-[11px] text-rose-600">{userFormErrors.username}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">System Role *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData((prev) => ({ ...prev, role: e.target.value as Role }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold"
                  >
                    <option value="admin">Administrator</option>
                    <option value="cashier">Cashier</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  {editingUser ? 'New Password (Optional)' : 'Password *'}
                </label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => {
                    setUserFormData((prev) => ({ ...prev, password: e.target.value }));
                    setUserFormErrors((current) => ({ ...current, password: '' }));
                  }}
                  placeholder={editingUser ? 'Leave blank to keep current password' : 'At least 6 characters'}
                  maxLength={72}
                  className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                    userFormErrors.password ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                {userFormErrors.password && (
                  <p className="text-[11px] text-rose-600">{userFormErrors.password}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  disabled={isSavingUser}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isSavingUser ? 'Saving...' : 'Save User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-2 text-blue-600 border-b border-slate-100 pb-3">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">
                Reset Password for {resetModalUser.name}
              </h3>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4 text-xs">
              {resetPasswordError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {resetPasswordError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">New Password *</label>
                <input
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => {
                    setNewPasswordInput(e.target.value);
                    setResetPasswordError(null);
                  }}
                  placeholder="At least 6 characters"
                  maxLength={72}
                  className={`w-full rounded-xl border bg-slate-50 p-2.5 font-mono font-bold text-slate-900 ${
                    resetPasswordError ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  disabled={isResettingPassword}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {isResettingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
