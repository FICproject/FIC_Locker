import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Search, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import type { AdminUserDetail, AdminUserSummary } from '@docscanner/shared-types';
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

  useAdminLiveSync(() => {
    loadUsers(true);
    if (selectedUser?._id) {
      adminApi.users.getById(selectedUser._id).then(setSelectedUser).catch(() => {});
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500">Manage registered accounts, statuses, recovery escalations, and deletion requests</p>
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
                        <div><StatusBadge status="pending" /> <span className="text-[11px] text-amber-700">Recovery</span></div>
                      )}
                      {u.deletionRequestStatus === 'pending' && (
                        <div><StatusBadge status="pending" /> <span className="text-[11px] text-rose-700">Deletion</span></div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{u.planName || 'Free'}</td>
                    <td className="px-4 py-3 text-slate-700">{formatBytes(u.storageUsedBytes)}</td>
                    <td className="px-4 py-3 text-slate-700">{u.totalDocuments}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(u.registrationDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openUserDetail(u._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}

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
                  <p className="font-medium text-slate-900">{selectedUser.totalDocuments}</p>
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
                {selectedUser.status !== 'active' && (
                  <button
                    disabled={actionBusy}
                    onClick={() => handleStatusChange(selectedUser._id, 'active')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" /> {selectedUser.status === 'suspended' ? 'Reactivate User' : 'Activate User'}
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

