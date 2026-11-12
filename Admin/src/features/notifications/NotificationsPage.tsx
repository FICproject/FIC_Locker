import React, { useCallback, useEffect, useState } from 'react';
import { BellPlus, Send, Trash2, FileText } from 'lucide-react';
import type {
  AdminUserSummary,
  NotificationBroadcastRecord,
  NotificationTemplateRecord,
} from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { useAdminLiveSync } from '../../hooks/useAdminLiveSync';
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

export function NotificationsPage() {
  const [tab, setTab] = useState<'history' | 'templates'>('history');
  const [broadcasts, setBroadcasts] = useState<NotificationBroadcastRecord[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplateRecord[]>([]);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [editingBroadcast, setEditingBroadcast] = useState<NotificationBroadcastRecord | null>(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    channel: 'both' as 'in_app' | 'push' | 'both',
    targetAudience: 'all' as 'all' | 'selected',
    targetUserIds: [] as string[],
    sendImmediately: true,
  });

  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [tplForm, setTplForm] = useState({
    name: '',
    title: '',
    body: '',
    channel: 'both' as 'in_app' | 'push' | 'both',
  });

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [histRes, tplList, usersRes] = await Promise.all([
        adminApi.notifications.list({ page, limit: 20 }),
        adminApi.notifications.listTemplates(),
        adminApi.users.list({ page: 1, limit: 100, status: 'active' }),
      ]);
      setBroadcasts(histRes.data);
      setTotal(histRes.meta?.total ?? histRes.data.length);
      setTotalPages(histRes.meta?.totalPages ?? 1);
      setTemplates(tplList);
      setUsers(usersRes.data);
    } catch (err) {
      if (!silent) setError(extractErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAdminLiveSync(() => {
    loadData(true);
  });

  const openCompose = (tpl?: NotificationTemplateRecord) => {
    setEditingBroadcast(null);
    setForm({
      title: tpl?.title || '',
      body: tpl?.body || '',
      channel: tpl?.channel || 'both',
      targetAudience: 'all',
      targetUserIds: [],
      sendImmediately: true,
    });
    setComposeOpen(true);
  };

  const openEditBroadcast = (b: NotificationBroadcastRecord) => {
    setEditingBroadcast(b);
    setForm({
      title: b.title,
      body: b.body,
      channel: b.channel,
      targetAudience: b.targetAudience,
      targetUserIds: b.targetUserIds,
      sendImmediately: false,
    });
    setComposeOpen(true);
  };

  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingBroadcast) {
        await adminApi.notifications.update(editingBroadcast._id, form);
        setSuccess('Notification updated.');
      } else {
        await adminApi.notifications.create(form);
        setSuccess(form.sendImmediately ? 'Notification dispatched.' : 'Notification draft saved.');
      }
      setComposeOpen(false);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleSendDraft = async (id: string) => {
    try {
      await adminApi.notifications.sendExisting(id);
      setSuccess('Notification sent.');
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    try {
      await adminApi.notifications.remove(id);
      setSuccess('Notification deleted.');
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.notifications.createTemplate(tplForm);
      setSuccess('Notification template saved.');
      setTplModalOpen(false);
      setTplForm({ name: '', title: '', body: '', channel: 'both' });
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notification Management</h1>
          <p className="text-sm text-slate-500">Send push & in-app announcements to all or selected users and manage templates</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-200 p-1 text-xs font-semibold">
            <button
              onClick={() => setTab('history')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${tab === 'history' ? 'bg-white text-slate-900' : 'text-slate-600'}`}
            >
              History ({total})
            </button>
            <button
              onClick={() => setTab('templates')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${tab === 'templates' ? 'bg-white text-slate-900' : 'text-slate-600'}`}
            >
              Templates ({templates.length})
            </button>
          </div>
          {tab === 'history' ? (
            <button
              onClick={() => openCompose()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
            >
              <BellPlus className="w-4 h-4" /> Create Notification
            </button>
          ) : (
            <button
              onClick={() => setTplModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
            >
              <FileText className="w-4 h-4" /> New Template
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => loadData()} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      {loading ? (
        <LoadingState />
      ) : tab === 'history' ? (
        broadcasts.length === 0 ? (
          <EmptyState title="No notifications yet" description="Create and send your first announcement." />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Notification</th>
                  <th className="px-4 py-3 font-semibold">Channel</th>
                  <th className="px-4 py-3 font-semibold">Audience</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {broadcasts.map((b) => (
                  <tr key={b._id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{b.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{b.body}</p>
                    </td>
                    <td className="px-4 py-3 text-xs uppercase text-slate-600">{b.channel}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {b.targetAudience === 'all' ? 'All Active Users' : `${b.targetUserIds.length} Selected`} ({b.recipientCount} sent)
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(b.sentAt || b.createdAt)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {b.status === 'draft' && (
                        <>
                          <button
                            onClick={() => openEditBroadcast(b)}
                            className="px-2.5 py-1 text-xs bg-slate-100 rounded-lg cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleSendDraft(b._id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-lg cursor-pointer"
                          >
                            <Send className="w-3 h-3" /> Send
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteBroadcast(b._id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-rose-50 text-rose-700 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </div>
        )
      ) : templates.length === 0 ? (
        <EmptyState title="No notification templates" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t._id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{t.name}</h3>
                  <span className="text-xs uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">{t.channel}</span>
                </div>
                <p className="text-sm font-medium text-slate-800 mt-2">{t.title}</p>
                <p className="text-xs text-slate-500 mt-1">{t.body}</p>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => openCompose(t)}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-lg cursor-pointer"
                >
                  Use Template
                </button>
                <button
                  onClick={async () => {
                    await adminApi.notifications.deleteTemplate(t._id);
                    await loadData();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 rounded-lg cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose Broadcast Modal */}
      <Modal
        open={composeOpen}
        title={editingBroadcast ? 'Edit Notification' : 'Compose Platform Notification'}
        onClose={() => setComposeOpen(false)}
      >
        <form onSubmit={handleSaveBroadcast} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Message Body</label>
            <textarea
              rows={3}
              required
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as typeof form.channel })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
              >
                <option value="both">Push + In-App</option>
                <option value="push">Push Only (FCM)</option>
                <option value="in_app">In-App Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Audience</label>
              <select
                value={form.targetAudience}
                onChange={(e) => setForm({ ...form, targetAudience: e.target.value as 'all' | 'selected' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
              >
                <option value="all">All Active Users</option>
                <option value="selected">Selected Users</option>
              </select>
            </div>
          </div>

          {form.targetAudience === 'selected' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Recipients</label>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                {users.map((u) => (
                  <label key={u._id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={form.targetUserIds.includes(u._id)}
                      onChange={(e) => {
                        setForm((prev) => ({
                          ...prev,
                          targetUserIds: e.target.checked
                            ? [...prev.targetUserIds, u._id]
                            : prev.targetUserIds.filter((id) => id !== u._id),
                        }));
                      }}
                    />
                    <span>{u.fullName} ({u.email})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={form.sendImmediately}
              onChange={(e) => setForm({ ...form, sendImmediately: e.target.checked })}
            />
            Dispatch immediately (uncheck to save as draft)
          </label>

          <button
            type="submit"
            className="w-full py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
          >
            {form.sendImmediately ? 'Send Notification Now' : 'Save Draft'}
          </button>
        </form>
      </Modal>

      <Modal open={tplModalOpen} title="Create Notification Template" onClose={() => setTplModalOpen(false)}>
        <form onSubmit={handleCreateTemplate} className="space-y-3 text-sm">
          <input
            required
            placeholder="Template name (e.g. Scheduled Maintenance)"
            value={tplForm.name}
            onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl"
          />
          <input
            required
            placeholder="Default notification title"
            value={tplForm.title}
            onChange={(e) => setTplForm({ ...tplForm, title: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl"
          />
          <textarea
            rows={3}
            required
            placeholder="Default body..."
            value={tplForm.body}
            onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl"
          />
          <button
            type="submit"
            className="w-full py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl cursor-pointer"
          >
            Save Template
          </button>
        </form>
      </Modal>
    </div>
  );
}

