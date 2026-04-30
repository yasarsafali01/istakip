import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/common/Sidebar';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ROLES } from './constants';

// Lazy-load pages
const LoginPage         = lazy(() => import('./pages/LoginPage'));
const DashboardPage     = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage      = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const BoardPage         = lazy(() => import('./pages/BoardPage'));
const BacklogPage       = lazy(() => import('./pages/BacklogPage'));
const UnitsPage         = lazy(() => import('./pages/UnitsPage'));
const RequestsPage      = lazy(() => import('./pages/RequestsPage'));
const NotFoundPage      = lazy(() => import('./pages/NotFoundPage'));

const LoadingSpinner = () => (
  <div className="d-flex justify-content-center align-items-center py-5">
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Yükleniyor…</span>
    </div>
  </div>
);

/**
 * Root layout: persistent sidebar on the left, scrollable main content on the right.
 */
function Layout() {
  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <Sidebar />
      <main className="flex-grow-1 p-4 overflow-auto" style={{ background: '#F4F5F7' }}>
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected layout routes */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Units — System_Admin and Department_Head only */}
              <Route
                path="/units"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD]}>
                    <UnitsPage />
                  </ProtectedRoute>
                }
              />

              {/* Projects */}
              <Route
                path="/projects"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER]}>
                    <ProjectsPage />
                  </ProtectedRoute>
                }
              />
              {/* Project detail — Board + Aktif İşler tabs (Worker dahil) */}
              <Route
                path="/projects/:projectId"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER, ROLES.WORKER]}>
                    <ProjectDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/board"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER, ROLES.WORKER]}>
                    <BoardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/projects/:projectId/backlog"
                element={
                  <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER, ROLES.WORKER]}>
                    <BacklogPage />
                  </ProtectedRoute>
                }
              />

              {/* Requests — all authenticated users */}
              <Route path="/requests" element={<RequestsPage />} />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
