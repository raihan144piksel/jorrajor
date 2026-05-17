import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Lazy load komponen halaman untuk optimasi bundle (Code Splitting)
const LoginPage = lazy(() => import("./pages/LoginPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const token = localStorage.getItem("app_token");
    return token ? children : <Navigate to="/login" replace />;
};

// KOMPONEN PENGALIH: Mencegah masuk ke Login jika SUDAH login
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    const token = localStorage.getItem("app_token");
    return token ? <Navigate to="/dashboard" replace /> : children;
};

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
