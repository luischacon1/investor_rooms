import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RoomEditorPage from './pages/RoomEditorPage';
import PublicRoomPage from './pages/PublicRoomPage';

function PrivateRoute({ children }) {
  const { founder, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Loading…</div>
    </div>
  );
  return founder ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/dashboard/rooms/:id" element={<PrivateRoute><RoomEditorPage /></PrivateRoute>} />
          <Route path="/r/:slug" element={<PublicRoomPage />} />
          <Route path="/room/:slug" element={<PublicRoomPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
