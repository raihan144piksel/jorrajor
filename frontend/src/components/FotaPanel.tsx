import React, { useState } from "react";
import { Upload, Cpu } from "lucide-react";
import { uploadFirmware } from "../services/api";

const FotaPanel: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        if (!file.name.endsWith(".bin")) {
            alert("File harus berformat .bin");
            return;
        }

        setIsUploading(true);
        try {
            await uploadFirmware(file);
            alert("✅ Firmware berhasil diunggah! ESP32 akan merestart otomatis setelah update selesai.");
            setFile(null);
        } catch (err) {
            alert("❌ Gagal mengunggah firmware. Pastikan backend server menyala.");
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
            <p className="text-xs text-slate-500 mt-4">
                Peringatan: Pastikan firmware yang diunggah dikompilasi untuk board ESP32 yang benar. Kesalahan dapat menyebabkan ESP32 gagal booting.
            </p>
        </section>
    );
};

export default FotaPanel;
