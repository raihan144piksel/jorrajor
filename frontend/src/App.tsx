import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Lazy load komponen halaman untuk optimasi bundle (Code Splitting)
const LoginPage = lazy(() => import("./pages/LoginPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

/**
 * Mengecek apakah JWT Token sudah kedaluwarsa atau tidak valid.
 * Mengurai payload Base64 secara manual tanpa dependensi eksternal.
 * 
 * @param token - String token JWT dari localstorage
 * @returns boolean - True jika token habis masa berlakunya atau error saat parsing, false jika masih aktif
 */
const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;

    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (base64.length % 4)) % 4;
    const paddedBase64 = base64 + "=".repeat(pad);

    const jsonPayload = decodeURIComponent(
      window
        .atob(paddedBase64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );

    const { exp } = JSON.parse(jsonPayload);
    if (!exp) return false;

    return exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
};

/**
 * Wrapper komponen untuk memproteksi rute yang memerlukan autentikasi.
 * Jika pengguna belum masuk (tidak memiliki token valid), otomatis dialihkan ke halaman login.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("app_token");
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem("app_token");
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// KOMPONEN PENGALIH: Mencegah masuk ke Login jika SUDAH login
/**
 * Wrapper komponen rute publik (seperti halaman login).
 * Mencegah pengguna yang sudah memiliki sesi login aktif untuk mengakses halaman tersebut,
 * dan mengalihkan mereka kembali ke dashboard.
 */
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("app_token");
  if (token && isTokenExpired(token)) {
    localStorage.removeItem("app_token");
    return <>{children}</>;
  }
  return token ? <Navigate to="/dashboard" replace /> : <>{children}</>;
};

/**
 * Komponen utama App yang mengatur Router, Suspense (lazy loading), Toaster notifications,
 * dan struktur rute (routing) seluruh aplikasi.
 */
function App() {
  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          }
        >
          <Routes>
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
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

export default App;
