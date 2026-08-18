import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { AppDataProvider, useAppData } from './lib/appData.jsx';
import { ScenarioProvider } from './lib/scenario.jsx';
import { ToastProvider, Loading, ErrorNote } from './components/ui.jsx';
import AppShell, { Logo } from './components/AppShell.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MapView from './pages/MapView.jsx';
import SimulationStudio from './pages/SimulationStudio.jsx';
import Results from './pages/Results.jsx';
import Reports from './pages/Reports.jsx';
import ReportDetail from './pages/ReportDetail.jsx';

function BootScreen({ children }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex flex-col items-center gap-5">
        <Logo />
        {children}
      </div>
    </div>
  );
}

function Protected() {
  const { user, booting } = useAuth();
  const { loading, error } = useAppData();

  if (booting) return <BootScreen><Loading label="Restoring session" /></BootScreen>;
  if (!user) return <Navigate to="/login" replace />;
  if (error) {
    return (
      <BootScreen>
        <ErrorNote className="max-w-sm">{error}</ErrorNote>
      </BootScreen>
    );
  }
  if (loading) return <BootScreen><Loading label="Loading Nagpur network" /></BootScreen>;

  return <AppShell />;
}

function Router() {
  const { user, booting } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={booting ? <BootScreen><Loading label="Restoring session" /></BootScreen> : user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/simulate" element={<SimulationStudio />} />
        <Route path="/results" element={<Results />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/:id" element={<ReportDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppDataProvider>
          <ScenarioProvider>
            <Router />
          </ScenarioProvider>
        </AppDataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
