import mysql from "mysql2/promise";
import "dotenv/config";

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const saProvinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

for (const name of saProvinces) {
  await conn.query("INSERT IGNORE INTO provinces (name) VALUES (?)", [name]);
}

const fruits = ["Apples", "Bananas", "Oranges", "Mangoes", "Grapes"];
for (const name of fruits) {
  await conn.query(
    "INSERT IGNORE INTO fruits (fruit_name, status) VALUES (?, 'active')",
    [name]
  );
}
await conn.query(
  "DELETE FROM fruits WHERE fruit_name = 'Mangos' AND id <> (SELECT id FROM (SELECT MIN(id) AS id FROM fruits WHERE fruit_name = 'Mangoes') t)"
);
await conn.query("DELETE FROM fruits WHERE fruit_name = 'Banana' AND id <> 2");

await conn.query("DELETE FROM fruit_source_provinces");

const mappings = {
  Apples: ["Western Cape", "Free State", "Mpumalanga"],
  Bananas: ["Limpopo", "KwaZulu-Natal", "Mpumalanga"],
  Oranges: ["Limpopo", "Mpumalanga", "Eastern Cape"],
  Mangoes: ["Limpopo", "Mpumalanga", "KwaZulu-Natal"],
  Grapes: ["Western Cape", "Northern Cape", "Limpopo"],
};

for (const [fruit, provinces] of Object.entries(mappings)) {
  for (const province of provinces) {
    const [r] = await conn.query(
      `INSERT IGNORE INTO fruit_source_provinces (fruit_id, province_id)
       SELECT f.id, p.id FROM fruits f, provinces p
       WHERE f.fruit_name = ? AND p.name = ?`,
      [fruit, province]
    );
    if (r.affectedRows === 0) {
      console.log("MISSING: " + fruit + " -> " + province);
    }
  }
}

const [rows] = await conn.query(
  `SELECT f.fruit_name, GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') AS provinces
   FROM fruit_source_provinces fsp
   JOIN fruits f ON f.id = fsp.fruit_id
   JOIN provinces p ON p.id = fsp.province_id
   GROUP BY f.fruit_name
   ORDER BY f.fruit_name`
);

rows.forEach((r) => console.log(r.fruit_name + ": " + r.provinces));
console.log("Total mappings:", rows.length);

await conn.end();
