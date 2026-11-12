import db from "./db.js";

const saProvinces = [
  { id: 1, name: "Eastern Cape" },
  { id: 2, name: "Free State" },
  { id: 3, name: "Gauteng" },
  { id: 4, name: "KwaZulu-Natal" },
  { id: 5, name: "Limpopo" },
  { id: 6, name: "Mpumalanga" },
  { id: 7, name: "Northern Cape" },
  { id: 8, name: "North West" },
  { id: 9, name: "Western Cape" },
];

for (const p of saProvinces) {
  await db.query("UPDATE provinces SET name = ? WHERE id = ?", [p.name, p.id]);
}

console.log("Updated provinces to 9 SA provinces.");
await db.end();
process.exit(0);
