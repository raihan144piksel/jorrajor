import mongoose, { Document, Schema } from "mongoose";

// ============================================================
// Interface: IUser
// Deskripsi: Representasi tipe data TypeScript untuk dokumen user (pengguna),
//            menyimpan username dan hash password pengguna.
// ============================================================
export interface IUser extends Document {
  username: string;
  password?: string;
}

// ============================================================
// Skema: userSchema
// Deskripsi: Definisi skema MongoDB (Mongoose Schema) untuk otentikasi akun pengguna.
// ============================================================
const userSchema: Schema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// ============================================================
// Ekspor Model
// Deskripsi: Mengekspor Mongoose model 'User' berdasarkan skema userSchema.
// ============================================================

export default mongoose.model<IUser>("User", userSchema);
