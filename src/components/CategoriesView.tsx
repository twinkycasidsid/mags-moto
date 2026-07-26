import React, { useMemo, useState } from 'react';
import type { Category, User } from '../types';
import { useFeedback } from './FeedbackProvider';
import { PaginationControls } from './PaginationControls';
import { Edit2, FolderTree, Plus, Power, RotateCcw, Trash2, X } from 'lucide-react';

interface CategoriesViewProps {
  categories: Category[];
  currentUser: User;
  onCreateCategory: (category: { name: string; description?: string }) => Promise<Category>;
  onUpdateCategory: (categoryId: string, category: { name: string; description?: string }) => Promise<Category>;
  onSetCategoryActive: (categoryId: string, active: boolean) => Promise<Category>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  currentUser,
  onCreateCategory,
  onUpdateCategory,
  onSetCategoryActive,
  onDeleteCategory,
}) => {
  const { confirm, notify } = useFeedback();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * 10;
    return sortedCategories.slice(start, start + 10);
  }, [currentPage, sortedCategories]);

  const resetForm = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setFormError(null);
    setFieldErrors({});
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description ?? '');
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

    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const nextErrors: Record<string, string> = {};
    if (!normalizedName) {
      nextErrors.name = 'Category name is required.';
    } else if (normalizedName.length > 120) {
      nextErrors.name = 'Category name must be 120 characters or fewer.';
    }

    if (description.trim().length > 300) {
      nextErrors.description = 'Description must be 300 characters or fewer.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Please correct the highlighted fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingCategory) {
        await onUpdateCategory(editingCategory.id, {
          name: normalizedName,
          description: description.trim(),
        });
        notify('Category updated successfully.', 'success');
      } else {
        await onCreateCategory({ name: normalizedName, description: description.trim() });
        notify('Category created successfully.', 'success');
      }
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save category.');
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
            <FolderTree className="h-6 w-6 text-blue-600" />
            <span>Category Management</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage active and inactive categories without breaking existing products or historical records.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-500"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>Add New Category</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Products Assigned</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No categories found.
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((category) => (
                  <tr key={category.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3.5 font-bold text-slate-900">{category.name}</td>
                    <td className="px-4 py-3.5 text-slate-600">{category.description || '—'}</td>
                    <td className="px-4 py-3.5 text-center font-bold text-slate-900">
                      {category.productCount ?? 0}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          category.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {category.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="space-x-1 px-4 py-3.5 text-right">
                      <button
                        onClick={() => openEditModal(category)}
                        className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-200"
                        title="Edit Category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      {category.active ? (
                        <button
                          onClick={async () => {
                            const approved = await confirm({
                              title: `Deactivate ${category.name}?`,
                              message:
                                'Inactive categories are hidden from product creation and cashier selection, but existing product records remain intact.',
                              confirmLabel: 'Deactivate',
                            });
                            if (!approved) {
                              return;
                            }
                            try {
                              setBusyCategoryId(category.id);
                              await onSetCategoryActive(category.id, false);
                              notify('Category deactivated successfully.', 'success');
                            } catch (error) {
                              notify(
                                error instanceof Error
                                  ? error.message
                                  : 'Unable to deactivate category.',
                                'error',
                              );
                            } finally {
                              setBusyCategoryId(null);
                            }
                          }}
                          disabled={busyCategoryId === category.id}
                          className="rounded-lg p-1.5 text-amber-600 transition-colors hover:bg-amber-50"
                          title="Deactivate Category"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            const approved = await confirm({
                              title: `Reactivate ${category.name}?`,
                              message: 'This category will become available again across the system.',
                              confirmLabel: 'Reactivate',
                            });
                            if (!approved) {
                              return;
                            }
                            try {
                              setBusyCategoryId(category.id);
                              await onSetCategoryActive(category.id, true);
                              notify('Category reactivated successfully.', 'success');
                            } catch (error) {
                              notify(
                                error instanceof Error
                                  ? error.message
                                  : 'Unable to reactivate category.',
                                'error',
                              );
                            } finally {
                              setBusyCategoryId(null);
                            }
                          }}
                          disabled={busyCategoryId === category.id}
                          className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                          title="Reactivate Category"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={async () => {
                          const approved = await confirm({
                            title: `Delete ${category.name}?`,
                            message:
                              'This permanently removes the category. Deletion only succeeds when no products are assigned.',
                            confirmLabel: 'Delete',
                            tone: 'danger',
                          });
                          if (!approved) {
                            return;
                          }
                          try {
                            setBusyCategoryId(category.id);
                            await onDeleteCategory(category.id);
                            notify('Category deleted successfully.', 'success');
                          } catch (error) {
                            notify(
                              error instanceof Error ? error.message : 'Unable to delete category.',
                              'error',
                            );
                          } finally {
                            setBusyCategoryId(null);
                          }
                        }}
                        disabled={busyCategoryId === category.id}
                        className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-50"
                        title="Delete Category"
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
          totalItems={sortedCategories.length}
          onPageChange={setCurrentPage}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
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
                <label className="font-bold text-slate-700">Category Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((current) => ({ ...current, name: '' }));
                  }}
                  placeholder="e.g. Household Essentials"
                  maxLength={120}
                  className={`w-full rounded-xl border bg-slate-50 p-2.5 font-bold text-slate-900 ${
                    fieldErrors.name ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.name && <p className="text-[11px] text-rose-600">{fieldErrors.name}</p>}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setFieldErrors((current) => ({ ...current, description: '' }));
                  }}
                  placeholder="Optional category description"
                  maxLength={300}
                  className={`h-24 w-full rounded-xl border bg-slate-50 p-2.5 text-slate-900 ${
                    fieldErrors.description ? 'border-rose-300' : 'border-slate-200'
                  }`}
                />
                <div className="flex items-center justify-between">
                  {fieldErrors.description ? (
                    <p className="text-[11px] text-rose-600">{fieldErrors.description}</p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[11px] text-slate-400">{description.length}/300</p>
                </div>
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
                    : editingCategory
                      ? 'Save Category'
                      : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
