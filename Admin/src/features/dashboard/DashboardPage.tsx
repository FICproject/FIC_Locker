import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Users,
  FileText,
  Database,
  IndianRupee,
  Calendar,
  ChevronDown,
  BarChart3,
  Headphones,
  Folder,
  MoreVertical,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { adminApi, DashboardPayload } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { formatBytes, formatCurrencyInr } from '../../lib/format';
import { EmptyState, ErrorBanner, LoadingState } from '../../components/UiPrimitives';
import { useAdminLiveSync } from '../../hooks/useAdminLiveSync';
import {
  SparklineWave,
  WelcomeBannerIllustration,
  SecurityCardIllustration,
  formatRelativeTime,
} from '../../components/BrandAssets';

export function DashboardPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const payload = await adminApi.dashboard.getOverview(days);
      setData(payload);
    } catch (err) {
      if (!silent) setError(extractErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  useAdminLiveSync(() => {
    load(true);
  });

  const todayLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  // Aggregate telemetry from live backend data
  const chartData = useMemo(() => {
    if (!data?.charts) return [];

    const dateMap = new Map<string, { date: string; label: string; users: number; documents: number; revenue: number }>();

    // User registration growth
    (data.charts.userRegistrationGrowth || []).forEach((item) => {
      const d = item.date || item.label;
      if (!dateMap.has(d)) {
        dateMap.set(d, { date: d, label: item.label || d, users: 0, documents: 0, revenue: 0 });
      }
      dateMap.get(d)!.users = item.value || 0;
    });

    // Documents uploads
    (data.charts.documentUploadStats || []).forEach((item) => {
      const d = item.date;
      if (!dateMap.has(d)) {
        dateMap.set(d, { date: d, label: d, users: 0, documents: 0, revenue: 0 });
      }
      dateMap.get(d)!.documents = (item.successful || 0) + (item.failed || 0);
    });

    // Revenue overview
    (data.charts.revenueOverview || []).forEach((item) => {
      const d = item.date || item.label;
      if (!dateMap.has(d)) {
        dateMap.set(d, { date: d, label: item.label || d, users: 0, documents: 0, revenue: 0 });
      }
      dateMap.get(d)!.revenue = item.value || 0;
    });

    // Sort by date ascending
    const sorted = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Format display labels nicely (e.g. "12 Nov" or month name)
    return sorted.map((item) => {
      try {
        const parts = item.date.split('-');
        if (parts.length === 3) {
          const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          return {
            ...item,
            displayLabel: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(dt),
          };
        }
      } catch {
        // fallback
      }
      return { ...item, displayLabel: item.label };
    });
  }, [data]);

  if (loading) return <LoadingState label="Loading platform telemetry..." />;
  if (error) return <ErrorBanner message={error} onRetry={() => load()} />;
  if (!data) return <EmptyState title="No dashboard data available" />;

  const { kpis, recentRegistrations = [], recentActivities = [] } = data;

  // Real KPI metrics from live database
  const totalUsersCount = kpis.totalUsers || 0;
  const totalDocsCount = kpis.totalDocuments || 0;
  const storageUsedBytes = kpis.totalStorageUsedBytes || 0;
  const storageCapacityBytes = kpis.totalStorageCapacityBytes || 1024 * 1024 * 1024 * 1024;
  const storageAvailBytes = Math.max(0, storageCapacityBytes - storageUsedBytes);
  const totalRevenueVal = kpis.totalRevenueInr || 0;

  // Storage usage calculation
  const usedPercentage = storageCapacityBytes > 0
    ? Math.min(100, Math.round((storageUsedBytes / storageCapacityBytes) * 100))
    : 0;

  const storageDonut = [
    { name: 'Used', value: Math.max(storageUsedBytes, 1), color: '#0646A0' },
    { name: 'Available', value: Math.max(storageAvailBytes, 1), color: '#E2E8F0' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Welcome Banner */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-xs relative overflow-hidden flex items-center justify-between min-h-[175px]">
        {/* Left: Content */}
        <div className="p-6 sm:p-8 space-y-2.5 z-10 max-w-md">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A5E] tracking-tight">
            Welcome Back, Admin!
          </h1>
          <p className="text-sm text-[#64748B]">
            Here&apos;s what&apos;s happening with your platform today.
          </p>

          <div className="pt-2">
            <button
              onClick={() => setDays(days === 30 ? 7 : 30)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#E5EAF2] shadow-2xs text-xs font-semibold text-[#102A5E] hover:bg-slate-50 transition cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#0646A0]" />
              <span>{todayLabel} ({days}d View)</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>
          </div>
        </div>

        {/* 3D Artwork banner */}
        <div className="absolute inset-y-0 right-0 w-full md:w-3/5 lg:w-3/5 pointer-events-none select-none">
          <WelcomeBannerIllustration />
        </div>
      </div>

      {/* 2. Four Solid White Metric KPI Cards from Live Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Users */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EAF2] shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0646A0] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <button
              onClick={() => navigate('/users')}
              title="View Users"
              className="text-slate-300 hover:text-slate-500 cursor-pointer p-1"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-extrabold text-[#102A5E] tracking-tight">
              {totalUsersCount.toLocaleString('en-IN')}
            </p>
            <p className="text-xs font-medium text-[#64748B] mt-0.5">Total Users</p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <span className="text-xs font-semibold text-[#64748B]">{kpis.activeUsers || 0} active</span>
            </div>
            <SparklineWave color="#0646A0" />
          </div>
        </div>

        {/* Card 2: Total Documents */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EAF2] shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0646A0] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <button
              onClick={() => navigate('/documents')}
              title="View Documents"
              className="text-slate-300 hover:text-slate-500 cursor-pointer p-1"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-extrabold text-[#102A5E] tracking-tight">
              {totalDocsCount.toLocaleString('en-IN')}
            </p>
            <p className="text-xs font-medium text-[#64748B] mt-0.5">Total Documents</p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <span className="text-xs font-semibold text-[#64748B]">{kpis.successfulUploads || 0} processed</span>
            </div>
            <SparklineWave color="#0646A0" />
          </div>
        </div>

        {/* Card 3: Storage Used */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EAF2] shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#F59E0B] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <button
              onClick={() => navigate('/storage')}
              title="View Storage"
              className="text-slate-300 hover:text-slate-500 cursor-pointer p-1"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-extrabold text-[#102A5E] tracking-tight">
              {formatBytes(storageUsedBytes)}
            </p>
            <p className="text-xs font-medium text-[#64748B] mt-0.5">Storage Used</p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <span className="text-xs font-semibold text-[#64748B]">{usedPercentage}% of {formatBytes(storageCapacityBytes)}</span>
            </div>
            <SparklineWave color="#F59E0B" />
          </div>
        </div>

        {/* Card 4: Total Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EAF2] shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#8B5CF6] flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
            <button
              onClick={() => navigate('/payments')}
              title="View Payments"
              className="text-slate-300 hover:text-slate-500 cursor-pointer p-1"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-extrabold text-[#102A5E] tracking-tight">
              {formatCurrencyInr(totalRevenueVal)}
            </p>
            <p className="text-xs font-medium text-[#64748B] mt-0.5">Total Revenue</p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
              <span className="text-xs font-semibold text-[#64748B]">{kpis.activeSubscriptions || 0} active subs</span>
            </div>
            <SparklineWave color="#8B5CF6" />
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Analytics Overview + Storage Usage + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Analytics Overview Area Chart */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 sm:p-6 border border-[#E5EAF2] shadow-xs flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#0646A0]" />
              <h3 className="font-bold text-[#102A5E] text-base">Analytics Overview</h3>
            </div>
            <div className="flex items-center gap-4">
              {/* Legends */}
              <div className="hidden sm:flex items-center gap-3 text-xs font-semibold text-[#64748B]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0646A0]" />
                  Users
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FFC400]" />
                  Documents
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                  Revenue
                </span>
              </div>
              <button
                onClick={() => setDays(days === 30 ? 7 : days === 7 ? 90 : 30)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#E5EAF2] text-xs font-semibold text-[#102A5E] cursor-pointer hover:bg-slate-50 transition"
              >
                <span>Last {days} Days</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              </button>
            </div>
          </div>

          <div className="relative h-64 w-full pt-2">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#64748B]">
                No telemetry recorded for the selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0646A0" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0646A0" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="docsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFC400" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#FFC400" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="displayLabel" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      name === 'revenue' ? formatCurrencyInr(val) : val.toLocaleString('en-IN'),
                      name.charAt(0).toUpperCase() + name.slice(1),
                    ]}
                    contentStyle={{ borderRadius: 12, borderColor: '#E5EAF2', fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#0646A0"
                    strokeWidth={2.4}
                    fillOpacity={1}
                    fill="url(#usersGrad)"
                    dot={{ r: 3.5, fill: '#0646A0', strokeWidth: 2, stroke: '#FFFFFF' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="documents"
                    stroke="#FFC400"
                    strokeWidth={2.4}
                    fillOpacity={1}
                    fill="url(#docsGrad)"
                    dot={{ r: 3.5, fill: '#FFC400', strokeWidth: 2, stroke: '#FFFFFF' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8B5CF6"
                    strokeWidth={2.4}
                    fillOpacity={1}
                    fill="url(#revGrad)"
                    dot={{ r: 3.5, fill: '#8B5CF6', strokeWidth: 2, stroke: '#FFFFFF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Storage Usage Donut Card */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 sm:p-6 border border-[#E5EAF2] shadow-xs flex flex-col justify-between">
          <h3 className="font-bold text-[#102A5E] text-base mb-2">Storage Usage</h3>

          <div className="flex items-center justify-center gap-5 my-auto py-3">
            <div className="w-36 h-36 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={storageDonut}
                    dataKey="value"
                    innerRadius={46}
                    outerRadius={62}
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                  >
                    {storageDonut.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center percentage */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-[#102A5E]">{usedPercentage}%</span>
                <span className="text-[10px] font-bold text-[#64748B] tracking-wider uppercase">Used</span>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0646A0] shrink-0" />
                <div>
                  <p className="text-[11px] text-[#64748B] font-medium leading-none">Used</p>
                  <p className="font-bold text-[#102A5E] text-xs mt-0.5">{formatBytes(storageUsedBytes)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1] shrink-0" />
                <div>
                  <p className="text-[11px] text-[#64748B] font-medium leading-none">Available</p>
                  <p className="font-bold text-[#102A5E] text-xs mt-0.5">{formatBytes(storageAvailBytes)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions 2x2 Grid */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 sm:p-6 border border-[#E5EAF2] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#102A5E] text-base">Quick Actions</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            <button
              onClick={() => navigate('/users')}
              className="p-4 rounded-xl bg-[#F0F4FC] hover:bg-[#E5EEFC] flex flex-col items-center justify-center text-center transition cursor-pointer gap-2 group"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-[#0646A0] transition">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#102A5E]">Manage Users</span>
            </button>

            <button
              onClick={() => navigate('/documents')}
              className="p-4 rounded-xl bg-[#F0F4FC] hover:bg-[#E5EEFC] flex flex-col items-center justify-center text-center transition cursor-pointer gap-2 group"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-[#0646A0] transition">
                <Folder className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#102A5E]">Documents</span>
            </button>

            <button
              onClick={() => navigate('/reports')}
              className="p-4 rounded-xl bg-[#F0F4FC] hover:bg-[#E5EEFC] flex flex-col items-center justify-center text-center transition cursor-pointer gap-2 group"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-[#0646A0] transition">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#102A5E]">Reports</span>
            </button>

            <button
              onClick={() => navigate('/support')}
              className="p-4 rounded-xl bg-[#F0F4FC] hover:bg-[#E5EEFC] flex flex-col items-center justify-center text-center transition cursor-pointer gap-2 group"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-[#0646A0] transition">
                <Headphones className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#102A5E]">Support</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Recent Users + Recent Activities + Security & Reliability Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Users from Live DB */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 sm:p-6 border border-[#E5EAF2] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#102A5E] text-base">Recent Users</h3>
            <Link to="/users" className="text-xs font-bold text-[#0646A0] hover:underline flex items-center gap-0.5">
              <span>View All</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="space-y-3 flex-1">
            {recentRegistrations.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center">No users registered yet.</p>
            ) : (
              recentRegistrations.slice(0, 4).map((u) => {
                const initials = (u.fullName || u.email || 'U')
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <div key={u._id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-[#0646A0] font-bold text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-[#102A5E] truncate">{u.fullName || 'User'}</p>
                        <p className="text-[11px] text-[#64748B] truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B] shrink-0">
                      <span className={`w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span>{formatRelativeTime(u.registrationDate)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activities from Live Audit Logs */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 sm:p-6 border border-[#E5EAF2] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#102A5E] text-base">Recent Activities</h3>
            <Link to="/audit-logs" className="text-xs font-bold text-[#0646A0] hover:underline flex items-center gap-0.5">
              <span>View All</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="space-y-3 flex-1">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center">No activity recorded yet.</p>
            ) : (
              recentActivities.slice(0, 4).map((act) => (
                <div key={act._id} className="flex items-center gap-3 py-1.5">
                  <div className="w-9 h-9 rounded-full bg-blue-50 text-[#0646A0] flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#102A5E] truncate">{act.summary || act.action}</p>
                    <p className="text-[11px] text-[#64748B]">{formatRelativeTime(act.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security & Reliability Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-[#E5EAF2] shadow-xs flex flex-col justify-between relative overflow-hidden min-h-[210px]">
          <div className="z-10 max-w-[210px]">
            <h4 className="font-extrabold text-[#102A5E] text-lg sm:text-xl leading-snug">
              Your Platform is Secure &amp; Reliable
            </h4>
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
              Built for performance, trusted for growth.
            </p>

            <button
              onClick={() => navigate('/audit-logs')}
              className="mt-5 px-5 py-2 rounded-full bg-[#FFC400] hover:bg-[#E5B000] text-[#073B83] font-bold text-xs shadow-xs transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>View Details</span>
              <span>&rarr;</span>
            </button>
          </div>

          {/* Right-hand shield graphic & bottom-right wave accents */}
          <SecurityCardIllustration />
        </div>
      </div>
    </div>
  );
}
