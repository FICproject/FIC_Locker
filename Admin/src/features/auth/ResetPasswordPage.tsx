import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, KeyRound } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { ErrorBanner, SuccessBanner } from '../../components/UiPrimitives';
import { FicLogoBadge, FicWordmark } from '../../components/BrandAssets';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await adminApi.auth.resetPassword({ email: email.trim(), otp: otp.trim(), newPassword });
      setSuccess(res.message || 'Password updated.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-[#FFE885] via-[#FFC72C] to-[#F5AE00] p-4 overflow-hidden">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-amber-200/60 relative z-10">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0047BA] hover:text-[#002B70] mb-5 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>

        <div className="flex flex-col items-center text-center mb-6">
          <FicLogoBadge size="lg" className="mb-3 ring-4 ring-amber-100" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            <span className="text-[#0047BA]">FIC</span> <span className="text-[#F7BA1E]">Locker</span>
          </h1>
          <h2 className="text-sm font-bold text-slate-700 mt-1">Reset Admin Password</h2>
          <p className="text-xs text-slate-500 mt-1">
            Enter the verification code sent to your email and set a new password.
          </p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && <div className="mb-4"><SuccessBanner message={success} /></div>}

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
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0047BA] focus:border-[#0047BA] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Verification Code (OTP)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0047BA] focus:border-[#0047BA] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              New Password (min 8 chars)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0047BA] focus:border-[#0047BA] transition"
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#0047BA] to-[#003894] hover:from-[#003B99] hover:to-[#002B70] disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-900/20 transition cursor-pointer"
          >
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
