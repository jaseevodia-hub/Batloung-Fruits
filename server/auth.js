import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "./db.js";
import { authenticate, requireRole } from "./middleware.js";

dotenv.config();

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const [rows] = await db.query("SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const user = rows[0];
    if (user.is_active === 0) {
      return res.status(401).json({ message: "Account is deactivated" });
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || "batloung-fruits-secret-change-me-2026", { expiresIn: "24h" });
    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Login failed" });
  }
});

router.post("/register", authenticate, requireRole("administrator"), async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: "All required fields must be filled" });
    }
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }
    const hash = await bcrypt.hash(password, 10);
    const userRole = role === "administrator" ? "administrator" : "sales";
    const [result] = await db.query(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [full_name, email, hash, userRole]
    );
    res.status(201).json({ message: "User registered successfully", id: result.insertId });
  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(500).json({ message: "Registration failed" });
  }
});

export default router;
