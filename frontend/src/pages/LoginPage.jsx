import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('smartfarm_token');
        if (token) {
            navigate('/dashboard');
        }
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Gunakan env variable agar fleksibel saat deploy nanti
            const apiUrl = import.meta.env.VITE_API_BASE_URL;
            const response = await axios.post(`${apiUrl}/login`, { password });

            localStorage.setItem('smartfarm_token', response.data.token);

            // Langsung pindah ke dashboard setelah sukses
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Password salah!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 font-sans text-slate-50">
            <div className="w-full max-w-md bg-slate-900 p-10 rounded-3xl shadow-2xl border border-slate-800 text-center">
                {/* Icon & Title */}
                <div className="text-5xl mb-4">🌱</div>
                <h2 className="text-3xl font-bold tracking-tight mb-2">Smart Farm Login</h2>
                <p className="text-slate-400 text-sm mb-8">Masukkan password untuk akses kontrol sistem</p>

                <form onSubmit={handleLogin} className="flex flex-col">
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3.5 mb-5 rounded-xl bg-slate-950 border border-slate-700 text-slate-50 text-center text-lg outline-none focus:border-blue-500 transition-colors"
                        required
                    />

                    {/* Error Message */}
                    {error && (
                        <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Login Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3.5 rounded-xl font-semibold text-lg transition-all duration-200 
              ${loading
                                ? 'bg-blue-900/50 text-blue-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-600/20'
                            }`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Memverifikasi...
                            </span>
                        ) : (
                            'Login'
                        )}
                    </button>
                </form>
            </div>

            <p className="mt-8 text-slate-600 text-xs tracking-widest uppercase">
                SEMAI Ecosystem © 2026
            </p>
        </div>
    );
};

export default LoginPage;