import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Users,
  FileText,
  HardDrive,
  IndianRupee,
  Calendar,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  UploadCloud,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { adminApi, DashboardPayload } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { formatBytes, formatCurrencyInr, formatDate } from '../../lib/format';
import { EmptyState, ErrorBanner, LoadingState, StatusBadge } from '../../components/UiPrimitives';
import {
  formatRelativeTime,
  SparklineWave,
  WelcomeBannerIllustration,
} from '../../components/BrandAssets';

const SUB_COLORS = ['#1D63DC', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export function DashboardPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.dashboard.getOverview(days);
      setData(payload);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState label="Loading platform telemetry..." />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <EmptyState title="No dashboard data available" />;

  const { kpis, charts, recentRegistrations, recentActivities, alerts } = data;

  const usedPct =
    kpis.totalStorageCapacityBytes > 0
      ? Math.round((kpis.totalStorageUsedBytes / kpis.totalStorageCapacityBytes) * 100)
      : 0;
  const storageDonut = [
    { name: 'Used', value: Math.max(kpis.totalStorageUsedBytes, 0) },
    { name: 'Available', value: Math.max(kpis.totalStorageAvailableBytes, 1) },
  ];

  const todayLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-r from-[#EEF5FF] via-white to-[#FFF7E6] border border-blue-100 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs overflow-hidden">
        <div className="space-y-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Welcome Back, Admin! <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-sm text-slate-600">Here&apos;s your platform overview for today.</p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1D63DC] text-white text-xs font-semibold shadow-sm">
              <Calendar className="w-3.5 h-3.5" />
              <span>{todayLabel}</span>
            </div>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
        <div className="hidden sm:block">
          <WelcomeBannerIllustration />
        </div>
      </div>

      {/* 4 Pastel Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-[#F0F7FF] to-[#E2EEFF] border border-blue-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[#DCEAFE] text-[#1D63DC] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{kpis.totalUsers.toLocaleString('en-IN')}</p>
                <p className="text-xs font-medium text-slate-600">Total Users</p>
              </div>
            </div>
            <SparklineWave color="#1D63DC" />
          </div>
          <p className="mt-3 text-xs font-medium text-[#1D63DC]">
            {kpis.activeUsers} active • {kpis.suspendedUsers} suspended
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-gradient-to-br from-[#F0FDF7] to-[#DCFCEB] border border-emerald-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[#D1FAE5] text-[#059669] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{kpis.totalDocuments.toLocaleString('en-IN')}</p>
                <p className="text-xs font-medium text-slate-600">Total Documents</p>
              </div>
            </div>
            <SparklineWave color="#10B981" />
          </div>
          <p className="mt-3 text-xs font-medium text-[#059669]">
            {kpis.successfulUploads} successful • {kpis.failedUploads} failed uploads
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-gradient-to-br from-[#FFF9EE] to-[#FEF0D6] border border-amber-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[#FDE68A]/70 text-[#D97706] flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatBytes(kpis.totalStorageUsedBytes)}</p>
                <p className="text-xs font-medium text-slate-600">Storage Used</p>
              </div>
            </div>
            <SparklineWave color="#F59E0B" />
          </div>
          <p className="mt-3 text-xs font-medium text-[#B45309]">
            {formatBytes(kpis.totalStorageAvailableBytes)} available ({usedPct}% used)
          </p>
        </div>

        <div className="rounded-2xl p-5 bg-gradient-to-br from-[#F7F3FF] to-[#EDE9FE] border border-purple-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[#DDD6FE] text-[#7C3AED] flex items-center justify-center shrink-0">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatCurrencyInr(kpis.totalRevenueInr)}</p>
                <p className="text-xs font-medium text-slate-600">Total Revenue</p>
              </div>
            </div>
            <SparklineWave color="#7C3AED" />
          </div>
          <p className="mt-3 text-xs font-medium text-[#6D28D9]">
            {kpis.activeSubscriptions} active subscriptions
          </p>
        </div>
      </div>

      {/* Secondary Live Counters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Active Users', val: kpis.activeUsers },
          { label: 'Suspended Users', val: kpis.suspendedUsers },
          { label: 'Total Uploads', val: kpis.totalUploads },
          { label: 'Failed Uploads', val: kpis.failedUploads },
          { label: 'Open Tickets', val: alerts.openTicketsCount },
          { label: 'Pending Reviews', val: alerts.pendingDeletionsCount + alerts.pendingRecoveriesCount },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500">{item.label}</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{item.val}</p>
          </div>
        ))}
      </div>

      {/* Primary Charts Row: User Growth Overview + Storage Usage Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">User Growth Overview</h2>
            <span className="text-xs font-medium text-slate-500">Last {days} Days</span>
          </div>
          {charts.userRegistrationGrowth.length === 0 ? (
            <EmptyState title="No registrations in selected period" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.userRegistrationGrowth}>
                  <defs>
                    <linearGradient id="userGrowthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D63DC" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#1D63DC" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Registered Users"
                    stroke="#1D63DC"
                    strokeWidth={2.5}
                    fill="url(#userGrowthFill)"
                    dot={{ r: 3.5, fill: '#1D63DC', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col">
          <h2 className="text-base font-bold text-slate-900 mb-3">Storage Usage</h2>
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={storageDonut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={80}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    <Cell fill="#1D63DC" />
                    <Cell fill="#FDE68A" />
                  </Pie>
                  <Tooltip formatter={(v) => formatBytes(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900">{usedPct}%</span>
                <span className="text-xs text-slate-500">Used</span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#1D63DC]" />
                <span className="text-slate-600 w-20">Used</span>
                <strong className="text-slate-900">{formatBytes(kpis.totalStorageUsedBytes)}</strong>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#FDE68A]" />
                <span className="text-slate-600 w-20">Available</span>
                <strong className="text-slate-900">{formatBytes(kpis.totalStorageAvailableBytes)}</strong>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                Total Quota: <strong className="text-slate-800">{formatBytes(kpis.totalStorageCapacityBytes)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Charts Row: Uploads, Revenue & Subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Document Upload Statistics</h2>
          {charts.documentUploadStats.length === 0 ? (
            <EmptyState title="No upload sessions yet" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.documentUploadStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successful" name="Success" stackId="a" fill="#10B981" />
                  <Bar dataKey="failed" name="Failed" stackId="a" fill="#F43F5E" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Revenue Overview (INR)</h2>
          {charts.revenueOverview.length === 0 ? (
            <EmptyState title="No captured payments yet" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.revenueOverview}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatCurrencyInr(Number(v))} />
                  <Bar dataKey="value" name="Revenue" fill="#1D63DC" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Subscription Statistics</h2>
          {charts.subscriptionStats.length === 0 ? (
            <EmptyState title="No active subscriptions" />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.subscriptionStats} dataKey="value" nameKey="name" innerRadius={35} outerRadius={68}>
                    {charts.subscriptionStats.map((entry, idx) => (
                      <Cell key={entry.name} fill={SUB_COLORS[idx % SUB_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Bottom 3-Column Section: Recent Users, Recent Activities, Platform Security Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Recent Users</h2>
            <Link to="/users" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D63DC] hover:underline">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentRegistrations.length === 0 ? (
            <EmptyState title="No users registered yet" />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentRegistrations.slice(0, 5).map((u) => (
                <div key={u._id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-[#0B3B91] font-bold text-xs flex items-center justify-center shrink-0">
                      {u.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{u.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block text-[11px] font-medium text-slate-500">
                      {formatRelativeTime(u.registrationDate)}
                    </span>
                    <div className="mt-0.5"><StatusBadge status={u.status} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">Recent Activities</h2>
            <Link to="/audit-logs" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D63DC] hover:underline">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentActivities.length === 0 ? (
            <EmptyState title="No audit activities recorded yet" />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivities.slice(0, 5).map((a) => {
                const isDoc = a.entityType === 'document';
                const isPay = a.entityType === 'payment';
                return (
                  <div key={a._id} className="py-2.5 flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isDoc
                          ? 'bg-emerald-50 text-emerald-600'
                          : isPay
                            ? 'bg-purple-50 text-purple-600'
                            : 'bg-blue-50 text-[#1D63DC]'
                      }`}
                    >
                      {isDoc ? (
                        <UploadCloud className="w-4 h-4" />
                      ) : isPay ? (
                        <CreditCard className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{a.summary}</p>
                      <p className="text-xs text-slate-500">
                        {formatRelativeTime(a.createdAt)} • {a.sourceApp} • {formatDate(a.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 rounded-2xl p-6 bg-gradient-to-br from-[#22C55E] via-[#10B981] to-[#047857] text-white shadow-md flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-4">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h3 className="text-lg font-bold leading-snug">Your Platform is Secure &amp; Reliable</h3>
          <p className="text-xs text-emerald-50 mt-2 mb-5">
            Single-Admin RBAC active • {alerts.failedUploads} failed uploads • {alerts.openTicketsCount} open tickets
          </p>
          <Link
            to="/audit-logs"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-sm hover:bg-emerald-50 transition"
          >
            View Details <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
