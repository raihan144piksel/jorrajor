import express, { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import rateLimit from "express-rate-limit";
import { ENV } from "../config/env.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    message: "Terlalu banyak percobaan login, coba lagi setelah 15 menit",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ message: "Username atau Password salah!" });
      return;
    }

    if (!user.password) {
      res.status(401).json({ message: "Invalid user data" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Username atau Password salah!" });
      return;
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      ENV.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token });
  } catch {
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;
