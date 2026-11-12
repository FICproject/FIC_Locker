import React, { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import type { AuditLogRecord } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { formatDateTime } from '../../lib/format';
import { EmptyState, ErrorBanner, LoadingState, Pagination } from '../../components/UiPrimitives';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sourceApp, setSourceApp] = useState('all');
  const [entityType, setEntityType] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.auditLogs.list({
        page,
        limit: 25,
        search: search.trim() || undefined,
        sourceApp,
        entityType,
      });
      setLogs(res.data);
      setTotal(res.meta?.total ?? res.data.length);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, sourceApp, entityType]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-500">Immutable record of all privileged Admin activities across Web & Mobile</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadLogs} />}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search action, summary, or reference ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <select
          value={sourceApp}
          onChange={(e) => { setPage(1); setSourceApp(e.target.value); }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="all">All Clients (Web & Mobile)</option>
          <option value="admin-web">Admin Website</option>
          <option value="admin-mobile">Admin Mobile App</option>
        </select>
        <select
          value={entityType}
          onChange={(e) => { setPage(1); setEntityType(e.target.value); }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="all">All Entity Types</option>
          <option value="admin_auth">Admin Auth</option>
          <option value="admin_session">Admin Sessions</option>
          <option value="user">Users</option>
          <option value="document">Documents</option>
          <option value="plan">Plans</option>
          <option value="payment">Payments</option>
          <option value="category">Categories</option>
          <option value="notification">Notifications</option>
          <option value="support_ticket">Support Tickets</option>
          <option value="platform_settings">Platform Settings</option>
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <EmptyState title="No audit logs found" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Entity</th>
                  <th className="px-4 py-3 font-semibold">Summary</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{l.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {l.entityType}
                      {l.entityId ? <span className="block font-mono text-[11px] text-slate-400">{l.entityId}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-800">{l.summary}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {l.sourceApp}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{l.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

