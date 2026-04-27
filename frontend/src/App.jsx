import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

function App() {

  const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('smartfarm_token');
    return token ? children : <Navigate to="/login" />;
  };

  // KOMPONEN PENGALIH: Mencegah masuk ke Login jika SUDAH login
  const PublicRoute = ({ children }) => {
    const token = localStorage.getItem('smartfarm_token');
    return token ? <Navigate to="/dashboard" /> : children;
  };
    
  return (
    <BrowserRouter>
      <Routes>
        {/* Gunakan PublicRoute agar user yang sudah login tidak bisa balik ke form login */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Redirect otomatis akses root ke dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;