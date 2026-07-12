import React from "react";
import { LucideIcon } from "lucide-react";

interface SensorCardProps {
    title: string;
    value: string | number;
    unit: string;
    icon: LucideIcon;
    color: string;
    iconColor: string;
}

/**
 * Komponen SensorCard menampilkan informasi data sensor tunggal (seperti suhu atau kelembapan)
 * dengan visualisasi ikon dan warna aksen tertentu.
 * 
 * @param props - Properti komponen
 * @param props.title - Nama sensor (contoh: "Suhu Udara")
 * @param props.value - Nilai data sensor saat ini
 * @param props.unit - Satuan ukur sensor (contoh: "°C", "%")
 * @param props.icon - Komponen ikon Lucide untuk dirender
 * @param props.color - Kelas warna border CSS
 * @param props.iconColor - Kelas warna CSS untuk ikon
 */
const SensorCard: React.FC<SensorCardProps> = ({
    title,
    value,
    unit,
    icon: Icon,
    color,
    iconColor,
}) => {

    return (
        <div
            className={`p-6 rounded-2xl bg-slate-800 border-l-4 ${color} shadow-lg transition-all hover:scale-105`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                        {title}
                    </p>
                    <h3 className="text-3xl font-bold mt-1 text-white">
                        {value}{" "}
                        <span className="text-lg font-normal text-slate-500">
                            {unit}
                        </span>
                    </h3>
                </div>
                <div className={`p-3 rounded-lg bg-slate-700 ${iconColor}`}>
                    <Icon size={24} />
                </div>
            </div>

        </div>
    );
};

export default SensorCard;
