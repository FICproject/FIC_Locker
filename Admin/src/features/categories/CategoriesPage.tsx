import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, Power, Trash2 } from 'lucide-react';
import type { CategoryRecord } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { useAdminLiveSync } from '../../hooks/useAdminLiveSync';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Modal,
  StatusBadge,
  SuccessBanner,
} from '../../components/UiPrimitives';

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await adminApi.categories.list();
      setCategories(list);
    } catch (err) {
      if (!silent) setError(extractErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAdminLiveSync(() => {
    load(true);
  });

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (cat: CategoryRecord) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setIsActive(cat.isActive);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editing) {
        await adminApi.categories.update(editing._id, { name, description, isActive });
        setSuccess(`Category "${name}" updated.`);
      } else {
        await adminApi.categories.create({ name, description, isActive });
        setSuccess(`Category "${name}" added.`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleToggle = async (cat: CategoryRecord) => {
    try {
      await adminApi.categories.update(cat._id, { isActive: !cat.isActive });
      setSuccess(`Category "${cat.name}" ${!cat.isActive ? 'activated' : 'deactivated'}.`);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleDelete = async (cat: CategoryRecord) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await adminApi.categories.remove(cat._id);
      setSuccess(`Category "${cat.name}" deleted.`);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Category Management</h1>
          <p className="text-sm text-slate-500">Manage platform-provided document categories for manual user selection</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => load()} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      {loading ? (
        <LoadingState />
      ) : categories.length === 0 ? (
        <EmptyState title="No categories configured" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Category Name</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Documents</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.slug}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{c.description || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{c.documentCount ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.isActive ? 'active' : 'suspended'} /></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleToggle(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" /> {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Edit Category — ${editing.name}` : 'Add Document Category'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Category is active for user selection
          </label>
          <button
            type="submit"
            className="w-full py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
          >
            {editing ? 'Save Changes' : 'Create Category'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

