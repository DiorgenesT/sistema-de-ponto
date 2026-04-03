import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 text-gray-600">
          <p className="text-sm">Ocorreu um erro inesperado.</p>
          <button
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
            onClick={() => this.setState({ hasError: false })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <ErrorBoundary>
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
      </ErrorBoundary>
    </BrowserRouter>
  );
}
