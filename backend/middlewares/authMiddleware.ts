import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { ENV } from "../config/env.js";

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Akses ditolak, token hilang!" });
    return;
  }

  jwt.verify(token, ENV.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ message: "Token tidak valid!" });
      return;
    }
    req.user = user;
    next();
  });
};
