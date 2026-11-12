import React, { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { PlatformSettingsRecord } from '@docscanner/shared-types';
import { adminApi } from '../../services/adminApi';
import { extractErrorMessage } from '../../lib/apiClient';
import { ErrorBanner, LoadingState, SuccessBanner } from '../../components/UiPrimitives';

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettingsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formatsInput, setFormatsInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.settings.get();
      setSettings(data);
      setFormatsInput(data.allowedFileFormats.join(', '));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await adminApi.settings.update({
        applicationName: settings.applicationName,
        maxUploadSizeBytes: settings.maxUploadSizeBytes,
        allowedFileFormats: formatsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        totalCloudStorageLimitBytes: settings.totalCloudStorageLimitBytes,
        defaultFreeStorageBytes: settings.defaultFreeStorageBytes,
        documentRetentionDays: settings.documentRetentionDays,
        notificationSettings: settings.notificationSettings,
        featureFlags: settings.featureFlags,
      });
      setSettings(updated);
      setSuccess('Platform settings saved and recorded in Audit Logs.');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading platform settings..." />;
  if (error && !settings) return <ErrorBanner message={error} onRetry={load} />;
  if (!settings) return null;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
        <p className="text-sm text-slate-500">Global application configuration, upload policies, storage limits, retention, and feature flags</p>
      </div>

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">General & Upload Configuration</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Application Name</label>
              <input
                required
                value={settings.applicationName}
                onChange={(e) => setSettings({ ...settings, applicationName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Document Retention Window (Days)</label>
              <input
                type="number"
                min={1}
                max={3650}
                required
                value={settings.documentRetentionDays}
                onChange={(e) => setSettings({ ...settings, documentRetentionDays: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Upload Size (MB)</label>
              <input
                type="number"
                min={1}
                required
                value={Math.round(settings.maxUploadSizeBytes / MB)}
                onChange={(e) => setSettings({ ...settings, maxUploadSizeBytes: Number(e.target.value) * MB })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Total Cloud Storage Limit (GB)</label>
              <input
                type="number"
                min={1}
                required
                value={Math.round(settings.totalCloudStorageLimitBytes / GB)}
                onChange={(e) =>
                  setSettings({ ...settings, totalCloudStorageLimitBytes: Number(e.target.value) * GB })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Free Storage Quota (MB)</label>
              <input
                type="number"
                min={1}
                required
                value={Math.round(settings.defaultFreeStorageBytes / MB)}
                onChange={(e) => setSettings({ ...settings, defaultFreeStorageBytes: Number(e.target.value) * MB })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Allowed MIME Formats (comma-separated)</label>
              <input
                required
                value={formatsInput}
                onChange={(e) => setFormatsInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Notification Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.notificationSettings.pushEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notificationSettings: { ...settings.notificationSettings, pushEnabled: e.target.checked },
                  })
                }
              />
              <span>Push Notifications (FCM)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.notificationSettings.inAppEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notificationSettings: { ...settings.notificationSettings, inAppEnabled: e.target.checked },
                  })
                }
              />
              <span>In-App Notifications</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.notificationSettings.emailResetEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notificationSettings: { ...settings.notificationSettings, emailResetEnabled: e.target.checked },
                  })
                }
              />
              <span>Password Reset Emails</span>
            </label>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Feature Flags</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.featureFlags.maintenanceMode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    featureFlags: { ...settings.featureFlags, maintenanceMode: e.target.checked },
                  })
                }
              />
              <span>Maintenance Mode</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.featureFlags.allowNewRegistrations}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    featureFlags: { ...settings.featureFlags, allowNewRegistrations: e.target.checked },
                  })
                }
              />
              <span>Allow New User Registrations</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.featureFlags.subscriptionsEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    featureFlags: { ...settings.featureFlags, subscriptionsEnabled: e.target.checked },
                  })
                }
              />
              <span>Subscriptions & Billing Enabled</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.featureFlags.supportTicketsEnabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    featureFlags: { ...settings.featureFlags, supportTicketsEnabled: e.target.checked },
                  })
                }
              />
              <span>Support Ticket Submissions Enabled</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Platform Settings'}
        </button>
      </form>
    </div>
  );
}

