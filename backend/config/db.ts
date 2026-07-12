import mongoose from "mongoose";
import { ENV } from "./env.js";
import User from "../models/User.js";
import argon2 from "argon2";

// ============================================================
// Fungsi: connectDB()
// Deskripsi: Menghubungkan server backend ke database MongoDB menggunakan URI koneksi.
//            Jika berhasil, server menjalankan seeding untuk akun admin default.
//            Jika gagal, server mencetak error dan mematikan sistem (Fail-Fast).
// ============================================================
export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(ENV.MONGO_URI);
    console.log("✅ MongoDB Connected");
    // Jalankan seeding data admin default
    await seedAdminUser();
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
    process.exit(1); // Hentikan server jika koneksi database gagal
  }
};

// ============================================================
// Fungsi: seedAdminUser()
// Deskripsi: Melakukan seeding/pembuatan user admin secara otomatis jika database 
//            belum memiliki user terdaftar, menggunakan kredensial dari .env.
// ============================================================
const seedAdminUser = async () => {
  try {
    // Memeriksa apakah user admin default sudah ada di database
    const existingUser = await User.findOne({ username: ENV.ADMIN_USERNAME });
    if (!existingUser) {
      console.log(`[Seed] Creating default admin account: ${ENV.ADMIN_USERNAME}`);
      
      // Mengenkripsi password admin menggunakan algoritma argon2
      const hashedPassword = await argon2.hash(ENV.ADMIN_PASSWORD);
      
      // Membuat user admin baru di database
      await User.create({
        username: ENV.ADMIN_USERNAME,
        password: hashedPassword,
      });
      console.log("✅ Default admin account created successfully.");
    } else {
      console.log("[Seed] Admin account already exists.");
    }
  } catch (err) {
    console.error("❌ Error seeding admin user:", err);
  }
};
