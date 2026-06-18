import { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Home, Users, QrCode, Settings, Menu, LogOut } from 'lucide-react';
import { useState } from 'react';
import { checkAuth, logout } from './store/authSlice';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import InscripcionesPage from './pages/InscripcionesPage';
import EditBookingPage from './pages/EditBookingPage';
import QRReaderPage from './pages/QRReaderPage';
import QRConfirmPage from './pages/QRConfirmPage';
import SettingsPage from './pages/SettingsPage';
import EditPackPage from './pages/EditPackPage';

const navItems = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/inscripciones', icon: Users, label: 'Inscripciones' },
  { to: '/qr-reader', icon: QrCode, label: 'Lector QR' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
];

function ProtectedRoute({ children }) {
  const { user, checked } = useSelector((state) => state.auth);
  
  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h1 className="text-lg sm:text-xl font-bold text-primary-600">Desayuno Backoffice</h1>
        </div>
        <nav className="p-3 sm:p-4 space-y-1 flex-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-colors text-sm sm:text-base ${isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 sm:p-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-2 truncate">
            {user?.username}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 lg:hidden flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg shrink-0">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-primary-600 truncate">Desayuno Backoffice</h1>
        </header>
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout><HomePage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/inscripciones" element={
        <ProtectedRoute>
          <Layout><InscripcionesPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/inscripciones/:id" element={
        <ProtectedRoute>
          <Layout><EditBookingPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/qr-reader" element={
        <ProtectedRoute>
          <Layout><QRReaderPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/qr-confirm" element={
        <ProtectedRoute>
          <Layout><QRConfirmPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout><SettingsPage /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings/packs/:id" element={
        <ProtectedRoute>
          <Layout><EditPackPage /></Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;
