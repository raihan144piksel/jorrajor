import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import toast from "react-hot-toast";
import { updateSettings } from "../services/api";
import { ThresholdSettings as ThresholdSettingsType } from "../types";

interface ThresholdSettingsProps {
  selectedNode: string;
  thresholds: ThresholdSettingsType | null;
  onThresholdsChange: (newThresholds: ThresholdSettingsType) => void;
}

/**
 * Komponen ThresholdSettings mengelola form konfigurasi ambang batas (thresholds) otomatisasi alat
 * (kipas pendingin, pompa air, lampu UV) dan masa retensi log data server.
 * 
 * @param props - Properti komponen
 * @param props.selectedNode - ID node sensor terpilih yang sedang dikonfigurasi
 * @param props.thresholds - Objek data ambang batas saat ini
 * @param props.onThresholdsChange - Callback untuk memperbarui ambang batas pada state parent setelah tersimpan
 */
const ThresholdSettings: React.FC<ThresholdSettingsProps> = ({ selectedNode, thresholds, onThresholdsChange }) => {
    const [formThresholds, setFormThresholds] = useState<ThresholdSettingsType>({
        temp_threshold: 30,
        hum_threshold: 40,
        light_threshold: 20,
        retention_days: 30,
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (thresholds) {
            setFormThresholds(thresholds);
        }
    }, [thresholds]);

    /**
     * Mengirimkan perubahan pengaturan ambang batas yang baru ke server backend.
     * 
     * @param e - Event submit form React
     */
    const handleUpdateThresholds = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateSettings({ ...formThresholds, device_id: selectedNode });
            toast.success("Pengaturan berhasil disimpan!");
            onThresholdsChange(formThresholds);
        } catch (err) {
            toast.error("Gagal menyimpan pengaturan");
            console.error("Thresholds error:", err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
            <div className="flex items-center gap-2 mb-6">
                <SettingsIcon className="text-blue-500" size={20} />
                <h2 className="text-xl font-bold text-white">
                    Otomasi & Ambang Batas
                </h2>
            </div>

            <form
                onSubmit={handleUpdateThresholds}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
                <div className="space-y-2">
                    <label className="text-sm text-slate-400">
                        🔥 Nyalakan Kipas Jika Suhu &gt;
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={formThresholds.temp_threshold}
                            onChange={(e) =>
                                setFormThresholds({
                                    ...formThresholds,
                                    temp_threshold: Number(e.target.value),
                                })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                        />
                        <span className="text-slate-400">°C</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-slate-400">
                        💧 Nyalakan Pompa Jika Tanah &lt;
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={formThresholds.hum_threshold}
                            onChange={(e) =>
                                setFormThresholds({
                                    ...formThresholds,
                                    hum_threshold: Number(e.target.value),
                                })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                        />
                        <span className="text-slate-400">%</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-slate-400">
                        💡 Nyalakan Lampu Jika Cahaya &lt;
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={formThresholds.light_threshold}
                            onChange={(e) =>
                                setFormThresholds({
                                    ...formThresholds,
                                    light_threshold: Number(e.target.value),
                                })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                        />
                        <span className="text-slate-400">%</span>
                    </div>
                </div>

                <div className="md:col-span-3 space-y-2">
                    <label className="text-sm text-slate-400">
                        💾 Penyimpanan Data Server (Hari)
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={formThresholds.retention_days}
                            onChange={(e) =>
                                setFormThresholds({
                                    ...formThresholds,
                                    retention_days: Number(e.target.value),
                                })
                            }
                            className="w-1/4 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                            min="1"
                            max="365"
                        />
                        <span className="text-slate-400">Hari</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Data log akan otomatis dihapus permanen jika lebih lama dari batas ini.</p>
                </div>

                <div className="md:col-span-3 flex justify-end mt-4">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
                    </button>
                </div>
            </form>
        </section>
    );
};

export default ThresholdSettings;
