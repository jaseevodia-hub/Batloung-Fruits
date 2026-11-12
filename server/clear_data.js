import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs";

dotenv.config();

const sql = fs.readFileSync(new URL("./clear_data.sql", import.meta.url), "utf8");

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
});

await connection.query(sql);
console.log("All business data cleared. Reference tables kept.");
await connection.end();
