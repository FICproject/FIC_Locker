import React, { useEffect, useState } from 'react';
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
import { DocScanLogo } from '../components/BrandAssets';

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

  useEffect(() => {
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
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0A3A8E] via-[#0B3582] to-[#08255E] text-white w-64 shadow-xl">
      <div className="flex items-center justify-between px-5 pt-6 pb-5">
        <div className="flex flex-col items-center w-full text-center">
          <DocScanLogo light size="lg" />
          <span className="mt-1.5 text-lg font-bold tracking-tight text-white">FIC Locker</span>
          <span className="text-[11px] text-blue-200 tracking-wide">Scan • Store • Access</span>
        </div>
        <button className="lg:hidden text-blue-200 hover:text-white absolute right-4 top-5" onClick={() => setSidebarOpen(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
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
                    ? 'bg-white text-[#0B3B91] shadow-sm font-semibold'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </span>
              {item.showBadge && alertCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-500 text-white">
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
              className="lg:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
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
          <span>FIC Locker &nbsp;|&nbsp; Admin Panel v1.0</span>
          <span className="inline-flex items-center gap-1">
            Powered by MERN Stack <Heart className="w-3.5 h-3.5 text-[#0B3B91] fill-[#0B3B91]" />
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
