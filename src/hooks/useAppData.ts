import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import {
  mapAuditLog,
  mapCategory,
  mapExpense,
  mapInventoryMovement,
  mapProduct,
  mapReceivingRecord,
  mapSettings,
  mapStockAdjustment,
  mapTransaction,
  mapUser,
} from '../lib/mappers';
import type {
  AppSnapshot,
  AuthProfile,
  Category,
  CategoryInput,
  ExpenseInput,
  ProductInput,
  SaleCheckoutInput,
  StockAdjustment,
  StockReceivingRecord,
  StoreSettings,
  Transaction,
  User,
  UserUpsertInput,
} from '../types';
import { formatDateOnly } from '../lib/format';

const emptySnapshot: AppSnapshot = {
  settings: {
    storeName: 'Mags Moto',
    storeLogo: '/Mags%20Moto%20Logo.png',
    address: '',
    phone: '',
    email: '',
    currencySymbol: '₱',
    taxRate: 0,
    allowNegativeStock: false,
    receiptFooter: '',
  },
  users: [],
  categories: [],
  products: [],
  transactions: [],
  expenses: [],
  adjustments: [],
  receivingRecords: [],
  inventoryMovements: [],
  auditLogs: [],
};

const fetchTransactionById = async (transactionId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      `
        *,
        cashier:profiles!transactions_cashier_id_fkey(name),
        transaction_items(*)
      `,
    )
    .eq('id', transactionId)
    .single();

  if (error) {
    throw error;
  }

  return mapTransaction(data);
};

export const useAppData = (
  profile: AuthProfile | null,
  accessToken: string | null,
  options?: { loadAdminUsers?: boolean },
) => {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(emptySnapshot);
  const [publicSettings, setPublicSettings] = useState<StoreSettings>(emptySnapshot.settings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadPublicSettings = useCallback(async () => {
    const { data } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      const mapped = mapSettings(data);
      setPublicSettings(mapped);
      setSnapshot((current) => ({ ...current, settings: mapped }));
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!profile || !accessToken) {
      setSnapshot((current) => ({ ...emptySnapshot, settings: current.settings }));
      hasLoadedRef.current = false;
      setLoading(false);
      return;
    }

    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const settingsQuery = supabase.from('store_settings').select('*').eq('id', 1).single();
      const categoriesQuery = supabase
        .from('categories')
        .select('id, name, description, active, products(count)')
        .order('name');
      const productsQuery = supabase.from('products').select('*').order('name');
      const transactionsQuery = supabase
        .from('transactions')
        .select(
          `
            *,
            cashier:profiles!transactions_cashier_id_fkey(name),
            transaction_items(*)
          `,
        )
        .order('sold_at', { ascending: false });
      const inventoryMovementsQuery = supabase
        .from('inventory_movements')
        .select('*, product:products(name), creator:profiles!inventory_movements_created_by_fkey(name)')
        .order('created_at', { ascending: false });

      const adminExpensesQuery =
        profile.role === 'admin'
          ? supabase
              .from('expenses')
              .select('*, recorder:profiles!expenses_recorded_by_fkey(name)')
              .order('expense_date', { ascending: false })
          : Promise.resolve({ data: [], error: null } as any);

      const adminAdjustmentsQuery =
        profile.role === 'admin'
          ? supabase
              .from('stock_adjustments')
              .select('*, product:products(name), adjuster:profiles!stock_adjustments_adjusted_by_fkey(name)')
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null } as any);

      const adminReceivingQuery =
        profile.role === 'admin'
          ? supabase
              .from('stock_receiving_records')
              .select(
                `
                  *,
                  recorder:profiles!stock_receiving_records_recorded_by_fkey(name),
                  stock_receiving_items(
                    *,
                    product:products(name)
                  )
                `,
              )
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null } as any);

      const adminAuditLogsQuery =
        profile.role === 'admin'
          ? supabase.from('audit_logs').select('*').order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null } as any);

      const usersQuery =
        profile.role === 'admin' && options?.loadAdminUsers
          ? apiFetch<User[]>('/api/admin/users', accessToken).catch((usersError) => {
              console.error('Unable to load admin users.', usersError);
              return [];
            })
          : Promise.resolve([]);

      const [
        settingsResult,
        categoriesResult,
        productsResult,
        transactionsResult,
        inventoryMovementsResult,
        expensesResult,
        adjustmentsResult,
        receivingResult,
        auditLogsResult,
        usersResult,
      ] = await Promise.all([
        settingsQuery,
        categoriesQuery,
        productsQuery,
        transactionsQuery,
        inventoryMovementsQuery,
        adminExpensesQuery,
        adminAdjustmentsQuery,
        adminReceivingQuery,
        adminAuditLogsQuery,
        usersQuery,
      ]);

      const queryErrors = [
        settingsResult.error,
        categoriesResult.error,
        productsResult.error,
        transactionsResult.error,
        inventoryMovementsResult.error,
        expensesResult.error,
        adjustmentsResult.error,
        receivingResult.error,
        auditLogsResult.error,
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        throw queryErrors[0];
      }

      setSnapshot({
        settings: mapSettings(settingsResult.data),
        users: usersResult,
        categories: (categoriesResult.data ?? []).map(mapCategory),
        products: (productsResult.data ?? []).map(mapProduct),
        transactions: (transactionsResult.data ?? []).map(mapTransaction),
        inventoryMovements: (inventoryMovementsResult.data ?? []).map(mapInventoryMovement),
        expenses: (expensesResult.data ?? []).map(mapExpense),
        adjustments: (adjustmentsResult.data ?? []).map(mapStockAdjustment),
        receivingRecords: (receivingResult.data ?? []).map(mapReceivingRecord),
        auditLogs: (auditLogsResult.data ?? []).map(mapAuditLog),
      });
      hasLoadedRef.current = true;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load data.');
    } finally {
      if (!hasLoadedRef.current) {
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [accessToken, options?.loadAdminUsers, profile]);

  useEffect(() => {
    void loadPublicSettings();
  }, [loadPublicSettings]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = useCallback(
    async <T,>(action: () => Promise<T>) => {
      setIsMutating(true);
      setError(null);
      try {
        return await action();
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : typeof mutationError === 'object' &&
                mutationError !== null &&
                'message' in mutationError &&
                typeof mutationError.message === 'string'
              ? mutationError.message
              : 'Request failed.';
        setError(message);
        throw mutationError;
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  const saveProduct = useCallback(
    async (product: ProductInput) =>
      mutate(async () => {
        const { error } = await supabase.rpc('upsert_product', {
          p_payload: {
            ...product,
          },
        });

        if (error) {
          throw error;
        }

        await refresh();
      }),
    [mutate, refresh],
  );

  const createCategory = useCallback(
    async (category: CategoryInput) =>
      mutate(async (): Promise<Category> => {
        const { data, error } = await supabase.rpc('create_product_category', {
          p_payload: category,
        });

        if (error) {
          throw error;
        }

        const mappedCategory = mapCategory(data);
        await refresh();
        return mappedCategory;
      }),
    [mutate, refresh],
  );

  const updateCategory = useCallback(
    async (categoryId: string, category: CategoryInput) =>
      mutate(async (): Promise<Category> => {
        const { data, error } = await supabase.rpc('update_product_category', {
          p_category_id: categoryId,
          p_payload: category,
        });

        if (error) {
          throw error;
        }

        const mappedCategory = mapCategory(data);
        await refresh();
        return mappedCategory;
      }),
    [mutate, refresh],
  );

  const setCategoryActive = useCallback(
    async (categoryId: string, active: boolean) =>
      mutate(async (): Promise<Category> => {
        const { data, error } = await supabase.rpc('set_category_active', {
          p_category_id: categoryId,
          p_active: active,
        });

        if (error) {
          throw error;
        }

        const mappedCategory = mapCategory(data);
        await refresh();
        return mappedCategory;
      }),
    [mutate, refresh],
  );

  const deleteCategory = useCallback(
    async (categoryId: string) =>
      mutate(async () => {
        const { error } = await supabase.rpc('delete_product_category', {
          p_category_id: categoryId,
        });

        if (error) {
          throw error;
        }

        await refresh();
      }),
    [mutate, refresh],
  );

  const toggleArchiveProduct = useCallback(
    async (productId: string) =>
      mutate(async () => {
        const { error } = await supabase.rpc('toggle_product_status', {
          p_product_id: productId,
        });
        if (error) {
          throw error;
        }
        await refresh();
      }),
    [mutate, refresh],
  );

  const deleteProduct = useCallback(
    async (productId: string) =>
      mutate(async () => {
        const { error } = await supabase.rpc('delete_product', {
          p_product_id: productId,
        });
        if (error) {
          throw error;
        }
        await refresh();
      }),
    [mutate, refresh],
  );

  const completeTransaction = useCallback(
    async (input: SaleCheckoutInput) =>
      mutate(async () => {
        const { data, error } = await supabase.rpc('record_sale', {
          p_payload: input,
        });

        if (error) {
          throw error;
        }

        const transaction = await fetchTransactionById(data.id);
        await refresh();
        return transaction;
      }),
    [mutate, refresh],
  );

  const voidTransaction = useCallback(
    async (transactionId: string, reason: string) =>
      mutate(async () => {
        const { error } = await supabase.rpc('void_sale_transaction', {
          p_transaction_id: transactionId,
          p_reason: reason,
        });

        if (error) {
          throw error;
        }

        await refresh();
      }),
    [mutate, refresh],
  );

  const receiveStock = useCallback(
    async (record: StockReceivingRecord) =>
      mutate(async () => {
        const primaryItem = record.items[0];
        if (!primaryItem) {
          throw new Error('At least one stock item is required.');
        }

        const { error } = await supabase.rpc('receive_stock_delivery', {
          p_payload: {
            productId: primaryItem.productId,
            quantityReceived: primaryItem.quantityReceived,
            totalPurchaseCost: record.totalAmount,
            referenceNumber: record.referenceNumber,
            deliveryDate: record.deliveryDate,
            notes: record.notes ?? '',
          },
        });

        if (error) {
          throw error;
        }

        await refresh();
      }),
    [mutate, refresh],
  );

  const adjustStock = useCallback(
    async (adjustment: StockAdjustment) =>
      mutate(async () => {
        const { error } = await supabase.rpc('adjust_inventory_stock', {
          p_payload: {
            productId: adjustment.productId,
            adjustmentType: adjustment.adjustmentType,
            quantity: adjustment.quantity,
            reason: adjustment.reason,
            notes: adjustment.notes ?? '',
          },
        });

        if (error) {
          throw error;
        }

        await refresh();
      }),
    [mutate, refresh],
  );

  const addExpense = useCallback(
    async (expense: ExpenseInput) =>
      mutate(async () => {
        const { error } = await supabase.rpc('record_expense', {
          p_payload: {
            ...expense,
            date: formatDateOnly(new Date()),
          },
        });

        if (error) {
          throw error;
        }

        await refresh();
      }),
    [mutate, refresh],
  );

  const updateExpense = useCallback(
    async (expenseId: string, expense: ExpenseInput) =>
      mutate(async () => {
        const { error } = await supabase.rpc('update_expense', {
          p_expense_id: expenseId,
          p_payload: expense,
        });

        if (error) {
          throw error;
        }

        await refresh();
      }),
    [mutate, refresh],
  );

  const deleteExpense = useCallback(
    async (expenseId: string) =>
      mutate(async () => {
        const { error } = await supabase.rpc('delete_expense', {
          p_expense_id: expenseId,
        });

        if (error) {
          throw error;
        }

        await refresh();
      }),
    [mutate, refresh],
  );

  const saveSettings = useCallback(
    async (settings: StoreSettings, logoFile?: File | null) =>
      mutate(async () => {
        let storeLogo = settings.storeLogo ?? '';

        if (logoFile) {
          const extension = logoFile.name.split('.').pop() ?? 'png';
          const filePath = `logos/store-logo-${Date.now()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from('store-assets')
            .upload(filePath, logoFile, { upsert: true });

          if (uploadError) {
            throw uploadError;
          }

          const { data } = supabase.storage.from('store-assets').getPublicUrl(filePath);
          storeLogo = data.publicUrl;
        }

        const { error } = await supabase.rpc('save_store_settings', {
          p_payload: {
            ...settings,
            storeLogo,
          },
        });

        if (error) {
          throw error;
        }

        await loadPublicSettings();
        await refresh();
      }),
    [loadPublicSettings, mutate, refresh],
  );

  const saveUser = useCallback(
    async (user: UserUpsertInput) =>
      mutate(async () => {
        if (!accessToken) {
          throw new Error('Missing session.');
        }

        if (user.id) {
          await apiFetch(`/api/admin/users/${user.id}`, accessToken, {
            method: 'PUT',
            body: JSON.stringify(user),
          });
        } else {
          await apiFetch('/api/admin/users', accessToken, {
            method: 'POST',
            body: JSON.stringify(user),
          });
        }

        await refresh();
      }),
    [accessToken, mutate, refresh],
  );

  const toggleUserActive = useCallback(
    async (userId: string, active: boolean) =>
      mutate(async () => {
        if (!accessToken) {
          throw new Error('Missing session.');
        }

        await apiFetch(`/api/admin/users/${userId}/active`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify({ active }),
        });

        await refresh();
      }),
    [accessToken, mutate, refresh],
  );

  const deleteUser = useCallback(
    async (userId: string) =>
      mutate(async () => {
        if (!accessToken) {
          throw new Error('Missing session.');
        }

        await apiFetch(`/api/admin/users/${userId}`, accessToken, {
          method: 'DELETE',
        });

        await refresh();
      }),
    [accessToken, mutate, refresh],
  );

  const resetUserPassword = useCallback(
    async (userId: string, password: string) =>
      mutate(async () => {
        if (!accessToken) {
          throw new Error('Missing session.');
        }

        await apiFetch(`/api/admin/users/${userId}/reset-password`, accessToken, {
          method: 'POST',
          body: JSON.stringify({ password }),
        });

        await refresh();
      }),
    [accessToken, mutate, refresh],
  );

  const recordSessionEvent = useCallback(
    async (action: 'User Login' | 'User Logout') => {
      if (!profile) {
        return;
      }

      const { error } = await supabase.rpc('record_session_event', {
        p_action: action,
      });

      if (!error && profile.role === 'admin') {
        await refresh();
      }
    },
    [profile, refresh],
  );

  return useMemo(
    () => ({
      snapshot,
      publicSettings,
      loading,
      isMutating,
      error,
      refresh,
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
    }),
    [
      snapshot,
      publicSettings,
      loading,
      isMutating,
      error,
      refresh,
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
    ],
  );
};
