import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { ENV } from "../config/env.js";

export interface AuthRequest extends Request {
  user?: string | jwt.JwtPayload | undefined;
}

// ============================================================
// Fungsi: authenticateToken()
// Deskripsi: Middleware untuk memvalidasi token JWT pada header Authorization
//            atau query parameter. Jika token valid, informasi user disimpan 
//            ke dalam request object (req.user) dan melanjutkan ke handler berikutnya.
//            Jika tidak valid atau hilang, mengembalikan status 401 atau 403.
// ============================================================
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Ambil token dari Header (biasa) atau Query String (khusus download)
  const authHeader = req.headers["authorization"];
  const token = authHeader ? authHeader.split(" ")[1] : (req.query.token as string);

  if (!token) {
    res.status(401).json({ message: "Akses ditolak, token hilang!" });
    return;
  }

  // Melakukan verifikasi token JWT secara asinkron
  jwt.verify(token, ENV.JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ message: "Token tidak valid!" });
      return;
    }
    req.user = user;
    next();
  });
};
