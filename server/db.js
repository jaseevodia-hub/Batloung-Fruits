
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "batloung_fruits",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test the database connection
try {
  const connection = await db.getConnection();
  console.log("Connected to Batloung Fruits MySQL database!");
  connection.release();
} catch (error) {
  console.error("MySQL connection failed:", error.message);
}

export default db;