import React, { useState, useEffect } from "react";
import { Upload, Cpu } from "lucide-react";
import toast from "react-hot-toast";
import { uploadFirmware } from "../services/api";

interface FotaPanelProps {
    otaStatus?: string | null;
}

const FotaPanel: React.FC<FotaPanelProps> = ({ otaStatus }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (otaStatus === "BERHASIL") {
            toast.success("ESP32 berhasil dipasang firmware baru! Alat sedang merestart...", { duration: 6000 });
        } else if (otaStatus === "GAGAL") {
            toast.error("Alat gagal melakukan update firmware!");
        }
    }, [otaStatus]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        if (!file.name.endsWith(".bin")) {
            toast.error("File harus berformat .bin");
            return;
        }

        setIsUploading(true);
        try {
            await uploadFirmware(file);
            toast.success("Firmware berhasil diunggah! ESP32 akan merestart otomatis setelah update selesai.", { duration: 5000 });
            setFile(null);
        } catch (err) {
            toast.error("Gagal mengunggah firmware. Pastikan backend server menyala.");
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <section className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 mt-8">
            <div className="flex items-center gap-2 mb-6">
                <Cpu className="text-purple-500" size={20} />
                <h2 className="text-xl font-bold text-white">
                    Pembaruan Firmware (OTA)
                </h2>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900 p-6 rounded-xl border border-slate-700">
                <div className="flex-1 w-full relative">
                    <input 
                        type="file" 
                        accept=".bin" 
                        onChange={handleFileChange} 
                        className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 cursor-pointer"
                    />
                </div>
                <button
                    onClick={handleUpload}
                    disabled={!file || isUploading}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50 w-full md:w-auto justify-center font-bold"
                >
                    <Upload size={18} />
                    {isUploading ? "Mengunggah..." : "Flash ESP32"}
                </button>
            </div>
            {otaStatus && otaStatus !== "MENUNGGU" && (
                <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between">
                    <span className="text-sm text-slate-300">Status Update (FOTA):</span>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                        otaStatus === "BERHASIL" ? "bg-green-500/20 text-green-400" :
                        otaStatus === "GAGAL" ? "bg-red-500/20 text-red-400" :
                        "bg-purple-500/20 text-purple-400 animate-pulse"
                    }`}>
                        {otaStatus === "MENDOWNLOAD" ? "Mendownload..." :
                         otaStatus === "MENGINSTALL" ? "Menginstall..." :
                         otaStatus === "BERHASIL" ? "Berhasil! Merestart..." :
                         otaStatus === "GAGAL" ? "Gagal!" :
                         otaStatus === "TIDAK_ADA_UPDATE" ? "Tidak Ada Update" : otaStatus}
                    </span>
                </div>
            )}
            <p className="text-xs text-slate-500 mt-4">
                Peringatan: Pastikan firmware yang diunggah dikompilasi untuk board ESP32 yang benar. Kesalahan dapat menyebabkan ESP32 gagal booting.
            </p>
        </section>
    );
};

export default FotaPanel;
