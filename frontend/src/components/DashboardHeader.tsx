import React from "react";
import { Download, LogOut } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { getDownloadUrl } from "../services/api";

interface DashboardHeaderProps {
    isOnline: boolean;
    isEspOnline: boolean;
    onLogout: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ isOnline, isEspOnline, onLogout }) => {
    return (
        <header className="flex justify-between items-center bg-slate-800 p-6 rounded-2xl shadow-xl">
            <div>
                <h1 className="text-2xl font-bold text-white">SEMAI Smart Farm</h1>
                <p className="text-slate-400 text-sm">
                    Greenhouse Zone A - Live Monitoring
                </p>
            </div>
            {/* BAGIAN STATUS */}
            <div className="flex gap-4">
                <StatusBadge
                    label="Server Status"
                    status={isOnline}
                    activeText="CONNECTED"
                    activeColor="green"
                    pulse={true}
                />
                <StatusBadge
                    label="Device Status (ESP32)"
                    status={isEspOnline}
                    activeText="HARDWARE ACTIVE"
                    activeColor="blue"
                    pulse={true}
                />
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={getDownloadUrl}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all active:scale-95"
                >
                    <Download size={18} />
                    <span>Export</span>
                </button>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg border border-red-600/50 transition-all"
                >
                    <LogOut size={18} /> Logout
                </button>
            </div>
        </header>
    );
};

export default DashboardHeader;
