import mongoose, { Document, Schema } from "mongoose";

// ============================================================
// Interface: ISettings
// Deskripsi: Representasi tipe data TypeScript untuk dokumen konfigurasi perangkat,
//            menyimpan batas ambang sensor (threshold) untuk suhu, kelembapan,
//            cahaya, durasi retensi penyimpanan telemetri, dan waktu perubahan terakhir.
// ============================================================
export interface ISettings extends Document {
  device_id: string;
  temp_threshold: number;
  hum_threshold: number;
  light_threshold: number;
  retention_days: number;
  updated_at: Date;
}

// ============================================================
// Skema: settingsSchema
// Deskripsi: Definisi skema MongoDB (Mongoose Schema) untuk konfigurasi 
//            ambang batas sensor greenhouse dan retensi pembersihan data telemetri.
// ============================================================
const settingsSchema: Schema = new mongoose.Schema({
  device_id: { type: String, required: true, default: "device0", unique: true, index: true },
  temp_threshold: { type: Number, default: 30 },
  hum_threshold: { type: Number, default: 40 },
  light_threshold: { type: Number, default: 20 },
  retention_days: { type: Number, default: 30 },
  updated_at: { type: Date, default: Date.now },
});

// ============================================================
// Ekspor Model
// Deskripsi: Mengekspor Mongoose model 'Settings' berdasarkan skema settingsSchema.
// ============================================================

export default mongoose.model<ISettings>("Settings", settingsSchema);
