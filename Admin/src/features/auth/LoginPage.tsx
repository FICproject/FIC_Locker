import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { extractErrorMessage } from '../../lib/apiClient';
import { ErrorBanner } from '../../components/UiPrimitives';
import { DocScanLogo } from '../../components/BrandAssets';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#09327A] via-[#0B439E] to-[#1D63DC] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-blue-100">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 mb-3">
            <DocScanLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">DocScan Cloud</h1>
          <p className="text-xs font-medium text-blue-600 tracking-wide mt-0.5">
            Scan • Store • Access — Admin Console
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@docscanner.example"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D63DC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D63DC]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Single Platform Admin • Audited</span>
            <Link to="/forgot-password" className="text-[#1D63DC] font-semibold hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-[#1D63DC] hover:bg-[#154FB8] disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            {submitting ? 'Signing in...' : 'Sign In to DocScan Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
