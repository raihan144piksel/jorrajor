import mongoose, { Document, Schema } from "mongoose";

// ============================================================
// Interface: IDeviceLog
// Deskripsi: Representasi tipe data TypeScript untuk dokumen log perangkat,
//            menyimpan id perangkat, jenis event (online/offline), dan waktu kejadian.
// ============================================================
export interface IDeviceLog extends Document {
  device_id: string;
  event: "ONLINE" | "OFFLINE";
  timestamp: Date;
}

// ============================================================
// Skema: deviceLogSchema
// Deskripsi: Definisi skema MongoDB (Mongoose Schema) untuk pencatatan
//            status konektivitas perangkat (ONLINE/OFFLINE).
// ============================================================
const deviceLogSchema: Schema = new mongoose.Schema({
  device_id: { type: String, required: true, default: "device0" },
  event: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// ============================================================
// Indeks & Ekspor Model
// Deskripsi: Membuat indeks pada field 'timestamp' secara descending
//            untuk mempercepat pengurutan log status perangkat terbaru.
// ============================================================
deviceLogSchema.index({ timestamp: -1 });

export default mongoose.model<IDeviceLog>("DeviceLog", deviceLogSchema);
