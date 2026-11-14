import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, Power, Trash2 } from 'lucide-react';
import type { PlanRecord, SubscriptionSummary } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { useAdminLiveSync } from '../../hooks/useAdminLiveSync';
import { formatBytes, formatCurrencyInr, formatDate } from '../../lib/format';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Modal,
  Pagination,
  StatusBadge,
  SuccessBanner,
} from '../../components/UiPrimitives';

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export function SubscriptionsPage() {
  const [tab, setTab] = useState<'plans' | 'subscriptions'>('plans');
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [subs, setSubs] = useState<SubscriptionSummary[]>([]);
  const [subStatus, setSubStatus] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    monthlyPriceInr: 0,
    annualPriceInr: 0,
    storageLimitGb: 1,
    maxFileSizeMb: 25,
    documentLimit: '',
    featuresText: '',
    isActive: true,
  });

  const loadPlans = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await adminApi.plans.list();
      setPlans(data);
    } catch (err) {
      if (!silent) setError(extractErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadSubscriptions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await adminApi.plans.listSubscriptions({
        page,
        limit: 20,
        status: subStatus,
        renewal: renewalFilter || undefined,
      });
      setSubs(res.data);
      setTotal(res.meta?.total ?? res.data.length);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err) {
      if (!silent) setError(extractErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, subStatus, renewalFilter]);

  useEffect(() => {
    if (tab === 'plans') loadPlans();
    else loadSubscriptions();
  }, [tab, loadPlans, loadSubscriptions]);

  useAdminLiveSync(() => {
    if (tab === 'plans') loadPlans(true);
    else loadSubscriptions(true);
  });

  const openCreateModal = () => {
    setEditingPlan(null);
    setForm({
      name: '',
      code: '',
      description: '',
      monthlyPriceInr: 0,
      annualPriceInr: 0,
      storageLimitGb: 5,
      maxFileSizeMb: 25,
      documentLimit: '',
      featuresText: 'Camera scanning\nCloud backup',
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (plan: PlanRecord) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      code: plan.code,
      description: plan.description || '',
      monthlyPriceInr: plan.monthlyPriceInr,
      annualPriceInr: plan.annualPriceInr,
      storageLimitGb: Number((plan.storageLimitBytes / GB).toFixed(2)),
      maxFileSizeMb: Math.round(plan.maxFileSizeBytes / MB),
      documentLimit: plan.documentLimit !== null ? String(plan.documentLimit) : '',
      featuresText: plan.features.join('\n'),
      isActive: plan.isActive,
    });
    setModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        description: form.description.trim() || undefined,
        monthlyPriceInr: Number(form.monthlyPriceInr),
        annualPriceInr: Number(form.annualPriceInr),
        storageLimitBytes: Math.round(Number(form.storageLimitGb) * GB),
        maxFileSizeBytes: Math.round(Number(form.maxFileSizeMb) * MB),
        documentLimit: form.documentLimit.trim() ? Number(form.documentLimit) : null,
        features: form.featuresText
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
        isActive: form.isActive,
      };
      if (editingPlan) {
        await adminApi.plans.update(editingPlan._id, payload);
        setSuccess(`Plan "${payload.name}" updated.`);
      } else {
        await adminApi.plans.create(payload);
        setSuccess(`Plan "${payload.name}" created.`);
      }
      setModalOpen(false);
      await loadPlans();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleTogglePlan = async (plan: PlanRecord) => {
    try {
      await adminApi.plans.toggleStatus(plan._id, !plan.isActive);
      setSuccess(`Plan "${plan.name}" ${!plan.isActive ? 'activated' : 'deactivated'}.`);
      await loadPlans();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleDeletePlan = async (plan: PlanRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the "${plan.name}" plan?\n\nThis will remove the plan from both the Admin Website and Admin Mobile App.`
    );
    if (!confirmed) return;

    try {
      await adminApi.plans.delete(plan._id);
      setSuccess(`Plan "${plan.name}" deleted successfully.`);
      await loadPlans();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subscriptions & Plans</h1>
          <p className="text-sm text-slate-500">Configure plans (Free, Plus, Premium) and monitor user subscription lifecycles</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-200 p-1 text-xs font-semibold">
            <button
              onClick={() => setTab('plans')}
              className={`px-3.5 py-1.5 rounded-lg cursor-pointer ${tab === 'plans' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Plans ({plans.length})
            </button>
            <button
              onClick={() => { setTab('subscriptions'); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-lg cursor-pointer ${tab === 'subscriptions' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              User Subscriptions
            </button>
          </div>
          {tab === 'plans' && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Plan
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => (tab === 'plans' ? loadPlans() : loadSubscriptions())} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      {loading ? (
        <LoadingState />
      ) : tab === 'plans' ? (
        plans.length === 0 ? (
          <EmptyState title="No subscription plans configured" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((p) => (
              <div key={p._id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                    <StatusBadge status={p.isActive ? 'active' : 'suspended'} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{p.description || p.code}</p>
                  <div className="mt-4 space-y-1 text-sm">
                    <p><span className="text-slate-500">Monthly:</span> <strong>{formatCurrencyInr(p.monthlyPriceInr)}</strong></p>
                    <p><span className="text-slate-500">Annual:</span> <strong>{formatCurrencyInr(p.annualPriceInr)}</strong></p>
                    <p><span className="text-slate-500">Storage Quota:</span> <strong>{formatBytes(p.storageLimitBytes)}</strong></p>
                    <p><span className="text-slate-500">Max File Size:</span> <strong>{formatBytes(p.maxFileSizeBytes)}</strong></p>
                    <p><span className="text-slate-500">Document Limit:</span> <strong>{p.documentLimit ?? 'Unlimited'}</strong></p>
                  </div>
                  {p.features.length > 0 && (
                    <ul className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1 list-disc pl-4">
                      {p.features.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => openEditModal(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleTogglePlan(p)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                      p.isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" /> {p.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeletePlan(p)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg cursor-pointer"
                    title={`Delete ${p.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
            <select
              value={subStatus}
              onChange={(e) => { setPage(1); setSubStatus(e.target.value); }}
              className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
            >
              <option value="all">All Subscription States</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="grace_period">Grace Period</option>
            </select>
            <select
              value={renewalFilter}
              onChange={(e) => { setPage(1); setRenewalFilter(e.target.value); }}
              className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
            >
              <option value="">All Renewals</option>
              <option value="upcoming">Upcoming Renewals (Next 30 Days)</option>
            </select>
          </div>

          {subs.length === 0 ? (
            <EmptyState title="No subscriptions found" />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Cycle</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Auto-Renew</th>
                      <th className="px-4 py-3 font-semibold">Period</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subs.map((s) => (
                      <tr key={s._id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{s.userName || 'User'}</p>
                          <p className="text-xs text-slate-500">{s.userEmail || s.userId}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{s.planName}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{s.billingCycle}</td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                        <td className="px-4 py-3 text-xs">{s.autoRenew ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDate(s.startDate)} → {formatDate(s.endDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingPlan ? `Edit Plan — ${editingPlan.name}` : 'Create Subscription Plan'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSavePlan} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan Code</label>
              <input
                required
                disabled={Boolean(editingPlan)}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl disabled:bg-slate-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Price (INR)</label>
              <input
                type="number"
                min={0}
                required
                value={form.monthlyPriceInr}
                onChange={(e) => setForm({ ...form, monthlyPriceInr: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Annual Price (INR)</label>
              <input
                type="number"
                min={0}
                required
                value={form.annualPriceInr}
                onChange={(e) => setForm({ ...form, annualPriceInr: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Storage Limit (GB)</label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                required
                value={form.storageLimitGb}
                onChange={(e) => setForm({ ...form, storageLimitGb: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max File (MB)</label>
              <input
                type="number"
                min={1}
                required
                value={form.maxFileSizeMb}
                onChange={(e) => setForm({ ...form, maxFileSizeMb: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Doc Limit (blank=∞)</label>
              <input
                type="number"
                min={1}
                value={form.documentLimit}
                onChange={(e) => setForm({ ...form, documentLimit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Features (one per line)</label>
            <textarea
              rows={3}
              value={form.featuresText}
              onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
          >
            {editingPlan ? 'Save Plan Changes' : 'Create Plan'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

