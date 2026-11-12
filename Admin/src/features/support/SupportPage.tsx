import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Search, Send } from 'lucide-react';
import type { SupportTicketPriority, SupportTicketRecord, SupportTicketStatus } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { formatDateTime } from '../../lib/format';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Modal,
  Pagination,
  StatusBadge,
  SuccessBanner,
} from '../../components/UiPrimitives';

export function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [activeTicket, setActiveTicket] = useState<SupportTicketRecord | null>(null);
  const [priority, setPriority] = useState<SupportTicketPriority>('medium');
  const [status, setStatus] = useState<SupportTicketStatus>('open');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.support.list({
        page,
        limit: 20,
        status: statusFilter,
        search: search.trim() || undefined,
      });
      setTickets(res.data);
      setTotal(res.meta?.total ?? res.data.length);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openTicket = async (ticketId: string) => {
    try {
      const detail = await adminApi.support.getById(ticketId);
      setActiveTicket(detail);
      setPriority(detail.priority);
      setStatus(detail.status);
      setResolutionNotes(detail.resolutionNotes || '');
      setReplyText('');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleUpdateTicket = async () => {
    if (!activeTicket) return;
    setBusy(true);
    try {
      const updated = await adminApi.support.update(activeTicket._id, {
        priority,
        status,
        resolutionNotes,
      });
      setActiveTicket(updated);
      setSuccess(`Ticket ${updated.ticketNumber} updated.`);
      await loadTickets();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    setBusy(true);
    try {
      const updated = await adminApi.support.reply(activeTicket._id, {
        message: replyText.trim(),
        status,
      });
      setActiveTicket(updated);
      setReplyText('');
      setSuccess('Reply sent to user.');
      await loadTickets();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support Management</h1>
        <p className="text-sm text-slate-500">Review user support tickets, update priority/status, add resolution notes, and reply</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadTickets} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search ticket number, subject, or description..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : tickets.length === 0 ? (
        <EmptyState title="No support tickets found" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Ticket</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <tr key={t._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-indigo-700 font-semibold">{t.ticketNumber}</p>
                    <p className="font-medium text-slate-900">{t.subject}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{t.userName || 'User'}</p>
                    <p className="text-xs text-slate-500">{t.userEmail || t.userId}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(t.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openTicket(t._id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}

      <Modal
        open={Boolean(activeTicket)}
        title={activeTicket ? `${activeTicket.ticketNumber} — ${activeTicket.subject}` : ''}
        onClose={() => setActiveTicket(null)}
        maxWidth="max-w-2xl"
      >
        {activeTicket && (
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500">From: {activeTicket.userName} ({activeTicket.userEmail})</p>
              <p className="mt-2 text-slate-800 whitespace-pre-wrap">{activeTicket.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SupportTicketStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Resolution Notes</label>
              <textarea
                rows={2}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
              <button
                disabled={busy}
                onClick={handleUpdateTicket}
                className="mt-2 px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 cursor-pointer"
              >
                Save Ticket Metadata
              </button>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Conversation Thread</p>
              <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                {activeTicket.replies.length === 0 ? (
                  <p className="text-xs text-slate-400">No replies yet.</p>
                ) : (
                  activeTicket.replies.map((r, i) => (
                    <div
                      key={r._id || i}
                      className={`p-2.5 rounded-xl text-xs ${
                        r.senderRole === 'admin' ? 'bg-indigo-50 text-indigo-950 ml-6' : 'bg-slate-100 text-slate-800 mr-6'
                      }`}
                    >
                      <div className="flex justify-between font-semibold mb-1">
                        <span>{r.senderName} ({r.senderRole})</span>
                        <span className="font-normal text-slate-500">{formatDateTime(r.createdAt)}</span>
                      </div>
                      <p>{r.message}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleReply} className="flex gap-2">
                <input
                  required
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write reply to user..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
                <button
                  disabled={busy}
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Reply
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

