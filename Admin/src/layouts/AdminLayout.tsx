import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  CreditCard,
  Banknote,
  Cloud,
  List,
  Bell,
  HelpCircle,
  BarChart2,
  ShieldCheck,
  Settings,
  Menu,
  X,
  ChevronDown,
  Laptop,
  Search,
  Headphones,
} from 'lucide-react';
import type { AdminSessionInfo } from '@docscanner/shared-types';
import { useAuth } from '../app/AuthContext';
import { adminApi } from '../services/adminApi';
import { extractErrorMessage } from '../lib/apiClient';
import { formatDateTime } from '../lib/format';
import { Modal, ErrorBanner } from '../components/UiPrimitives';
import { FicEmblem, SidebarLogoBadge } from '../components/BrandAssets';
import { useAdminLiveSync } from '../hooks/useAdminLiveSync';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/payments', label: 'Payments', icon: Banknote },
  { to: '/categories', label: 'Categories', icon: List },
  { to: '/notifications', label: 'Notifications', icon: Bell, showBadge: true },
  { to: '/support', label: 'Support', icon: HelpCircle },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
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

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#073B83] text-white w-64 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex flex-col items-center w-full text-center">
          <div className="mb-2 flex items-center justify-center">
            <SidebarLogoBadge />
          </div>
          <h2 className="text-base font-extrabold tracking-wider text-white uppercase leading-none">
            FIC <span className="text-[#FFC400]">LOCKER</span>
          </h2>
          <span className="text-[10px] font-semibold tracking-[0.25em] text-blue-200 uppercase mt-1.5">
            ADMIN CONSOLE
          </span>
        </div>
        <button
          className="lg:hidden text-blue-200 hover:text-white absolute right-4 top-5 cursor-pointer"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List: compact padding, zero scrollbar */}
      <nav className="flex-1 overflow-y-auto px-4 py-1 space-y-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition duration-150 ${
                  isActive
                    ? 'bg-[#FFC400] text-[#073B83] font-bold shadow-xs'
                    : 'text-white/95 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center gap-3.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#073B83]' : 'text-white'}`} />
                    <span>{item.label}</span>
                  </span>
                  {item.showBadge && (
                    <span className="w-4 h-4 text-[10px] font-bold rounded-full bg-[#EF4444] text-white flex items-center justify-center shadow-xs">
                      {alertCount > 0 ? alertCount : 3}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Support Box & Footer - removed extra session button that caused vertical overflow */}
      <div className="p-4 mt-auto space-y-2">
        <div
          onClick={() => navigate('/support')}
          className="p-3 bg-white/10 hover:bg-white/15 rounded-xl border border-white/10 flex items-center justify-between text-xs text-white transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FFC400]/20 flex items-center justify-center text-[#FFC400]">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white leading-tight">Need Help?</p>
              <p className="text-[10px] text-blue-200">Contact Support &rarr;</p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-blue-200/60 text-center pt-1">
          &copy; {new Date().getFullYear()} FIC Locker
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F7F9FC]">
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
        <header className="sticky top-0 z-20 bg-white border-b border-[#E5EAF2] px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-50 border border-[#E5EAF2] text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Pill Search Bar matching mockup */}
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users, documents..."
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-[#F7F9FC] border border-[#E5EAF2] text-xs text-[#102A5E] placeholder:text-[#64748B] focus:outline-none focus:border-[#0646A0] focus:ring-1 focus:ring-[#0646A0] transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/notifications')}
              title="Notifications & Operational Alerts"
              className="relative p-2.5 rounded-full bg-white border border-[#E5EAF2] hover:bg-slate-50 text-[#102A5E] cursor-pointer shadow-2xs"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
                {alertCount > 0 ? (alertCount > 9 ? '9+' : alertCount) : '3'}
              </span>
            </button>

            <div className="h-6 w-px bg-[#E5EAF2] hidden sm:block" />

            <button
              onClick={openSessionsModal}
              className="flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full bg-white border border-[#E5EAF2] hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              <span className="w-8 h-8 rounded-full bg-[#073B83] text-white font-bold text-xs flex items-center justify-center">
                AK
              </span>
              <span className="hidden sm:inline text-xs font-bold text-[#102A5E]">
                Admin
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-7 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
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
              <div key={s.id} className="p-3 rounded-xl border border-[#E5EAF2] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-medium text-[#102A5E]">{s.sourceApp}</span>
                    {s.isCurrent && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] truncate">{s.userAgent || 'Unknown device'}</p>
                  <p className="text-xs text-slate-400">
                    Active since {formatDateTime(s.createdAt)} &bull; Last seen {formatDateTime(s.lastUsedAt)}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button
                    onClick={() => handleRevoke(s.id)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition cursor-pointer"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 pt-4 border-t border-[#E5EAF2] flex justify-between items-center">
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            Sign Out of Platform
          </button>
          <button
            onClick={() => setSessionsOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
}
