import mongoose, { Document, Schema } from "mongoose";

// ============================================================
// Interface: ITelemetry
// Deskripsi: Representasi tipe data TypeScript untuk dokumen data telemetri,
//            menyimpan nilai sensor (suhu, kelembapan udara, kelembapan tanah, intensitas cahaya),
//            status aktuator (kipas, pompa, lampu), state kontrol (manual/otomatis),
//            dan waktu penerimaan data.
// ============================================================
export interface ITelemetry extends Document {
  device_id: string;
  suhu: number;
  kelembapan_udara: number;
  tanah: number;
  cahaya: number;
  status_kipas: boolean;
  status_pompa: boolean;
  status_lampu: boolean;
  state_kipas: string;
  state_pompa: string;
  state_lampu: string;
  timestamp: Date;
}

// ============================================================
// Skema: telemetrySchema
// Deskripsi: Definisi skema MongoDB (Mongoose Schema) untuk pencatatan
//            data real-time sensor dan status aktuator greenhouse.
// ============================================================
const telemetrySchema: Schema = new mongoose.Schema({
  device_id: { type: String, default: "UNKNOWN" },
  suhu: Number,
  kelembapan_udara: Number,
  tanah: Number,
  cahaya: Number,
  status_kipas: Boolean,
  status_pompa: Boolean,
  status_lampu: Boolean,
  state_kipas: String,
  state_pompa: String,
  state_lampu: String,
  timestamp: { type: Date, default: Date.now },
});

// ============================================================
// Indeks & Ekspor Model
// Deskripsi: Membuat indeks pencarian cepat untuk timestamp, kelembapan tanah,
//            dan compound index untuk penyaringan multi-node.
//            Mengekspor Mongoose model 'Telemetry' berdasarkan skema telemetrySchema.
// ============================================================
telemetrySchema.index({ timestamp: -1 });
telemetrySchema.index({ tanah: 1 });
telemetrySchema.index({ device_id: 1, timestamp: -1 });

export default mongoose.model<ITelemetry>("Telemetry", telemetrySchema);
