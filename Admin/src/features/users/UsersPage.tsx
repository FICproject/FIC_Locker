import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Eye,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
  FileText,
  Download,
  FolderOpen,
  ArrowLeft,
  X,
  ExternalLink,
} from 'lucide-react';
import type { AdminDocumentRecord, AdminUserDetail, AdminUserSummary, CategoryRecord } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { useAdminLiveSync } from '../../hooks/useAdminLiveSync';
import { formatBytes, formatDate, formatDateTime } from '../../lib/format';
import {
  EmptyState,
  ErrorBanner,
  LoadingState,
  Modal,
  Pagination,
  StatusBadge,
  SuccessBanner,
} from '../../components/UiPrimitives';

export function UsersPage() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q) {
      setSearch(q);
      setPage(1);
    }
  }, [searchParams]);

  const [statusFilter, setStatusFilter] = useState('all');
  const [requestType, setRequestType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // User documents viewer drawer/modal state
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [userDocsCategory, setUserDocsCategory] = useState('');
  const [docsModalUser, setDocsModalUser] = useState<AdminUserSummary | AdminUserDetail | null>(null);
  const [userDocs, setUserDocs] = useState<AdminDocumentRecord[]>([]);
  const [userDocsLoading, setUserDocsLoading] = useState(false);
  const [userDocsPage, setUserDocsPage] = useState(1);
  const [userDocsTotalPages, setUserDocsTotalPages] = useState(1);
  const [userDocsTotal, setUserDocsTotal] = useState(0);

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<AdminDocumentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<{ url: string; mimeType: string; filename: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const loadUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await adminApi.users.list({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: statusFilter,
        requestType: requestType || undefined,
      });
      setUsers(res.data);
      setTotal(res.meta?.total ?? res.data.length);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err) {
      if (!silent) setError(extractErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, search, statusFilter, requestType]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    adminApi.categories.list().then(setCategories).catch(() => {});
  }, []);

  // Load documents for a specific user
  const loadUserDocuments = useCallback(async (userId: string, p = 1, categoryId = '') => {
    setUserDocsLoading(true);
    try {
      const res = await adminApi.documents.list({
        userId,
        categoryId: categoryId || undefined,
        page: p,
        limit: 10,
      });
      setUserDocs(res.data);
      setUserDocsTotal(res.meta?.total ?? res.data.length);
      setUserDocsTotalPages(res.meta?.totalPages ?? 1);
      setUserDocsPage(p);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setUserDocsLoading(false);
    }
  }, []);

  const openUserDocs = (u: AdminUserSummary | AdminUserDetail) => {
    setDocsModalUser(u);
    setPreviewDoc(null);
    setPreviewUrl(null);
    setUserDocsCategory('');
    loadUserDocuments(u._id, 1, '');
  };

  useAdminLiveSync(() => {
    loadUsers(true);
    if (selectedUser?._id) {
      adminApi.users.getById(selectedUser._id).then(setSelectedUser).catch(() => {});
    }
    if (docsModalUser?._id) {
      loadUserDocuments(docsModalUser._id, userDocsPage, userDocsCategory);
    }
  });

  const openUserDetail = async (userId: string) => {
    setDetailLoading(true);
    setActionNotes('');
    try {
      const detail = await adminApi.users.getById(userId);
      setSelectedUser(detail);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, nextStatus: 'active' | 'suspended') => {
    setActionBusy(true);
    setError(null);
    try {
      await adminApi.users.updateStatus(userId, nextStatus, actionNotes || undefined);
      setSuccess(`User account ${nextStatus === 'active' ? 'activated' : 'suspended'} successfully.`);
      setSelectedUser(null);
      await loadUsers();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleRecovery = async (userId: string, decision: 'approved' | 'rejected') => {
    setActionBusy(true);
    try {
      await adminApi.users.reviewRecovery(userId, decision, actionNotes || undefined);
      setSuccess(`Recovery request ${decision}.`);
      setSelectedUser(null);
      await loadUsers();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeletion = async (userId: string, decision: 'approved' | 'rejected') => {
    setActionBusy(true);
    try {
      await adminApi.users.reviewDeletion(userId, decision, actionNotes || undefined);
      setSuccess(`Account deletion request ${decision}.`);
      setSelectedUser(null);
      await loadUsers();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleDocAccess = async (doc: AdminDocumentRecord, mode: 'preview' | 'download', fileIndex = 0) => {
    setPreviewBusy(true);
    setError(null);
    try {
      const res = await adminApi.documents.getAccessUrl(doc._id, {
        mode,
        fileIndex,
        reason: `Admin user document inspection from Users Tab`,
      });
      if (mode === 'preview') {
        setPreviewDoc(doc);
        setPreviewUrl({ url: res.url, mimeType: res.mimeType, filename: res.filename });
        setSuccess(`Preview generated for "${doc.name}" (logged in audit trail).`);
      } else {
        window.open(res.url, '_blank', 'noopener,noreferrer');
        setSuccess(`Audited download initiated for "${doc.name}".`);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setPreviewBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500">
          Manage registered accounts, inspect user documents, review account statuses, and process escalations
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => loadUsers()} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
        <select
          value={requestType}
          onChange={(e) => {
            setPage(1);
            setRequestType(e.target.value);
          }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
        >
          <option value="">All Requests</option>
          <option value="recovery">Pending Recovery Requests</option>
          <option value="deletion">Pending Deletion Requests</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" description="Try adjusting your search query or filters." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Storage Used</th>
                  <th className="px-4 py-3 font-semibold">Docs</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{u.fullName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      {u.phone && <p className="text-xs text-slate-400">{u.phone}</p>}
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <StatusBadge status={u.status} />
                      {u.recoveryRequestStatus === 'pending' && (
                        <div>
                          <StatusBadge status="pending" /> <span className="text-[11px] text-amber-700">Recovery</span>
                        </div>
                      )}
                      {u.deletionRequestStatus === 'pending' && (
                        <div>
                          <StatusBadge status="pending" /> <span className="text-[11px] text-rose-700">Deletion</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{u.planName || 'Free'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatBytes(u.storageUsedBytes)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openUserDocs(u)}
                        title="Click to view documents uploaded by this user"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0646A0] font-bold text-xs cursor-pointer transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{u.totalDocuments || 0}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(u.registrationDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openUserDocs(u)}
                          title="View User Documents"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0646A0] bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> View Docs
                        </button>
                        <button
                          onClick={() => openUserDetail(u._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}

      {/* User Documents Modal */}
      <Modal
        open={Boolean(docsModalUser)}
        title={docsModalUser ? `Documents — ${docsModalUser.fullName} (${docsModalUser.email})` : 'User Documents'}
        onClose={() => {
          setDocsModalUser(null);
          setPreviewDoc(null);
          setPreviewUrl(null);
        }}
        maxWidth="max-w-4xl"
      >
        {docsModalUser && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F0F4FC] p-3.5 rounded-xl border border-[#DCE5F5]">
              <div className="text-xs text-[#102A5E]">
                <span className="font-semibold">{docsModalUser.fullName}</span> has{' '}
                <span className="font-bold text-[#0646A0]">{userDocsTotal} document(s)</span> using{' '}
                <span className="font-bold">{formatBytes(docsModalUser.storageUsedBytes)}</span> of cloud storage.
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Category:</span>
                <select
                  value={userDocsCategory}
                  onChange={(e) => {
                    const next = e.target.value;
                    setUserDocsCategory(next);
                    loadUserDocuments(docsModalUser._id, 1, next);
                  }}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c._id || c.name} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-[#64748B] ml-2">Audited Admin Access</div>
              </div>
            </div>

            {/* Document Preview Pane if active */}
            {previewDoc && previewUrl && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0646A0]" />
                    <span className="font-bold text-sm text-[#102A5E]">{previewDoc.name}</span>
                    <span className="text-xs text-[#64748B]">({previewUrl.mimeType})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDocAccess(previewDoc, 'download', 0)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                    <button
                      onClick={() => {
                        setPreviewDoc(null);
                        setPreviewUrl(null);
                      }}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  {previewUrl.mimeType.startsWith('image/') ? (
                    <img
                      src={previewUrl.url}
                      alt={previewUrl.filename}
                      className="max-h-96 mx-auto object-contain p-2"
                    />
                  ) : (
                    <iframe
                      src={previewUrl.url}
                      title={previewUrl.filename}
                      className="w-full h-96 bg-white"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Documents List Table */}
            {userDocsLoading ? (
              <LoadingState label="Loading user documents..." />
            ) : userDocs.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#64748B]">
                <FolderOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No documents uploaded yet</p>
                <p className="text-xs text-slate-500 mt-1">This user has not stored any files in their vault.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">Document Name</th>
                      <th className="px-3.5 py-2.5 font-semibold">Category</th>
                      <th className="px-3.5 py-2.5 font-semibold">Size</th>
                      <th className="px-3.5 py-2.5 font-semibold">Status</th>
                      <th className="px-3.5 py-2.5 font-semibold">Uploaded</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {userDocs.map((doc) => (
                      <tr key={doc._id} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[220px]">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">{doc.categoryName || 'Uncategorised'}</td>
                        <td className="px-3.5 py-2.5 text-slate-600 font-mono">{formatBytes(doc.totalSizeBytes)}</td>
                        <td className="px-3.5 py-2.5">
                          <StatusBadge status={doc.status} />
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500">{formatDate(doc.createdAt)}</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              disabled={previewBusy || doc.files.length === 0}
                              onClick={() => handleDocAccess(doc, 'preview', 0)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#0646A0] bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition disabled:opacity-50"
                            >
                              Preview
                            </button>
                            <button
                              disabled={previewBusy || doc.files.length === 0}
                              onClick={() => handleDocAccess(doc, 'download', 0)}
                              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition disabled:opacity-50"
                              title="Download document"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  page={userDocsPage}
                  totalPages={userDocsTotalPages}
                  total={userDocsTotal}
                  onPageChange={(p) => docsModalUser && loadUserDocuments(docsModalUser._id, p, userDocsCategory)}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* User Detail Modal */}
      <Modal
        open={Boolean(selectedUser) || detailLoading}
        title={selectedUser ? `User Profile — ${selectedUser.fullName}` : 'Loading User...'}
        onClose={() => setSelectedUser(null)}
        maxWidth="max-w-2xl"
      >
        {detailLoading ? (
          <LoadingState label="Loading user profile..." />
        ) : (
          selectedUser && (
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="font-medium text-slate-900">{selectedUser.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Account Status</p>
                  <StatusBadge status={selectedUser.status} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Registration Date</p>
                  <p className="font-medium text-slate-900">{formatDateTime(selectedUser.registrationDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Storage Used</p>
                  <p className="font-medium text-slate-900">{formatBytes(selectedUser.storageUsedBytes)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Documents</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-medium text-slate-900">{selectedUser.totalDocuments}</span>
                    <button
                      onClick={() => {
                        const u = selectedUser;
                        setSelectedUser(null);
                        openUserDocs(u);
                      }}
                      className="text-xs font-bold text-[#0646A0] hover:underline cursor-pointer"
                    >
                      (View Documents &rarr;)
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Subscription Plan</p>
                  <p className="font-medium text-slate-900">
                    {selectedUser.subscription?.planName || selectedUser.planName || 'Free'}{' '}
                    {selectedUser.subscription && `(${selectedUser.subscription.status})`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last Active</p>
                  <p className="font-medium text-slate-900">{formatDateTime(selectedUser.lastActiveAt)}</p>
                </div>
              </div>

              {selectedUser.suspensionReason && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <strong>Suspension Reason:</strong> {selectedUser.suspensionReason}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Admin Action Notes / Suspension Reason
                </label>
                <textarea
                  rows={2}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Optional reason or review notes (recorded in audit log)..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex flex-wrap gap-2.5 pt-2 border-t border-slate-200">
                <button
                  onClick={() => {
                    const u = selectedUser;
                    setSelectedUser(null);
                    openUserDocs(u);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0646A0] bg-blue-50 hover:bg-blue-100 rounded-xl cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" /> View User Documents
                </button>

                {selectedUser.status !== 'active' && (
                  <button
                    disabled={actionBusy}
                    onClick={() => handleStatusChange(selectedUser._id, 'active')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />{' '}
                    {selectedUser.status === 'suspended' ? 'Reactivate User' : 'Activate User'}
                  </button>
                )}
                {selectedUser.status === 'active' && (
                  <button
                    disabled={actionBusy}
                    onClick={() => handleStatusChange(selectedUser._id, 'suspended')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
                  >
                    <UserX className="w-4 h-4" /> Suspend User
                  </button>
                )}

                {selectedUser.recoveryRequestStatus === 'pending' && (
                  <>
                    <button
                      disabled={actionBusy}
                      onClick={() => handleRecovery(selectedUser._id, 'approved')}
                      className="px-3 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 cursor-pointer"
                    >
                      Approve Recovery
                    </button>
                    <button
                      disabled={actionBusy}
                      onClick={() => handleRecovery(selectedUser._id, 'rejected')}
                      className="px-3 py-2 text-xs font-semibold bg-slate-200 text-slate-800 rounded-xl hover:bg-slate-300 cursor-pointer"
                    >
                      Reject Recovery
                    </button>
                  </>
                )}

                {selectedUser.deletionRequestStatus === 'pending' && (
                  <>
                    <button
                      disabled={actionBusy}
                      onClick={() => handleDeletion(selectedUser._id, 'approved')}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-rose-700 text-white rounded-xl hover:bg-rose-800 cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Approve Account Deletion
                    </button>
                    <button
                      disabled={actionBusy}
                      onClick={() => handleDeletion(selectedUser._id, 'rejected')}
                      className="px-3 py-2 text-xs font-semibold bg-slate-200 text-slate-800 rounded-xl hover:bg-slate-300 cursor-pointer"
                    >
                      Reject Deletion
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
