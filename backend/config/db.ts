import mongoose from "mongoose";
import { ENV } from "./env.js";
import User from "../models/User.js";
import argon2 from "argon2";

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(ENV.MONGO_URI);
    console.log("✅ MongoDB Connected");
    await seedAdminUser();
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  }
};

const seedAdminUser = async () => {
  try {
    const existingUser = await User.findOne({ username: ENV.ADMIN_USERNAME });
    if (!existingUser) {
      console.log(`[Seed] Creating default admin account: ${ENV.ADMIN_USERNAME}`);
      const hashedPassword = await argon2.hash(ENV.ADMIN_PASSWORD);
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
