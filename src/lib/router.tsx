import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/components/auth/LoginPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { RestaurantsPage } from '@/components/restaurants/RestaurantsPage';
import { RestaurantDetailPage } from '@/components/restaurants/RestaurantDetailPage';
import { ComparePage } from '@/components/compare/ComparePage';
import { AnalysisPage } from '@/components/analysis/AnalysisPage';
import { ReportsPage } from '@/components/reports/ReportsPage';
import { UploadPage } from '@/components/upload/UploadPage';
import { AdminRestaurantsPage } from '@/components/admin/AdminRestaurantsPage';
import { ArchivedRestaurantsPage } from '@/components/admin/ArchivedRestaurantsPage';
import { AuditLogPage } from '@/components/admin/AuditLogPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'restaurants',
        element: <RestaurantsPage />,
      },
      {
        path: 'restaurants/:id',
        element: <RestaurantDetailPage />,
      },
      {
        path: 'compare',
        element: <ComparePage />,
      },
      {
        path: 'analysis',
        element: <AnalysisPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'upload',
        element: (
          <ProtectedRoute requiredRole="admin">
            <UploadPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/restaurants',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AdminRestaurantsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/restaurants/archived',
        element: (
          <ProtectedRoute requiredRole="admin">
            <ArchivedRestaurantsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/audit-log',
        element: (
          <ProtectedRoute requiredRole="admin">
            <AuditLogPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
], {
  basename: import.meta.env.BASE_URL
});
