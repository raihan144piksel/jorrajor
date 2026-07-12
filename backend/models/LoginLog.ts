import mongoose, { Document, Schema } from "mongoose";

// ============================================================
// Interface: ILoginLog
// Deskripsi: Representasi tipe data TypeScript untuk dokumen log masuk (login),
//            menyimpan username pengguna, alamat IP client, status keberhasilan,
//            dan waktu login.
// ============================================================
export interface ILoginLog extends Document {
  username: string;
  ip_address: string;
  status: "SUCCESS" | "FAILED";
  timestamp: Date;
}

// ============================================================
// Skema: loginLogSchema
// Deskripsi: Definisi skema MongoDB (Mongoose Schema) untuk mencatat
//            riwayat percobaan login pengguna (berhasil atau gagal).
// ============================================================
const loginLogSchema: Schema = new mongoose.Schema({
  username: { type: String, required: true },
  ip_address: { type: String, required: true },
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// ============================================================
// Indeks & Ekspor Model
// Deskripsi: Membuat indeks pada field 'timestamp' secara descending
//            untuk mempercepat pengurutan dan pencarian log riwayat login terbaru.
// ============================================================
loginLogSchema.index({ timestamp: -1 });

export default mongoose.model<ILoginLog>("LoginLog", loginLogSchema);
