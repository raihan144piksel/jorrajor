import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";

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
        <BrowserRouter>
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
        </BrowserRouter>
    );
}

export default App;
