import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  IndianRupee,
  HardDrive,
  FolderTree,
  Bell,
  LifeBuoy,
  BarChart3,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Laptop,
  Heart,
} from 'lucide-react';
import type { AdminSessionInfo } from '@docscanner/shared-types';
import { useAuth } from '../app/AuthContext';
import { adminApi } from '../services/adminApi';
import { extractErrorMessage } from '../lib/apiClient';
import { formatDateTime } from '../lib/format';
import { Modal, ErrorBanner } from '../components/UiPrimitives';
import { FicLogoBadge } from '../components/BrandAssets';
import { useAdminLiveSync } from '../hooks/useAdminLiveSync';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/payments', label: 'Payments', icon: IndianRupee },
  { to: '/storage', label: 'Storage', icon: HardDrive },
  { to: '/categories', label: 'Categories', icon: FolderTree },
  { to: '/notifications', label: 'Notifications', icon: Bell, showBadge: true },
  { to: '/support', label: 'Support', icon: LifeBuoy },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<AdminSessionInfo[]>([]);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const loadAlerts = useCallback(() => {
    adminApi.dashboard
      .getOverview(7)
      .then((d) => {
        const count =
          (d.alerts?.openTicketsCount || 0) +
          (d.alerts?.failedUploads || 0) +
          (d.alerts?.pendingDeletionsCount || 0) +
          (d.alerts?.pendingRecoveriesCount || 0);
        setAlertCount(count);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useAdminLiveSync(loadAlerts);

  const openSessionsModal = async () => {
    setSessionsOpen(true);
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const list = await adminApi.auth.sessions();
      setSessions(list);
    } catch (err) {
      setSessionsError(extractErrorMessage(err));
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevoke = async (sessionId: string, isCurrent?: boolean) => {
    try {
      await adminApi.auth.revokeSession(sessionId);
      if (isCurrent) {
        await logout();
        navigate('/login');
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setSessionsError(extractErrorMessage(err));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (admin?.name || admin?.email || 'A').charAt(0).toUpperCase();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#002766] via-[#003894] to-[#001D4D] text-white w-64 shadow-2xl">
      <div className="flex items-center justify-between px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex flex-col items-center w-full text-center">
          <FicLogoBadge size="lg" className="mb-2.5 ring-2 ring-[#F7BA1E]" />
          <h2 className="text-xl font-black tracking-tight text-white">
            FIC <span className="text-[#F7BA1E]">Locker</span>
          </h2>
          <span className="mt-1 text-[11px] font-medium text-blue-200 tracking-wide">
            Admin Console
          </span>
        </div>
        <button
          className="lg:hidden text-blue-200 hover:text-white absolute right-4 top-5 cursor-pointer"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-white text-[#0047BA] shadow-md font-bold border-l-4 border-[#F7BA1E]'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {item.showBadge && alertCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-[#F7BA1E] text-[#002766]">
                  {alertCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 mt-2 border-t border-white/10 space-y-2">
        <button
          onClick={openSessionsModal}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-left transition cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-blue-400/30 border border-white/30 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{admin?.name || 'Platform Admin'}</p>
            <p className="text-[11px] text-blue-200 truncate">Single Admin • Sessions</p>
          </div>
          <ChevronDown className="w-4 h-4 text-blue-200 shrink-0" />
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-blue-100 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F3F7FD]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 lg:sticky lg:top-0 lg:h-screen">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="relative z-50 h-full">{sidebarContent}</div>
          <div className="flex-1 bg-slate-900/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-[#F3F7FD]/90 backdrop-blur-sm border-b border-slate-200/70 px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-extrabold text-[#0047BA] text-base tracking-tight">
                FIC <span className="text-[#F7BA1E]">Locker</span>
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold text-slate-600">Admin Console</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/notifications')}
              title="Notifications & Operational Alerts"
              className="relative p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1D63DC] text-white text-[10px] font-bold flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>

            <button
              onClick={openSessionsModal}
              className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <span className="w-7 h-7 rounded-full bg-[#DCEAFE] text-[#0B3B91] font-bold text-xs flex items-center justify-center">
                {initials}
              </span>
              <span className="hidden sm:inline text-xs font-semibold text-slate-800">
                {admin?.name || 'Admin'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-7 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>

        <footer className="px-4 lg:px-8 py-4 border-t border-slate-200/80 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="font-bold text-[#0047BA]">FIC Locker</span>
            <span className="text-slate-300">•</span>
            <span>Admin Console v1.0</span>
          </span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            Secure Cloud Locker <Heart className="w-3.5 h-3.5 text-[#F7BA1E] fill-[#F7BA1E]" />
          </span>
        </footer>
      </div>

      <Modal open={sessionsOpen} title="Active Admin Sessions" onClose={() => setSessionsOpen(false)}>
        {sessionsError && <ErrorBanner message={sessionsError} />}
        {loadingSessions ? (
          <p className="text-sm text-slate-500 py-4">Loading active sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No active sessions found.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-900">{s.sourceApp}</span>
                    {s.isCurrent && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{s.userAgent || 'Unknown device'}</p>
                  <p className="text-xs text-slate-400">
                    IP: {s.ipAddress || 'N/A'} • Last active {formatDateTime(s.lastUsedAt)}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(s.id, s.isCurrent)}
                  className="px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
