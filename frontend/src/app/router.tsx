import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";

// Lazy loading por feature — cada bundle carregado sob demanda
const AttendancePage = lazy(() => import("@/features/attendance"));
const EmployeePortalPage = lazy(() => import("@/features/employee-portal"));
const AdminPage = lazy(() => import("@/features/admin"));
const AuthPage = lazy(() => import("@/features/auth"));
const DeviceCheckPage = lazy(() => import("@/features/device-check"));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Verificação de dispositivo — primeira tela */}
          <Route path="/device-check" element={<DeviceCheckPage />} />

          {/* Auth */}
          <Route path="/login" element={<AuthPage />} />

          {/* Registro de ponto — tela principal do terminal */}
          <Route path="/attendance" element={<AttendancePage />} />

          {/* Portal do funcionário */}
          <Route path="/portal/*" element={<EmployeePortalPage />} />

          {/* Painel administrativo */}
          <Route path="/admin/*" element={<AdminPage />} />

          {/* Redirect padrão */}
          <Route path="/" element={<Navigate to="/attendance" replace />} />
          <Route path="*" element={<Navigate to="/attendance" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
