import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';

export function StatusBadge({ status }: { status?: string | null }) {
  const normalized = (status || 'unknown').toLowerCase();
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    captured: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
    verifying: 'bg-amber-50 text-amber-700 border-amber-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    open: 'bg-sky-50 text-sky-700 border-sky-200',
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    closed: 'bg-slate-100 text-slate-700 border-slate-200',
    grace_period: 'bg-amber-50 text-amber-700 border-amber-200',
    suspended: 'bg-rose-50 text-rose-700 border-rose-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    deleted: 'bg-rose-50 text-rose-700 border-rose-200',
    expired: 'bg-rose-50 text-rose-700 border-rose-200',
    cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    refunded: 'bg-purple-50 text-purple-700 border-purple-200',
    partially_refunded: 'bg-purple-50 text-purple-700 border-purple-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    urgent: 'bg-rose-50 text-rose-700 border-rose-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const cls = styles[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

export function StatCard({
  label,
  value,
  subtext,
  icon,
  tone = 'indigo',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const toneClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900">{value}</p>
          {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
        </div>
        {icon && <div className={`p-2.5 rounded-lg ${toneClasses[tone]}`}>{icon}</div>}
      </div>
    </div>
  );
}

export function LoadingState({ label = 'Loading data...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center bg-white border border-dashed border-slate-300 rounded-xl">
      <Inbox className="w-10 h-10 text-slate-400 mb-3" />
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
      <div className="flex items-center gap-2.5 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-rose-300 rounded-lg hover:bg-rose-100 transition cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function SuccessBanner({
  message,
  onDismiss,
  durationMs = 5000,
}: {
  message: string;
  onDismiss?: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!onDismiss || !durationMs) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  return (
    <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
      <div className="flex items-center gap-2.5">
        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}) {
  if (totalPages <= 1 && total <= 20) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white rounded-b-xl text-sm text-slate-600">
      <span>
        Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong> ({total} total)
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className={`w-full ${maxWidth} bg-white rounded-2xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

