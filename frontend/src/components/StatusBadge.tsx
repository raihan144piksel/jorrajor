import React from "react";

interface StatusBadgeProps {
    label: string;
    status: boolean;
    activeText: string;
    activeColor: "green" | "blue" | "red" | "slate";
    pulse?: boolean;
}

/**
 * Komponen StatusBadge menampilkan badge penanda status (seperti ONLINE/OFFLINE)
 * dengan indikator titik berkedip (pulse) opsional dan warna dinamis berdasarkan status.
 * 
 * @param props - Properti komponen
 * @param props.label - Label di atas badge (contoh: "Server Status")
 * @param props.status - Status aktif/mati (true = Aktif/Online, false = OFFLINE)
 * @param props.activeText - Teks status saat aktif (contoh: "CONNECTED")
 * @param props.activeColor - Tema warna badge saat aktif
 * @param props.pulse - Apakah titik indikator berdenyut/berkedip saat aktif
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({ label, status, activeText, activeColor, pulse = false }) => {
    const themes = {
        green: 'bg-green-500/10 text-green-400',
        blue: 'bg-blue-500/10 text-blue-400',
        red: 'bg-red-500/10 text-red-400',
        slate: 'bg-slate-700 text-slate-500'
    };

    const dotThemes = {
        green: 'bg-green-500',
        blue: 'bg-blue-500',
        red: 'bg-red-500',
        slate: 'bg-slate-500'
    };

    return (
        <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">{label}</span>
            <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${status ? themes[activeColor] : themes.red}`}>
                <div className={`w-2 h-2 rounded-full ${status ? dotThemes[activeColor] : dotThemes.red} ${status && pulse ? 'animate-pulse' : ''}`}></div>
                {status ? activeText : 'OFFLINE'}
            </span>
        </div>
    );
};

export default StatusBadge;