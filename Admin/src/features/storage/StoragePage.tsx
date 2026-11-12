import React, { useCallback, useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { HardDrive, AlertOctagon, Users, Layers } from 'lucide-react';
import type { StorageOverview } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { formatBytes, formatDateTime } from '../../lib/format';
import { EmptyState, ErrorBanner, LoadingState, StatCard, StatusBadge } from '../../components/UiPrimitives';

export function StoragePage() {
  const [data, setData] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await adminApi.storage.getOverview();
      setData(overview);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label="Analyzing cloud storage utilization..." />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <EmptyState title="No storage telemetry available" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Storage Management</h1>
        <p className="text-sm text-slate-500">Cloud storage capacity, user-wise & plan-wise consumption, and upload exceptions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Cloud Storage" value={formatBytes(data.totalCapacityBytes)} icon={<HardDrive className="w-5 h-5" />} />
        <StatCard label="Storage Used" value={formatBytes(data.totalUsedBytes)} subtext={`${data.utilizationPercent}% utilized`} icon={<Layers className="w-5 h-5" />} />
        <StatCard label="Available Storage" value={formatBytes(data.totalAvailableBytes)} tone="emerald" icon={<HardDrive className="w-5 h-5" />} />
        <StatCard
          label="Upload Exceptions"
          value={data.uploadExceptions.length}
          tone={data.uploadExceptions.length > 0 ? 'rose' : 'emerald'}
          icon={<AlertOctagon className="w-5 h-5" />}
        />
      </div>

      {/* Capacity bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-slate-900">Cloud Bucket Utilization</span>
          <span className="text-slate-600">{data.utilizationPercent}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all"
            style={{ width: `${Math.min(100, data.utilizationPercent)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Storage Growth (Last 30 Days)</h2>
          {data.storageGrowth.length === 0 ? (
            <EmptyState title="No storage growth events recorded" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.storageGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatBytes(Number(v))} tick={{ fontSize: 11 }} width={72} />
                  <Tooltip formatter={(v) => formatBytes(Number(v))} />
                  <Area type="monotone" dataKey="value" name="Used Storage" stroke="#4f46e5" fill="#e0e7ff" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Plan-wise Storage Usage</h2>
          {data.planWiseUsage.length === 0 ? (
            <EmptyState title="No plan usage data" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 font-semibold">Plan</th>
                    <th className="py-2 font-semibold">Users</th>
                    <th className="py-2 font-semibold">Used</th>
                    <th className="py-2 font-semibold">Allocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.planWiseUsage.map((p) => (
                    <tr key={p.planName}>
                      <td className="py-2.5 font-medium text-slate-900">{p.planName}</td>
                      <td className="py-2.5 text-slate-600">{p.userCount}</td>
                      <td className="py-2.5 text-slate-800">{formatBytes(p.usedBytes)}</td>
                      <td className="py-2.5 text-slate-500">{formatBytes(p.allocatedBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* User-wise usage */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">User-wise Storage Consumption (Top 50)</h2>
        </div>
        {data.userWiseUsage.length === 0 ? (
          <div className="p-5"><EmptyState title="No user storage records" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Documents</th>
                  <th className="px-4 py-3 font-semibold">Used / Quota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.userWiseUsage.map((u) => {
                  const pct = u.quotaBytes > 0 ? Math.min(100, Math.round((u.usedBytes / u.quotaBytes) * 100)) : 0;
                  return (
                    <tr key={u.userId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{u.fullName}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{u.planName}</td>
                      <td className="px-4 py-3 text-slate-700">{u.documentCount}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-slate-800">
                          {formatBytes(u.usedBytes)} / {formatBytes(u.quotaBytes)} ({pct}%)
                        </div>
                        <div className="w-40 h-1.5 bg-slate-100 rounded-full mt-1">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Storage Exceptions & Upload Failures */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Storage Exceptions & Failed Uploads</h2>
        </div>
        {data.uploadExceptions.length === 0 ? (
          <div className="p-5"><EmptyState title="No storage exceptions detected" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">File</th>
                  <th className="px-4 py-3 font-semibold">Exception</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.uploadExceptions.map((ex) => (
                  <tr key={ex._id}>
                    <td className="px-4 py-3 text-slate-700">{ex.userEmail || ex.userId}</td>
                    <td className="px-4 py-3 text-xs">
                      {ex.fileName || 'Unknown'} ({formatBytes(ex.sizeBytes)})
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status="failed" />
                      <span className="ml-2 text-xs text-rose-700">{ex.failureMessage}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(ex.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

