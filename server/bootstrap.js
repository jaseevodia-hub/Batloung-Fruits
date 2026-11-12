import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SEED_USERS = [
  {
    full_name: "Administrator",
    email: "tholoanajase20@gmail.com",
    password: "INNOCENT1234567890",
    role: "administrator",
  },
  {
    full_name: "Sales Assistant",
    email: "sales@batloung.com",
    password: "Sales@123",
    role: "sales",
  },
];

async function tableExists(name) {
  const [rows] = await db.execute(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?
     LIMIT 1`,
    [name]
  );
  return rows.length > 0;
}

async function seedUsers() {
  const [rows] = await db.query("SELECT COUNT(*) AS total FROM users");

  if (Number(rows[0].total) > 0) {
    return;
  }

  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await db.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         password_hash = VALUES(password_hash),
         role = VALUES(role),
         is_active = 1`,
      [user.full_name, user.email, passwordHash, user.role]
    );

    console.log(`Seeded user: ${user.email} (${user.role})`);
  }
}

async function initialize() {
  if (!(await tableExists("users"))) {
    console.log("Initializing database schema...");
    const schema = fs.readFileSync(
      path.join(__dirname, "database.sql"),
      "utf8"
    );
    await db.query(schema);
    console.log("Database schema created.");
  }

  const reference = fs.readFileSync(
    path.join(__dirname, "initial_reference_data.sql"),
    "utf8"
  );
  await db.query(reference);

  await seedUsers();

  console.log("Database is ready.");
}

export async function ensureDatabaseReady(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await initialize();
      return;
    } catch (error) {
      console.error(
        `Database bootstrap attempt ${attempt}/${retries} failed: ${error.message}`
      );

      if (attempt === retries) {
        console.error(
          "Database bootstrap did not complete. The API will start but database routes may fail until it is ready."
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
