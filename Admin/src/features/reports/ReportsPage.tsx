import React, { useCallback, useEffect, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { EmptyState, ErrorBanner, LoadingState } from '../../components/UiPrimitives';

const REPORT_OPTIONS = [
  { id: 'user-registration', label: 'User Registration Report' },
  { id: 'active-users', label: 'Active Users Report' },
  { id: 'document-uploads', label: 'Document Upload Report' },
  { id: 'storage-usage', label: 'Storage Usage Report' },
  { id: 'subscriptions', label: 'Subscription Report' },
  { id: 'payments', label: 'Payment Transactions Report' },
  { id: 'revenue', label: 'Revenue Report' },
  { id: 'failed-uploads', label: 'Failed Upload Report' },
  { id: 'support', label: 'Support Tickets Report' },
];

export function ReportsPage() {
  const [reportType, setReportType] = useState('user-registration');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<{ summary: Record<string, unknown>; rows: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.reports.getReport(reportType, {
        from: from || undefined,
        to: to || undefined,
      });
      setData(res);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [reportType, from, to]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExport = async () => {
    try {
      const blob = await adminApi.reports.exportCsv(reportType, {
        from: from || undefined,
        to: to || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const columns = data?.rows.length ? Object.keys(data.rows[0]) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Generate date-filtered operational & financial reports and export CSV</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadReport} />}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Report Type</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
          >
            {REPORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <button
          onClick={loadReport}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
        >
          <Filter className="w-4 h-4" /> Apply
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(data.summary).map(([key, val]) => (
            <div key={key} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs uppercase text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{String(val)}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState title="No records match this report criteria" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase text-slate-500">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-4 py-3 font-semibold whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {columns.map((c) => (
                      <td key={c} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                        {String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

