import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { ErrorBanner, SuccessBanner } from '../../components/UiPrimitives';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#09327A] via-[#0B439E] to-[#1D63DC] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to sign in
        </Link>
        <h1 className="text-xl font-bold text-slate-900">Forgot Admin Password</h1>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Enter the configured Platform Admin email to receive a 6-digit verification code.
        </p>

        {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
        {success && (
          <div className="mb-4 space-y-3">
            <SuccessBanner message={success} />
            <button
              onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`)}
              className="w-full py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer"
            >
              Proceed to Reset Password
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            {submitting ? 'Sending Code...' : 'Send Verification Code'}
          </button>
        </form>
      </div>
    </div>
  );
}

