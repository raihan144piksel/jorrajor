import express, { type Request, type Response } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import rateLimit from "express-rate-limit";
import { ENV } from "../config/env.js";
import LoginLog from "../models/LoginLog.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ============================================================
// Konfigurasi Rate Limiting untuk Endpoint Login
// ============================================================
// Membatasi akses login maksimal 5 kali percobaan dalam 15 menit 
// untuk memitigasi serangan brute-force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Terlalu banyak percobaan login, coba lagi setelah 15 menit",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// Endpoint: POST /api/login
// Deskripsi: Memproses permintaan autentikasi login pengguna.
//            Memverifikasi username dan password menggunakan argon2,
//            mencatat riwayat percobaan (sukses/gagal), dan mengeluarkan token JWT.
// ============================================================
router.post("/login", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    
    // --- Mengekstrak Alamat IP Client Secara Aman ---
    let rawIp: string = "UNKNOWN";
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      rawIp = forwarded;
    } else if (Array.isArray(forwarded)) {
      rawIp = forwarded[0] || "UNKNOWN";
    } else if (req.ip) {
      rawIp = req.ip || "UNKNOWN";
    } else if (req.socket.remoteAddress) {
      rawIp = req.socket.remoteAddress || "UNKNOWN";
    }
    const ipAddress = (rawIp.split(",")[0] || "UNKNOWN").trim();

    // 1. Mencari pengguna berdasarkan username
    const user = await User.findOne({ username });
    if (!user) {
      // Catat log login gagal jika username tidak ditemukan
      await LoginLog.create({ username: username || "UNKNOWN", ip_address: ipAddress, status: "FAILED" });
      res.status(401).json({ message: "Username atau Password salah!" });
      return;
    }

    if (!user.password) {
      await LoginLog.create({ username, ip_address: ipAddress, status: "FAILED" });
      res.status(401).json({ message: "Invalid user data" });
      return;
    }

    // 2. Memverifikasi hash password menggunakan argon2
    const isMatch = await argon2.verify(user.password, password);
    if (!isMatch) {
      // Catat log login gagal jika password salah
      await LoginLog.create({ username, ip_address: ipAddress, status: "FAILED" });
      res.status(401).json({ message: "Username atau Password salah!" });
      return;
    }

    // 3. Catat log login sukses ke database
    await LoginLog.create({ username, ip_address: ipAddress, status: "SUCCESS" });

    // 4. Generate token JWT dengan masa berlaku 24 jam
    const token = jwt.sign(
      { id: user._id, username: user.username },
      ENV.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ============================================================
// Endpoint: GET /api/login-logs
// Deskripsi: Mengambil 50 riwayat aktivitas log login terakhir.
//            Endpoint ini dilindungi oleh middleware authenticateToken.
// ============================================================
router.get(
  "/login-logs",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Mengambil data log login diurutkan berdasarkan waktu terbaru
      const logs = await LoginLog.find().sort({ timestamp: -1 }).limit(50).lean();
      res.json(logs);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

export default router;
