import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { extractErrorMessage } from '../../lib/apiClient';
import { ErrorBanner } from '../../components/UiPrimitives';
import { FicLogoBadge, FicWordmark } from '../../components/BrandAssets';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err, 'Invalid credentials.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-[#FFE885] via-[#FFC72C] to-[#F5AE00] p-4 overflow-hidden">
      {/* Decorative Brand Accent Background Elements */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-[#0047BA]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating "Let's Connect!" banner echoing the logo emblem */}
      <div className="absolute top-6 left-6 hidden md:flex items-center gap-2 text-[#0047BA] font-extrabold text-lg tracking-tight select-none rotate-[-6deg]">
        <span className="text-2xl">✨</span>
        <span className="drop-shadow-xs">Let&apos;s Connect!</span>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-amber-200/60 relative z-10 backdrop-blur-xs">
        {/* Brand Logo & Wordmark */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="relative mb-3">
            <FicLogoBadge size="xl" className="ring-4 ring-amber-100/80 shadow-md" />
            <div className="absolute -bottom-1 -right-1 bg-[#0047BA] text-white p-1 rounded-full shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            <span className="text-[#0047BA]">FIC</span> <span className="text-[#F7BA1E]">Locker</span>
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider text-[#0047BA] mt-1">
            Admin Console
          </p>
          <p className="text-[11px] font-medium text-slate-500 tracking-wide mt-1">
            Scan • Store • Access — High-Security Cloud
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@locker.com"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0047BA] focus:border-[#0047BA] transition bg-slate-50/50 hover:bg-white focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0047BA] focus:border-[#0047BA] transition bg-slate-50/50 hover:bg-white focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-[#0047BA] focus:outline-none transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-slate-500 font-medium">Single Platform Admin</span>
            <Link
              to="/forgot-password"
              className="text-[#0047BA] font-bold hover:underline hover:text-[#003387] transition"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#0047BA] via-[#0852CC] to-[#003894] hover:from-[#003B99] hover:to-[#002B70] disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-900/25 transition cursor-pointer transform active:scale-[0.99]"
          >
            {submitting ? 'Signing in...' : 'Sign In to FIC Locker Admin'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">FIC Locker</span>
          <span>•</span>
          <span>Platform Admin Console</span>
        </div>
      </div>
    </div>
  );
}
