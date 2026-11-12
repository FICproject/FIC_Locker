import React, { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileWarning, Search, Wrench } from 'lucide-react';
import type { AdminDocumentRecord, CategoryRecord, StorageOverview } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { useAdminLiveSync } from '../../hooks/useAdminLiveSync';
import { formatBytes, formatDateTime } from '../../lib/format';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Modal,
  Pagination,
  StatusBadge,
  SuccessBanner,
} from '../../components/UiPrimitives';

export function DocumentsPage() {
  const [tab, setTab] = useState<'all' | 'failed'>('all');
  const [docs, setDocs] = useState<AdminDocumentRecord[]>([]);
  const [failedUploads, setFailedUploads] = useState<StorageOverview['uploadExceptions']>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userIdFilter, setUserIdFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedDoc, setSelectedDoc] = useState<AdminDocumentRecord | null>(null);
  const [previewState, setPreviewState] = useState<{ url: string; mimeType: string; filename: string } | null>(null);
  const [issueNotes, setIssueNotes] = useState('');
  const [issueStatus, setIssueStatus] = useState<'available' | 'failed' | 'deleted'>('available');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.categories.list().then(setCategories).catch(() => {});
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (tab === 'all') {
        const res = await adminApi.documents.list({
          page,
          limit: 20,
          search: search.trim() || undefined,
          categoryId: categoryFilter || undefined,
          status: statusFilter,
          userId: userIdFilter.trim() || undefined,
        });
        setDocs(res.data);
        setTotal(res.meta?.total ?? res.data.length);
        setTotalPages(res.meta?.totalPages ?? 1);
      } else {
        const res = await adminApi.documents.failedUploads({ page, limit: 20 });
        setFailedUploads(res.data);
        setTotal(res.meta?.total ?? res.data.length);
        setTotalPages(res.meta?.totalPages ?? 1);
      }
    } catch (err) {
      if (!silent) setError(extractErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab, page, search, categoryFilter, statusFilter, userIdFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAdminLiveSync(() => {
    loadData(true);
    if (selectedDoc?._id) {
      adminApi.documents.getById(selectedDoc._id).then(setSelectedDoc).catch(() => {});
    }
  });

  const handleOpenDoc = async (docId: string) => {
    try {
      const detail = await adminApi.documents.getById(docId);
      setSelectedDoc(detail);
      setPreviewState(null);
      setIssueNotes(detail.operationalNotes || '');
      setIssueStatus(
        detail.status === 'failed' || detail.status === 'deleted' ? detail.status : 'available'
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const handleAccess = async (mode: 'preview' | 'download', fileIndex = 0) => {
    if (!selectedDoc) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.documents.getAccessUrl(selectedDoc._id, {
        mode,
        fileIndex,
        reason: `Admin ${mode} from Web Console`,
      });
      if (mode === 'preview') {
        setPreviewState({ url: res.url, mimeType: res.mimeType, filename: res.filename });
        setSuccess(`Presigned preview URL generated (valid ${res.expiresInSeconds}s) and recorded in Audit Logs.`);
      } else {
        window.open(res.url, '_blank', 'noopener,noreferrer');
        setSuccess(`Download initiated and recorded in Audit Logs.`);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleIssueUpdate = async () => {
    if (!selectedDoc) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.documents.resolveIssue(selectedDoc._id, {
        status: issueStatus,
        operationalNotes: issueNotes,
      });
      setSuccess('Document operational status updated and logged.');
      setSelectedDoc(null);
      await loadData();
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
          <h1 className="text-2xl font-bold text-slate-900">Document Management</h1>
          <p className="text-sm text-slate-500">
            Audited platform-wide access to stored documents and upload failure monitoring
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-200 p-1 text-xs font-semibold">
          <button
            onClick={() => { setTab('all'); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-lg cursor-pointer ${tab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
          >
            All Documents
          </button>
          <button
            onClick={() => { setTab('failed'); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer ${tab === 'failed' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'}`}
          >
            <FileWarning className="w-3.5 h-3.5" /> Failed Uploads
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => loadData()} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      {tab === 'all' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search document name, type, or tags..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl"
            />
          </div>
          <input
            type="text"
            value={userIdFilter}
            onChange={(e) => { setPage(1); setUserIdFilter(e.target.value); }}
            placeholder="Filter by User ID..."
            className="px-3 py-2 text-sm border border-slate-300 rounded-xl w-44"
          />
          <select
            value={categoryFilter}
            onChange={(e) => { setPage(1); setCategoryFilter(e.target.value); }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
          >
            <option value="all">All Upload Statuses</option>
            <option value="available">Available</option>
            <option value="verifying">Verifying</option>
            <option value="uploading">Uploading</option>
            <option value="failed">Failed</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : tab === 'all' ? (
        docs.length === 0 ? (
          <EmptyState title="No documents found" description="No documents match your active filters." />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">File Type / Size</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Uploaded</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docs.map((d) => (
                    <tr key={d._id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{d.name}</p>
                        {d.tags.length > 0 && (
                          <p className="text-xs text-slate-400">Tags: {d.tags.join(', ')}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{d.ownerName || 'User'}</p>
                        <p className="text-xs text-slate-500">{d.ownerEmail || d.ownerId}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{d.categoryName || 'Uncategorised'}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <p className="text-xs font-mono">{d.files[0]?.mimeType || '—'}</p>
                        <p className="text-xs text-slate-500">{formatBytes(d.totalSizeBytes)}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(d.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenDoc(d._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </div>
        )
      ) : failedUploads.length === 0 ? (
        <EmptyState title="No failed uploads recorded" description="All upload sessions have succeeded or been cleaned up." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">File</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Failure Message</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {failedUploads.map((f) => (
                  <tr key={f._id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{f.fileName || 'Unnamed file'}</p>
                      <p className="text-xs text-slate-500">{f.mimeType || 'unknown'} • {formatBytes(f.sizeBytes)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{f.userEmail || f.userId}</td>
                    <td className="px-4 py-3"><StatusBadge status="failed" /> <span className="text-xs ml-1 text-slate-600">{f.failureCategory}</span></td>
                    <td className="px-4 py-3 text-rose-700 text-xs">{f.failureMessage}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(f.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* Document Detail & Audited Access Modal */}
      <Modal
        open={Boolean(selectedDoc)}
        title={selectedDoc ? `Document — ${selectedDoc.name}` : ''}
        onClose={() => setSelectedDoc(null)}
        maxWidth="max-w-3xl"
      >
        {selectedDoc && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <p className="text-xs text-slate-500">Owner</p>
                <p className="font-medium">{selectedDoc.ownerEmail || selectedDoc.ownerId}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Category</p>
                <p className="font-medium">{selectedDoc.categoryName || 'Uncategorised'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Upload Status</p>
                <StatusBadge status={selectedDoc.status} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Size</p>
                <p className="font-medium">{formatBytes(selectedDoc.totalSizeBytes)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Files Count</p>
                <p className="font-medium">{selectedDoc.files.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Uploaded At</p>
                <p className="font-medium">{formatDateTime(selectedDoc.createdAt)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy || selectedDoc.files.length === 0}
                onClick={() => handleAccess('preview', 0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                <Eye className="w-4 h-4" /> Audited Preview
              </button>
              <button
                disabled={busy || selectedDoc.files.length === 0}
                onClick={() => handleAccess('download', 0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-xl hover:bg-slate-900 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Audited Download
              </button>
            </div>

            {previewState && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
                <div className="px-3 py-2 bg-slate-200 text-xs font-medium text-slate-700">
                  Preview: {previewState.filename} ({previewState.mimeType})
                </div>
                {previewState.mimeType.startsWith('image/') ? (
                  <img src={previewState.url} alt={previewState.filename} className="max-h-96 mx-auto object-contain" />
                ) : (
                  <iframe src={previewState.url} title={previewState.filename} className="w-full h-96 bg-white" />
                )}
              </div>
            )}

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> Operational Issue Management
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={issueStatus}
                  onChange={(e) => setIssueStatus(e.target.value as typeof issueStatus)}
                  className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                >
                  <option value="available">Available</option>
                  <option value="failed">Failed</option>
                  <option value="deleted">Deleted</option>
                </select>
                <input
                  type="text"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="Operational resolution notes..."
                  className="sm:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>
              <button
                disabled={busy}
                onClick={handleIssueUpdate}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 cursor-pointer"
              >
                Save Operational Update
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

