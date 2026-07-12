import React from "react";

interface StatCardProps {
    label: string;
    value?: string | number | null;
    subValue?: string | number | null;
    color: string;
}

/**
 * Komponen StatCard merender kartu ringkasan statistik sederhana dengan label, nilai utama,
 * nilai sub-informasi opsional, dan warna aksen di sisi kiri kartu.
 * 
 * @param props - Properti komponen
 * @param props.label - Label deskripsi statistik (contoh: "Rata-rata Suhu")
 * @param props.value - Nilai utama yang ingin ditampilkan
 * @param props.subValue - Keterangan tambahan di bawah nilai utama (opsional)
 * @param props.color - Kelas warna border CSS kiri
 */
const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, color }) => {

    const displayValue = (value !== undefined && value !== null) ? value : '--';

    return (
        <div className={`bg-slate-800 p-4 rounded-xl border-l-4 ${color} shadow-lg`}>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{label}</p>
            <h3 className="text-2xl font-bold text-white mt-1">{displayValue}</h3>
            {subValue && <p className="text-[10px] text-slate-500 mt-1 italic">{subValue}</p>}
        </div>
    );
};

export default StatCard;