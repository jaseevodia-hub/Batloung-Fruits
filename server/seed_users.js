import bcrypt from "bcryptjs";
import db from "./db.js";

const users = [
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

for (const user of users) {
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

  console.log(`User ready: ${user.email} (${user.role})`);
}

await db.end();
process.exit(0);
