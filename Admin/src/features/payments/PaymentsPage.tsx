import React, { useCallback, useEffect, useState } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import type { PaymentRecord } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { formatCurrencyInr, formatDateTime } from '../../lib/format';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Modal,
  Pagination,
  StatusBadge,
  SuccessBanner,
} from '../../components/UiPrimitives';

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.payments.list({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter,
        method: methodFilter,
      });
      setPayments(res.data);
      setTotal(res.meta?.total ?? res.data.length);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, methodFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleExport = async () => {
    try {
      const blob = await adminApi.payments.exportCsv({
        status: statusFilter,
        method: methodFilter,
        search: search.trim() || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payment-transactions-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.payments.refund(refundTarget._id, {
        amountInr: refundAmount ? Number(refundAmount) : undefined,
        reason: refundReason.trim(),
      });
      setSuccess('Refund initiated via Razorpay and recorded in Audit Logs.');
      setRefundTarget(null);
      await loadPayments();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Management</h1>
          <p className="text-sm text-slate-500">Monitor Razorpay transactions, webhook verification, refunds, and export reports</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
        >
          <Download className="w-4 h-4" /> Download Transaction Report (CSV)
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadPayments} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search Razorpay payment ID or order ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="all">All Payment Statuses</option>
          <option value="captured">Successful (Captured)</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="partially_refunded">Partially Refunded</option>
          <option value="created">Created / Pending</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => { setPage(1); setMethodFilter(e.target.value); }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="all">All Methods</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="netbanking">Netbanking</option>
          <option value="wallet">Wallet</option>
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : payments.length === 0 ? (
        <EmptyState title="No payment transactions found" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Transaction / Provider ID</th>
                  <th className="px-4 py-3 font-semibold">User & Plan</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Status & Webhook</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-medium text-slate-900">{p.providerPaymentId || p._id}</p>
                      {p.providerOrderId && <p className="font-mono text-[11px] text-slate-400">{p.providerOrderId}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{p.userName || 'User'}</p>
                      <p className="text-xs text-slate-500">{p.userEmail} • {p.planName || 'Plan'}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrencyInr(p.amountInr)}</td>
                    <td className="px-4 py-3 uppercase text-xs text-slate-600">{p.method || '—'}</td>
                    <td className="px-4 py-3 space-y-1">
                      <StatusBadge status={p.status} />
                      <p className="text-[11px] text-slate-500">
                        {p.webhookVerified ? 'Webhook verified' : 'Unverified'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(p.paidAt || p.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'captured' && p.providerPaymentId && (
                        <button
                          onClick={() => {
                            setRefundTarget(p);
                            setRefundAmount(String(p.amountInr));
                            setRefundReason('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}

      <Modal
        open={Boolean(refundTarget)}
        title="Initiate Razorpay Refund"
        onClose={() => setRefundTarget(null)}
      >
        {refundTarget && (
          <form onSubmit={handleRefundSubmit} className="space-y-4 text-sm">
            <p className="text-slate-600">
              Payment <strong>{refundTarget.providerPaymentId}</strong> • Captured{' '}
              <strong>{formatCurrencyInr(refundTarget.amountInr)}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Refund Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                min={1}
                max={refundTarget.amountInr}
                required
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Refund Reason</label>
              <textarea
                rows={2}
                required
                minLength={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <button
              disabled={busy}
              type="submit"
              className="w-full py-2.5 text-sm font-semibold bg-purple-700 text-white rounded-xl hover:bg-purple-800 cursor-pointer"
            >
              {busy ? 'Processing Refund...' : 'Confirm Razorpay Refund'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

