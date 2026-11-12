import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../app/AuthContext';
import { AdminLayout } from '../layouts/AdminLayout';
import { LoadingState } from '../components/UiPrimitives';
import { LoginPage } from '../features/auth/LoginPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { UsersPage } from '../features/users/UsersPage';
import { DocumentsPage } from '../features/documents/DocumentsPage';
import { SubscriptionsPage } from '../features/subscriptions/SubscriptionsPage';
import { PaymentsPage } from '../features/payments/PaymentsPage';
import { StoragePage } from '../features/storage/StoragePage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { SupportPage } from '../features/support/SupportPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { AuditLogsPage } from '../features/audit-logs/AuditLogsPage';
import { SettingsPage } from '../features/settings/SettingsPage';

function ProtectedAdminRoute() {
  const { admin, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingState label="Verifying Admin session..." />
      </div>
    );
  }
  if (!admin) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function PublicOnlyRoute() {
  const { admin, isLoading } = useAuth();
  if (isLoading) return null;
  if (admin) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<ProtectedAdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/storage" element={<StoragePage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

