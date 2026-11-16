import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { ErrorBanner, SuccessBanner } from '../../components/UiPrimitives';
import { FicLogoBadge, FicWordmark } from '../../components/BrandAssets';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await adminApi.auth.forgotPassword(email.trim());
      setSuccess(res.message || 'Verification code dispatched.');
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
          <h2 className="text-sm font-bold text-slate-700 mt-1">Forgot Admin Password</h2>
          <p className="text-xs text-slate-500 mt-1">
            Enter your configured Platform Admin email to receive a verification OTP.
          </p>
        </div>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && (
          <div className="mb-4 space-y-3">
            <SuccessBanner message={success} />
            <button
              onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`)}
              className="w-full py-2.5 text-xs font-bold text-[#0047BA] bg-blue-50 hover:bg-blue-100 rounded-xl cursor-pointer transition border border-blue-200"
            >
              Proceed to Reset Password →
            </button>
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
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0047BA] focus:border-[#0047BA] transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#0047BA] to-[#003894] hover:from-[#003B99] hover:to-[#002B70] disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-900/20 transition cursor-pointer"
          >
            {submitting ? 'Sending Code...' : 'Send Verification Code'}
          </button>
        </form>
      </div>
    </div>
  );
}
