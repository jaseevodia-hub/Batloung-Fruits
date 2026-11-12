
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./db.js";
import authRouter from "./auth.js";
import { authenticate, requireRole } from "./middleware.js";
import { ensureDatabaseReady } from "./bootstrap.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Public routes (no token required)
app.use("/api/auth", authRouter);

// ==================================================
// HOME AND HEALTH
// ==================================================

app.get("/", (req, res) => {
  res.json({
    message: "Batloung Fruits Management API is running!",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "The server is working correctly.",
  });
});

// ==================================================
// AUTHENTICATION (every /api data route below needs a valid token)
// ==================================================

app.use("/api", authenticate);

// ==================================================
// GEOCODING PROXY
// Requests go through the server so the browser never
// has to call Nominatim directly, the required
// User-Agent is always sent, and results are cached
// (Nominatim allows at most one request per second).
// ==================================================

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_HEADERS = {
  "User-Agent": "BatloungFruitsApp/1.0 (vendor trading-area picker)",
  Accept: "application/json",
};

const geocodeCache = new Map();
const GEOCODE_CACHE_TTL = 24 * 60 * 60 * 1000;

function geocodeCacheGet(key) {
  const hit = geocodeCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.time > GEOCODE_CACHE_TTL) {
    geocodeCache.delete(key);
    return undefined;
  }
  return hit.value;
}

function geocodeCacheSet(key, value) {
  geocodeCache.set(key, { time: Date.now(), value });
}

function pickPlaceName(address, fallback, displayName) {
  const parts = [
    address.suburb,
    address.neighbourhood,
    address.village,
    address.hamlet,
    address.town,
    address.city,
    address.municipality,
    address.county,
    address.state_district,
    address.state,
    address.region,
  ].filter(Boolean);

  if (parts.length) {
    return parts.slice(0, 2).join(", ");
  }

  if (fallback) return fallback;

  if (displayName) {
    const cleaned = String(displayName)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");
    return cleaned;
  }

  return "";
}

function isCoordinate(value, min, max) {
  const num = Number(value);
  return Number.isFinite(num) && num >= min && num <= max;
}

app.get("/api/geocode/reverse", async (req, res) => {
  const { lat, lng } = req.query;

  if (!isCoordinate(lat, -90, 90) || !isCoordinate(lng, -180, 180)) {
    return res.status(400).json({ error: "Valid lat and lng are required." });
  }

  const key = `rev:${Number(lat).toFixed(4)}:${Number(lng).toFixed(4)}`;
  const cached = geocodeCacheGet(key);
  if (cached !== undefined) return res.json({ area: cached });

  try {
    const url =
      `${NOMINATIM_URL}/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
      `&zoom=16&addressdetails=1`;

    const response = await fetch(url, { headers: NOMINATIM_HEADERS });

    if (!response.ok) {
      return res
        .status(502)
        .json({ error: "The place lookup service is unavailable." });
    }

    const data = await response.json();
    const area = pickPlaceName(data.address || {}, data.display_name, data.display_name);
    geocodeCacheSet(key, area);

    res.json({ area });
  } catch {
    res
      .status(502)
      .json({ error: "The place lookup service is unavailable." });
  }
});

app.get("/api/geocode/search", async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({ error: "A search query is required." });
  }

  const key = `search:${query.toLowerCase()}`;
  const cached = geocodeCacheGet(key);
  if (cached !== undefined) return res.json({ results: cached });

  try {
    const url =
      `${NOMINATIM_URL}/search?format=jsonv2` +
      `&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;

    const response = await fetch(url, { headers: NOMINATIM_HEADERS });

    if (!response.ok) {
      return res
        .status(502)
        .json({ error: "The place search service is unavailable." });
    }

    const data = await response.json();
    const results = (Array.isArray(data) ? data : []).map((place) => ({
      id: place.place_id,
      lat: place.lat,
      lng: place.lon,
      label: pickPlaceName(
        place.address || {},
        place.name || place.display_name,
        place.display_name
      ),
      displayName: place.display_name || "",
    }));

    geocodeCacheSet(key, results);
    res.json({ results });
  } catch {
    res
      .status(502)
      .json({ error: "The place search service is unavailable." });
  }
});

function parseCoordinate(value, min, max) {
  if (value === null || value === undefined || value === "") {
    return { value: null, error: false };
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { value: null, error: true };
  }

  if (num < min || num > max) {
    return { value: null, error: true };
  }

  return { value: num, error: false };
}

// ==================================================
// FRUIT MANAGEMENT
// ==================================================

// Get all fruits
app.get("/api/fruits", async (req, res) => {
  try {
    const [fruits] = await db.query(
      `SELECT id, fruit_name, description, status
       FROM fruits ORDER BY id`
    );
    res.json(fruits);
  } catch (error) {
    console.error("Error fetching fruits:", error.message);
    res.status(500).json({ message: "Failed to fetch fruits." });
  }
});

// Get one fruit
app.get("/api/fruits/:id", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, fruit_name, description, status
       FROM fruits WHERE id = ?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Fruit not found." });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching fruit:", error.message);
    res.status(500).json({ message: "Failed to fetch fruit." });
  }
});

// Add a fruit
app.post("/api/fruits", requireRole("administrator"), async (req, res) => {
  const fruitName =
    typeof req.body.fruit_name === "string"
      ? req.body.fruit_name.trim()
      : "";
  const description =
    typeof req.body.description === "string"
      ? req.body.description.trim()
      : "";
  const status = req.body.status || "active";

  if (!fruitName) {
    return res.status(400).json({
      message: "Fruit name is required.",
    });
  }

  if (fruitName.length > 60 || description.length > 255) {
    return res.status(400).json({
      message:
        "Fruit name must be 60 characters or fewer and description 255 characters or fewer.",
    });
  }

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({
      message: "Status must be active or inactive.",
    });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO fruits (fruit_name, description, status)
       VALUES (?, ?, ?)`,
      [fruitName, description || null, status]
    );

    res.status(201).json({
      message: "Fruit type added successfully.",
      id: result.insertId,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "This fruit already exists.",
      });
    }

    console.error("Error adding fruit:", error.message);
    res.status(500).json({
      message: "Failed to add fruit type.",
    });
  }
});

// Update a fruit
app.put("/api/fruits/:id", requireRole("administrator"), async (req, res) => {
  const id = Number(req.params.id);
  const fruitName =
    typeof req.body.fruit_name === "string"
      ? req.body.fruit_name.trim()
      : "";
  const description =
    typeof req.body.description === "string"
      ? req.body.description.trim()
      : "";
  const status = req.body.status || "active";

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid fruit ID." });
  }

  if (!fruitName) {
    return res.status(400).json({
      message: "Fruit name is required.",
    });
  }

  if (fruitName.length > 60 || description.length > 255) {
    return res.status(400).json({
      message:
        "Fruit name must be 60 characters or fewer and description 255 characters or fewer.",
    });
  }

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({
      message: "Status must be active or inactive.",
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE fruits
       SET fruit_name = ?, description = ?, status = ?
       WHERE id = ?`,
      [fruitName, description || null, status, id]
    );

    if (!result.affectedRows) {
      const [rows] = await db.execute(
        "SELECT id FROM fruits WHERE id = ?",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Fruit type not found.",
        });
      }
    }

    res.json({ message: "Fruit type updated successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "This fruit already exists.",
      });
    }

    console.error("Error updating fruit:", error.message);
    res.status(500).json({
      message: "Failed to update fruit type.",
    });
  }
});

// Delete a fruit
app.delete("/api/fruits/:id", requireRole("administrator"), async (req, res) => {
  try {
    const [result] = await db.execute(
      "DELETE FROM fruits WHERE id = ?",
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Fruit not found.",
      });
    }

    res.json({ message: "Fruit deleted successfully." });
  } catch (error) {
    console.error("Error deleting fruit:", error.message);
    res.status(409).json({
      message:
        "This fruit cannot be deleted because it may be linked to other records.",
    });
  }
});

// ==================================================
// BOX SIZES
// ==================================================

app.get("/api/box-sizes", async (req, res) => {
  try {
    const [sizes] = await db.execute(
      `SELECT id, size_name, description
       FROM box_sizes ORDER BY id`
    );
    res.json(sizes);
  } catch (error) {
    console.error("Error fetching box sizes:", error.message);
    res.status(500).json({
      message: "Failed to fetch box sizes.",
    });
  }
});

// ==================================================
// PRODUCT MANAGEMENT
// ==================================================

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const [products] = await db.execute(`
      SELECT
        p.id,
        p.fruit_id,
        f.fruit_name AS fruit,
        p.box_size_id,
        b.size_name AS size,
        p.quantity_per_box,
        p.selling_price,
        p.quantity_available,
        p.status
      FROM products p
      JOIN fruits f ON p.fruit_id = f.id
      JOIN box_sizes b ON p.box_size_id = b.id
      ORDER BY p.id
    `);
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({
      message: "Failed to fetch products.",
    });
  }
});

// Add a product
app.post("/api/products", requireRole("administrator"), async (req, res) => {
  const {
    fruit_id,
    box_size_id,
    quantity_per_box = 10,
    selling_price,
    quantity_available = 0,
    status = "active",
  } = req.body;

  if (
    !Number.isInteger(Number(fruit_id)) ||
    Number(fruit_id) <= 0 ||
    !Number.isInteger(Number(box_size_id)) ||
    Number(box_size_id) <= 0 ||
    !Number.isInteger(Number(quantity_per_box)) ||
    Number(quantity_per_box) <= 0 ||
    selling_price === "" ||
    !Number.isFinite(Number(selling_price)) ||
    Number(selling_price) <= 0 ||
    !Number.isInteger(Number(quantity_available)) ||
    Number(quantity_available) < 0 ||
    !["active", "inactive"].includes(status)
  ) {
    return res.status(400).json({
      message: "Please enter valid product details.",
    });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO products
       (fruit_id, box_size_id, quantity_per_box, selling_price,
        quantity_available, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(fruit_id),
        Number(box_size_id),
        Number(quantity_per_box),
        Number(selling_price),
        Number(quantity_available),
        status,
      ]
    );

    res.status(201).json({
      message: "Product added successfully.",
      id: result.insertId,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "This fruit and box size already have a product.",
      });
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        message: "The selected fruit or box size does not exist.",
      });
    }

    console.error("Error adding product:", error.message);
    res.status(500).json({
      message: "Failed to add product.",
    });
  }
});

// Update a product
app.put("/api/products/:id", requireRole("administrator"), async (req, res) => {
  const id = Number(req.params.id);
  const {
    fruit_id,
    box_size_id,
    quantity_per_box,
    selling_price,
    quantity_available,
    status,
  } = req.body;

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    !Number.isInteger(Number(fruit_id)) ||
    Number(fruit_id) <= 0 ||
    !Number.isInteger(Number(box_size_id)) ||
    Number(box_size_id) <= 0 ||
    !Number.isInteger(Number(quantity_per_box)) ||
    Number(quantity_per_box) <= 0 ||
    selling_price === "" ||
    !Number.isFinite(Number(selling_price)) ||
    Number(selling_price) <= 0 ||
    !Number.isInteger(Number(quantity_available)) ||
    Number(quantity_available) < 0 ||
    !["active", "inactive"].includes(status)
  ) {
    return res.status(400).json({
      message: "Please enter valid product details.",
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE products
       SET fruit_id = ?, box_size_id = ?, quantity_per_box = ?,
           selling_price = ?, quantity_available = ?, status = ?
       WHERE id = ?`,
      [
        Number(fruit_id),
        Number(box_size_id),
        Number(quantity_per_box),
        Number(selling_price),
        Number(quantity_available),
        status,
        id,
      ]
    );

    if (!result.affectedRows) {
      const [rows] = await db.execute(
        "SELECT id FROM products WHERE id = ?",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Product not found.",
        });
      }
    }

    res.json({ message: "Product updated successfully." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "This fruit and box size already have a product.",
      });
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        message: "The selected fruit or box size does not exist.",
      });
    }

    console.error("Error updating product:", error.message);
    res.status(500).json({
      message: "Failed to update product.",
    });
  }
});

// Delete a product
app.delete("/api/products/:id", requireRole("administrator"), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Invalid product ID.",
    });
  }

  try {
    const [result] = await db.execute(
      "DELETE FROM products WHERE id = ?",
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    res.json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error("Error deleting product:", error.message);
    res.status(409).json({
      message:
        "This product cannot be deleted because it is linked to other records.",
    });
  }
});

// ==================================================
// REFERENCE DATA
// ==================================================

// Get order statuses
app.get("/api/order-statuses", async (req, res) => {
  try {
    const [statuses] = await db.query(
      `SELECT id, code, label
       FROM order_statuses ORDER BY sort_order, id`
    );
    res.json(statuses);
  } catch (error) {
    console.error("Error fetching order statuses:", error.message);
    res.status(500).json({
      message: "Failed to fetch order statuses.",
    });
  }
});

// Get sidebar menu items
app.get("/api/menu-items", async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT id, name, path, icon
       FROM menu_items ORDER BY sort_order, id`
    );
    res.json(items);
  } catch (error) {
    console.error("Error fetching menu items:", error.message);
    res.status(500).json({
      message: "Failed to fetch menu items.",
    });
  }
});

// ==================================================
// USER MANAGEMENT (administrator only)
// ==================================================

// List all users
app.get("/api/users", requireRole("administrator"), async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, full_name, email, role, is_active, created_at
       FROM users ORDER BY id`
    );
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ message: "Failed to fetch users." });
  }
});

// Create a user
app.post("/api/users", requireRole("administrator"), async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        message: "Full name, email and password are required.",
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === "administrator" ? "administrator" : "sales";

    const [result] = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [full_name, email, passwordHash, userRole]
    );

    res.status(201).json({
      message: "User created successfully.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error creating user:", error.message);
    res.status(500).json({ message: "Failed to create user." });
  }
});

// Update a user (name, email, role, active status, optional new password)
app.put("/api/users/:id", requireRole("administrator"), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, is_active, password } = req.body;

    const [existing] = await db.query(
      "SELECT id FROM users WHERE id = ?",
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({ message: "User not found." });
    }

    if (email) {
      const [duplicate] = await db.query(
        "SELECT id FROM users WHERE email = ? AND id <> ?",
        [email, id]
      );
      if (duplicate.length) {
        return res.status(409).json({ message: "Email already in use." });
      }
    }

    const fields = [];
    const values = [];

    if (full_name !== undefined) {
      fields.push("full_name = ?");
      values.push(full_name);
    }
    if (email !== undefined) {
      fields.push("email = ?");
      values.push(email);
    }
    if (role !== undefined) {
      fields.push("role = ?");
      values.push(role === "administrator" ? "administrator" : "sales");
    }
    if (is_active !== undefined) {
      fields.push("is_active = ?");
      values.push(is_active ? 1 : 0);
    }
    if (password) {
      fields.push("password_hash = ?");
      values.push(await bcrypt.hash(password, 10));
    }

    if (!fields.length) {
      return res.status(400).json({ message: "Nothing to update." });
    }

    values.push(id);

    await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ message: "User updated successfully." });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ message: "Failed to update user." });
  }
});

// Delete a user
app.delete("/api/users/:id", requireRole("administrator"), async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.user.id) === String(id)) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account." });
    }

    const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error.message);
    res.status(500).json({ message: "Failed to delete user." });
  }
});

// ==================================================
// PROVINCE MANAGEMENT
// ==================================================
// Get all provinces
app.get("/api/provinces", async (req, res) => {
  try {
    const [provinces] = await db.query(
      "SELECT id, name FROM provinces ORDER BY name"
    );
    res.json(provinces);
  } catch (error) {
    console.error("Error fetching provinces:", error.message);
    res.status(500).json({
      message: "Failed to fetch provinces.",
    });
  }
});

// Add a province
app.post("/api/provinces", requireRole("administrator"), async (req, res) => {
  try {
    const name =
      typeof req.body.name === "string"
        ? req.body.name.trim()
        : "";

    if (!name) {
      return res.status(400).json({
        message: "Province name is required.",
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        message: "Province name must not exceed 100 characters.",
      });
    }

    const [existing] = await db.execute(
      "SELECT id FROM provinces WHERE LOWER(name) = LOWER(?)",
      [name]
    );

    if (existing.length) {
      return res.status(409).json({
        message: "This province already exists.",
      });
    }

    const [result] = await db.execute(
      "INSERT INTO provinces (name) VALUES (?)",
      [name]
    );

    res.status(201).json({
      message: "Province added successfully.",
      id: result.insertId,
      name,
    });
  } catch (error) {
    console.error("Error adding province:", error.message);
    res.status(500).json({
      message: "Failed to add province.",
    });
  }
});

// ==================================================
// SUPPLIER MANAGEMENT
// ==================================================

// Get all suppliers
app.get("/api/suppliers", async (req, res) => {
  try {
    const [suppliers] = await db.query(`
      SELECT
        s.id,
        s.supplier_name,
        s.province_id,
        p.name AS province,
        s.contact_person,
        s.telephone,
        s.email,
        s.physical_address,
        s.created_at
      FROM suppliers s
      JOIN provinces p ON s.province_id = p.id
      ORDER BY s.id DESC
    `);
    res.json(suppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error.message);
    res.status(500).json({
      message: "Failed to fetch suppliers.",
    });
  }
});

// Get one supplier
app.get("/api/suppliers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid supplier ID.",
      });
    }

    const [rows] = await db.query(
      `SELECT s.id, s.supplier_name, s.province_id,
              p.name AS province, s.contact_person, s.telephone,
              s.email, s.physical_address, s.created_at
       FROM suppliers s
       JOIN provinces p ON s.province_id = p.id
       WHERE s.id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Supplier not found.",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching supplier:", error.message);
    res.status(500).json({
      message: "Failed to fetch supplier.",
    });
  }
});

// Add a supplier
app.post("/api/suppliers", requireRole("administrator"), async (req, res) => {
  try {
    const {
      supplier_name,
      province_id,
      contact_person,
      telephone,
      email,
      physical_address,
    } = req.body;

    if (
      typeof supplier_name !== "string" ||
      !supplier_name.trim() ||
      !province_id ||
      typeof contact_person !== "string" ||
      !contact_person.trim() ||
      typeof telephone !== "string" ||
      !telephone.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof physical_address !== "string" ||
      !physical_address.trim()
    ) {
      return res.status(400).json({
        message: "Please provide all required supplier details.",
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    const [provinceRows] = await db.query(
      "SELECT id FROM provinces WHERE id = ?",
      [Number(province_id)]
    );

    if (!provinceRows.length) {
      return res.status(400).json({
        message: "Please select a valid province.",
      });
    }

    const [result] = await db.query(
      `INSERT INTO suppliers
       (supplier_name, province_id, contact_person, telephone,
        email, physical_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        supplier_name.trim(),
        Number(province_id),
        contact_person.trim(),
        telephone.trim(),
        email.trim(),
        physical_address.trim(),
      ]
    );

    res.status(201).json({
      message: "Supplier added successfully.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error adding supplier:", error.message);
    res.status(500).json({
      message: "Failed to add supplier.",
    });
  }
});

// Update a supplier
app.put("/api/suppliers/:id", requireRole("administrator"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      supplier_name,
      province_id,
      contact_person,
      telephone,
      email,
      physical_address,
    } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid supplier ID.",
      });
    }

    if (
      typeof supplier_name !== "string" ||
      !supplier_name.trim() ||
      !province_id ||
      typeof contact_person !== "string" ||
      !contact_person.trim() ||
      typeof telephone !== "string" ||
      !telephone.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof physical_address !== "string" ||
      !physical_address.trim()
    ) {
      return res.status(400).json({
        message: "Please provide all required supplier details.",
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    const [provinceRows] = await db.query(
      "SELECT id FROM provinces WHERE id = ?",
      [Number(province_id)]
    );

    if (!provinceRows.length) {
      return res.status(400).json({
        message: "Please select a valid province.",
      });
    }

    const [result] = await db.query(
      `UPDATE suppliers
       SET supplier_name = ?, province_id = ?, contact_person = ?,
           telephone = ?, email = ?, physical_address = ?
       WHERE id = ?`,
      [
        supplier_name.trim(),
        Number(province_id),
        contact_person.trim(),
        telephone.trim(),
        email.trim(),
        physical_address.trim(),
        id,
      ]
    );

    if (!result.affectedRows) {
      const [rows] = await db.query(
        "SELECT id FROM suppliers WHERE id = ?",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Supplier not found.",
        });
      }
    }

    res.json({ message: "Supplier updated successfully." });
  } catch (error) {
    console.error("Error updating supplier:", error.message);
    res.status(500).json({
      message: "Failed to update supplier.",
    });
  }
});

// Delete a supplier
app.delete("/api/suppliers/:id", requireRole("administrator"), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid supplier ID.",
      });
    }

    const [result] = await db.query(
      "DELETE FROM suppliers WHERE id = ?",
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Supplier not found.",
      });
    }

    res.json({ message: "Supplier deleted successfully." });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message:
          "This supplier cannot be deleted because it has linked purchases.",
      });
    }

    console.error("Error deleting supplier:", error.message);
    res.status(500).json({
      message: "Failed to delete supplier.",
    });
  }
});

// ==================================================
// STREET VENDOR MANAGEMENT
// ==================================================

// Get all vendors
app.get("/api/vendors", async (req, res) => {
  try {
    const [vendors] = await db.query(`
      SELECT id, vendor_name, business_name, telephone, area,
             registration_date, status, latitude, longitude, created_at
      FROM street_vendors
      ORDER BY id DESC
    `);
    res.json(vendors);
  } catch (error) {
    console.error("Error fetching vendors:", error.message);
    res.status(500).json({
      message: "Failed to fetch vendors.",
    });
  }
});

// Get one vendor
app.get("/api/vendors/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid vendor ID.",
      });
    }

    const [rows] = await db.query(
      `SELECT id, vendor_name, business_name, telephone, area,
              registration_date, status, latitude, longitude, created_at
       FROM street_vendors WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: "Street vendor not found.",
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching vendor:", error.message);
    res.status(500).json({
      message: "Failed to fetch street vendor.",
    });
  }
});

// Add a vendor
app.post("/api/vendors", async (req, res) => {
  try {
    const {
      vendor_name,
      business_name,
      telephone,
      area,
      registration_date,
      status = "active",
      latitude,
      longitude,
    } = req.body;

    if (
      typeof vendor_name !== "string" ||
      !vendor_name.trim() ||
      typeof business_name !== "string" ||
      !business_name.trim() ||
      typeof telephone !== "string" ||
      !telephone.trim() ||
      typeof area !== "string" ||
      !area.trim()
    ) {
      return res.status(400).json({
        message: "Please complete all required vendor details.",
      });
    }

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be active or inactive.",
      });
    }

    let date = null;

    if (registration_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(registration_date)) {
        return res.status(400).json({
          message: "Registration date must use YYYY-MM-DD format.",
        });
      }
      date = registration_date;
    }

    const lat = parseCoordinate(latitude, -90, 90);
    const lng = parseCoordinate(longitude, -180, 180);

    if (lat.error || lng.error) {
      return res.status(400).json({
        message: "Latitude or longitude is not valid.",
      });
    }

    const [result] = await db.query(
      `INSERT INTO street_vendors
       (vendor_name, business_name, telephone, area,
        registration_date, status, latitude, longitude)
       VALUES (?, ?, ?, ?, COALESCE(?, CURDATE()), ?, ?, ?)`,
      [
        vendor_name.trim(),
        business_name.trim(),
        telephone.trim(),
        area.trim(),
        date,
        status,
        lat.value,
        lng.value,
      ]
    );

    res.status(201).json({
      message: "Street vendor added successfully.",
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error adding vendor:", error.message);
    res.status(500).json({
      message: "Failed to add vendor.",
    });
  }
});

// Update a vendor
app.put("/api/vendors/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      vendor_name,
      business_name,
      telephone,
      area,
      registration_date,
      status,
      latitude,
      longitude,
    } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid vendor ID.",
      });
    }

    if (
      typeof vendor_name !== "string" ||
      !vendor_name.trim() ||
      typeof business_name !== "string" ||
      !business_name.trim() ||
      typeof telephone !== "string" ||
      !telephone.trim() ||
      typeof area !== "string" ||
      !area.trim() ||
      !registration_date
    ) {
      return res.status(400).json({
        message: "Please complete all required vendor details.",
      });
    }

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        message: "Status must be active or inactive.",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(registration_date)) {
      return res.status(400).json({
        message: "Registration date must use YYYY-MM-DD format.",
      });
    }

    const lat = parseCoordinate(latitude, -90, 90);
    const lng = parseCoordinate(longitude, -180, 180);

    if (lat.error || lng.error) {
      return res.status(400).json({
        message: "Latitude or longitude is not valid.",
      });
    }

    const [result] = await db.query(
      `UPDATE street_vendors
       SET vendor_name = ?, business_name = ?, telephone = ?,
           area = ?, registration_date = ?, status = ?,
           latitude = ?, longitude = ?
       WHERE id = ?`,
      [
        vendor_name.trim(),
        business_name.trim(),
        telephone.trim(),
        area.trim(),
        registration_date,
        status,
        lat.value,
        lng.value,
        id,
      ]
    );

    if (!result.affectedRows) {
      const [rows] = await db.query(
        "SELECT id FROM street_vendors WHERE id = ?",
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Street vendor not found.",
        });
      }
    }

    res.json({ message: "Street vendor updated successfully." });
  } catch (error) {
    console.error("Error updating vendor:", error.message);
    res.status(500).json({
      message: "Failed to update vendor.",
    });
  }
});

// Delete a vendor
app.delete("/api/vendors/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Invalid vendor ID.",
      });
    }

    const [result] = await db.query(
      "DELETE FROM street_vendors WHERE id = ?",
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Street vendor not found.",
      });
    }

    res.json({ message: "Street vendor deleted successfully." });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message:
          "This vendor cannot be deleted because it has linked orders.",
      });
    }

    console.error("Error deleting vendor:", error.message);
    res.status(500).json({
      message: "Failed to delete vendor.",
    });
  }
});

// ==================================================
// ORDER MANAGEMENT
// ==================================================

// Get all orders
app.get("/api/orders", async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.id, o.order_number, o.vendor_id,
             v.vendor_name, v.business_name,
             o.order_date, o.status, o.total_amount,
             o.notes, o.created_at
      FROM orders o
      JOIN street_vendors v ON o.vendor_id = v.id
      ORDER BY o.id DESC
    `);
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({
      message: "Failed to fetch orders.",
    });
  }
});

// Get one order and its items
app.get("/api/orders/:id", async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const [orders] = await db.execute(
      `SELECT o.*, v.vendor_name, v.business_name, v.telephone
       FROM orders o
       JOIN street_vendors v ON o.vendor_id = v.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (!orders.length) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    const [items] = await db.execute(
      `SELECT oi.id, oi.product_id, f.fruit_name AS fruit,
              b.size_name AS size, oi.quantity_boxes,
              oi.unit_price, oi.subtotal
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN fruits f ON p.fruit_id = f.id
       JOIN box_sizes b ON p.box_size_id = b.id
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
      [orderId]
    );

    res.json({ ...orders[0], items });
  } catch (error) {
    console.error("Error fetching order:", error.message);
    res.status(500).json({
      message: "Failed to fetch order.",
    });
  }
});

// Create an order
app.post("/api/orders", async (req, res) => {
  let connection;

  try {
    const vendorId = Number(req.body.vendor_id);
    const { items, notes = null } = req.body;

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      return res.status(400).json({
        message: "Select a valid vendor.",
      });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        message: "An order must contain at least one product.",
      });
    }

    if (
      notes !== null &&
      (typeof notes !== "string" || notes.length > 255)
    ) {
      return res.status(400).json({
        message: "Notes must be 255 characters or fewer.",
      });
    }

    const cleanItems = items.map((item) => ({
      product_id: Number(item.product_id),
      quantity_boxes: Number(item.quantity_boxes),
    }));

    if (
      cleanItems.some(
        (item) =>
          !Number.isInteger(item.product_id) ||
          item.product_id <= 0 ||
          !Number.isInteger(item.quantity_boxes) ||
          item.quantity_boxes <= 0
      )
    ) {
      return res.status(400).json({
        message: "Each product needs a valid ID and positive box quantity.",
      });
    }

    const quantities = new Map();

    for (const item of cleanItems) {
      quantities.set(
        item.product_id,
        (quantities.get(item.product_id) || 0) +
          item.quantity_boxes
      );
    }

    const orderItems = Array.from(
      quantities,
      ([product_id, quantity_boxes]) => ({
        product_id,
        quantity_boxes,
      })
    );

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [vendors] = await connection.execute(
      `SELECT id FROM street_vendors
       WHERE id = ? AND status = 'active'`,
      [vendorId]
    );

    if (!vendors.length) {
      await connection.rollback();
      return res.status(400).json({
        message: "Vendor not found or inactive.",
      });
    }

    const year = new Date().getFullYear();

    const [numberRows] = await connection.execute(
      `SELECT COALESCE(
         MAX(CAST(SUBSTRING_INDEX(order_number, '-', -1) AS UNSIGNED)),
         0
       ) AS last_number
       FROM orders
       WHERE order_number LIKE ?`,
      [`ORD-${year}-%`]
    );

    const nextNumber = Number(numberRows[0].last_number) + 1;
    const orderNumber =
      `ORD-${year}-${String(nextNumber).padStart(4, "0")}`;

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
       (order_number, vendor_id, status, total_amount, notes,
        stock_deducted, created_by)
       VALUES (?, ?, 'pending', 0, ?, 0, ?)`,
      [orderNumber, vendorId, notes, req.user?.id ?? null]
    );

    const orderId = orderResult.insertId;
    let totalAmount = 0;

    for (const item of orderItems) {
      const [products] = await connection.execute(
        `SELECT id, selling_price, quantity_available, status
         FROM products WHERE id = ? FOR UPDATE`,
        [item.product_id]
      );

      if (!products.length || products[0].status !== "active") {
        throw new Error(
          `Product ${item.product_id} does not exist or is inactive.`
        );
      }

      const product = products[0];

      if (
        Number(product.quantity_available) <
        item.quantity_boxes
      ) {
        throw new Error(
          `Insufficient stock for product ${item.product_id}. ` +
          `Available: ${product.quantity_available} boxes.`
        );
      }

      const unitPrice = Number(product.selling_price);
      const subtotal = unitPrice * item.quantity_boxes;

      await connection.execute(
        `INSERT INTO order_items
         (order_id, product_id, quantity_boxes, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          item.product_id,
          item.quantity_boxes,
          unitPrice,
          subtotal,
        ]
      );

      totalAmount += subtotal;
    }

    await connection.execute(
      `UPDATE orders
       SET total_amount = ?, stock_deducted = 0
       WHERE id = ?`,
      [totalAmount, orderId]
    );

    await connection.commit();

    res.status(201).json({
      message: "Order created successfully.",
      id: orderId,
      order_number: orderNumber,
      total_amount: totalAmount,
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Error creating order:", error.message);

    const clientError =
      error.message.startsWith("Insufficient stock") ||
      error.message.startsWith("Product ") ||
      error.message.startsWith("Stock changed");

    res.status(clientError ? 400 : 500).json({
      message: clientError
        ? error.message
        : "Failed to create order.",
    });
  } finally {
    if (connection) connection.release();
  }
});

// Update an order's vendor or notes
app.put("/api/orders/:id", async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const [orders] = await db.query(
      "SELECT id, status FROM orders WHERE id = ?",
      [orderId]
    );

    if (!orders.length) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    if (["completed", "cancelled"].includes(orders[0].status)) {
      return res.status(400).json({
        message: "Completed or cancelled orders cannot be edited.",
      });
    }

    const { vendor_id, notes } = req.body;

    if (
      notes !== undefined &&
      notes !== null &&
      (typeof notes !== "string" || notes.length > 255)
    ) {
      return res.status(400).json({
        message: "Notes must be 255 characters or fewer.",
      });
    }

    if (vendor_id !== undefined) {
      const vendorId = Number(vendor_id);

      if (!Number.isInteger(vendorId) || vendorId <= 0) {
        return res.status(400).json({
          message: "Select a valid vendor.",
        });
      }

      const [vendors] = await db.query(
        `SELECT id FROM street_vendors
         WHERE id = ? AND status = 'active'`,
        [vendorId]
      );

      if (!vendors.length) {
        return res.status(400).json({
          message: "Vendor not found or inactive.",
        });
      }

      await db.query(
        "UPDATE orders SET vendor_id = ?, notes = ? WHERE id = ?",
        [
          vendorId,
          notes === undefined ? null : notes,
          orderId,
        ]
      );
    } else if (notes !== undefined) {
      await db.query(
        "UPDATE orders SET notes = ? WHERE id = ?",
        [notes, orderId]
      );
    } else {
      return res.status(400).json({
        message: "Provide vendor_id or notes to update.",
      });
    }

    res.json({
      message: "Order updated successfully.",
      id: orderId,
    });
  } catch (error) {
    console.error("Error updating order:", error.message);
    res.status(500).json({
      message: "Failed to update order.",
    });
  }
});

// Delete an order that has not been completed
app.delete("/api/orders/:id", async (req, res) => {
  let connection;

  try {
    const orderId = Number(req.params.id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [orders] = await connection.execute(
      "SELECT * FROM orders WHERE id = ? FOR UPDATE",
      [orderId]
    );

    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    const order = orders[0];

    if (order.status === "completed") {
      await connection.rollback();
      return res.status(400).json({
        message: "Completed orders cannot be deleted.",
      });
    }

    if (Number(order.stock_deducted) === 1) {
      const [items] = await connection.execute(
        `SELECT product_id, quantity_boxes
         FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      for (const item of items) {
        await connection.execute(
          `UPDATE products
           SET quantity_available = quantity_available + ?
           WHERE id = ?`,
          [item.quantity_boxes, item.product_id]
        );
      }
    }

    await connection.execute(
      "DELETE FROM orders WHERE id = ?",
      [orderId]
    );

    await connection.commit();

    res.json({ message: "Order deleted successfully." });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Error deleting order:", error.message);
    res.status(500).json({
      message: "Failed to delete order.",
    });
  } finally {
    if (connection) connection.release();
  }
});

// Update order status and handle stock
app.patch("/api/orders/:id/status", async (req, res) => {
  let connection;

  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const [statusRows] = await db.query(
      "SELECT code FROM order_statuses"
    );

    const allowedStatuses = statusRows.map((row) => row.code);

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid order status.",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [orders] = await connection.execute(
      "SELECT * FROM orders WHERE id = ? FOR UPDATE",
      [orderId]
    );

    if (!orders.length) {
      await connection.rollback();
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    const order = orders[0];

    if (order.status === "cancelled") {
      await connection.rollback();
      return res.status(400).json({
        message: "A cancelled order cannot be changed.",
      });
    }

    if (order.status === "completed" && status !== "completed") {
      await connection.rollback();
      return res.status(400).json({
        message: "Completed orders cannot be changed.",
      });
    }

    // Deduct stock when completing an order
    if (status === "completed" && Number(order.stock_deducted) !== 1) {
      const [items] = await connection.execute(
        `SELECT product_id, quantity_boxes
         FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      for (const item of items) {
        const [products] = await connection.execute(
          `SELECT quantity_available
           FROM products WHERE id = ? FOR UPDATE`,
          [item.product_id]
        );

        if (
          !products.length ||
          Number(products[0].quantity_available) <
            Number(item.quantity_boxes)
        ) {
          await connection.rollback();
          return res.status(400).json({
            message:
              `Insufficient stock to complete this order for product ${item.product_id}.`,
          });
        }

        const [deductResult] = await connection.execute(
          `UPDATE products
           SET quantity_available = quantity_available - ?
           WHERE id = ? AND quantity_available >= ?`,
          [
            item.quantity_boxes,
            item.product_id,
            item.quantity_boxes,
          ]
        );

        if (deductResult.affectedRows !== 1) {
          throw new Error(
            `Stock changed while completing product ${item.product_id}.`
          );
        }
      }

      await connection.execute(
        "UPDATE orders SET stock_deducted = 1 WHERE id = ?",
        [orderId]
      );
    }

    // Restore stock if a deducted order is cancelled
    if (status === "cancelled" && Number(order.stock_deducted) === 1) {
      const [items] = await connection.execute(
        `SELECT product_id, quantity_boxes
         FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      for (const item of items) {
        await connection.execute(
          `UPDATE products
           SET quantity_available = quantity_available + ?
           WHERE id = ?`,
          [item.quantity_boxes, item.product_id]
        );
      }

      await connection.execute(
        "UPDATE orders SET stock_deducted = 0 WHERE id = ?",
        [orderId]
      );
    }

    await connection.execute(
      "UPDATE orders SET status = ? WHERE id = ?",
      [status, orderId]
    );

    await connection.commit();

    res.json({
      message: "Order status updated successfully.",
      id: orderId,
      status,
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Error updating order status:", error.message);
    res.status(500).json({
      message: "Failed to update order status.",
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==================================================
// PURCHASE MANAGEMENT
// ==================================================

// Get all purchases
app.get("/api/purchases", async (req, res) => {
  try {
    const [purchases] = await db.query(`
      SELECT
        pu.id,
        pu.supplier_id,
        s.supplier_name,
        pr.id AS product_id,
        f.fruit_name AS fruit,
        b.size_name AS box_size,
        pu.quantity_boxes,
        pu.unit_cost,
        pu.total_cost,
        pu.purchase_date,
        pu.notes,
        pu.created_at
      FROM purchases pu
      JOIN suppliers s ON pu.supplier_id = s.id
      JOIN products pr ON pu.product_id = pr.id
      JOIN fruits f ON pr.fruit_id = f.id
      JOIN box_sizes b ON pr.box_size_id = b.id
      ORDER BY pu.id DESC
    `);
    res.json(purchases);
  } catch (error) {
    console.error("Error fetching purchases:", error.message);
    res.status(500).json({
      message: "Failed to fetch purchases.",
    });
  }
});

// Record a purchase and increase stock
app.post("/api/purchases", requireRole("administrator"), async (req, res) => {
  let connection;

  try {
    const supplierId = Number(req.body.supplier_id);
    const productId = Number(req.body.product_id);
    const quantity = Number(req.body.quantity_boxes);
    const unitCost = Number(req.body.unit_cost);
    const purchaseDate = req.body.purchase_date;
    const notes = req.body.notes ?? null;

    if (
      !Number.isInteger(supplierId) ||
      supplierId <= 0 ||
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitCost) ||
      unitCost < 0
    ) {
      return res.status(400).json({
        message:
          "Enter a valid supplier, product, positive box quantity, and non-negative unit cost.",
      });
    }

    if (
      !purchaseDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ||
      Number.isNaN(Date.parse(purchaseDate))
    ) {
      return res.status(400).json({
        message: "Enter a valid purchase date in YYYY-MM-DD format.",
      });
    }

    if (
      notes !== null &&
      (typeof notes !== "string" || notes.length > 255)
    ) {
      return res.status(400).json({
        message: "Notes must be 255 characters or fewer.",
      });
    }

    const totalCost = Number((quantity * unitCost).toFixed(2));

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [suppliers] = await connection.execute(
      "SELECT id FROM suppliers WHERE id = ?",
      [supplierId]
    );

    if (!suppliers.length) {
      await connection.rollback();
      return res.status(400).json({
        message: "Selected supplier does not exist.",
      });
    }

    const [products] = await connection.execute(
      `SELECT id, status FROM products
       WHERE id = ? FOR UPDATE`,
      [productId]
    );

    if (!products.length || products[0].status !== "active") {
      await connection.rollback();
      return res.status(400).json({
        message: "Selected product does not exist or is inactive.",
      });
    }

    const [purchaseResult] = await connection.execute(
      `INSERT INTO purchases
       (supplier_id, product_id, quantity_boxes, unit_cost,
        total_cost, purchase_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        supplierId,
        productId,
        quantity,
        unitCost,
        totalCost,
        purchaseDate,
        notes,
      ]
    );

    await connection.execute(
      `UPDATE products
       SET quantity_available = quantity_available + ?
       WHERE id = ?`,
      [quantity, productId]
    );

    await connection.commit();

    res.status(201).json({
      message: "Purchase recorded and stock updated successfully.",
      id: purchaseResult.insertId,
      total_cost: totalCost,
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("Error recording purchase:", error.message);
    res.status(500).json({
      message: "Failed to record purchase.",
    });
  } finally {
    if (connection) connection.release();
  }
});

// ==================================================
// STOCK MANAGEMENT
// ==================================================

// Get available stock
app.get("/api/stock", async (req, res) => {
  try {
    const [stock] = await db.query(`
      SELECT
        p.id AS product_id,
        f.fruit_name AS fruit,
        b.size_name AS box_size,
        p.quantity_per_box,
        p.selling_price,
        p.quantity_available,
        p.status
      FROM products p
      JOIN fruits f ON p.fruit_id = f.id
      JOIN box_sizes b ON p.box_size_id = b.id
      ORDER BY f.fruit_name, b.size_name
    `);
    res.json(stock);
  } catch (error) {
    console.error("Error fetching stock:", error.message);
    res.status(500).json({
      message: "Failed to fetch stock.",
    });
  }
});

// Update available stock quantity
app.put("/api/stock/:id", requireRole("administrator"), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const quantity = Number(req.body.quantity_available);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({
        message: "Quantity must be a non-negative whole number.",
      });
    }

    const [result] = await db.execute(
      `UPDATE products SET quantity_available = ?
       WHERE id = ?`,
      [quantity, productId]
    );

    if (!result.affectedRows) {
      const [rows] = await db.execute(
        "SELECT id FROM products WHERE id = ?",
        [productId]
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Product not found.",
        });
      }
    }

    res.json({ message: "Stock updated successfully." });
  } catch (error) {
    console.error("Error updating stock:", error.message);
    res.status(500).json({
      message: "Failed to update stock.",
    });
  }
});

// Add boxes to available stock
app.post("/api/stock", requireRole("administrator"), async (req, res) => {
  try {
    const productId = Number(req.body.product_id);
    const quantity = Number(req.body.quantity_boxes);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        message: "Valid product ID is required.",
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "Quantity must be a positive whole number.",
      });
    }

    const [result] = await db.execute(
      `UPDATE products
       SET quantity_available = quantity_available + ?
       WHERE id = ?`,
      [quantity, productId]
    );

    if (!result.affectedRows) {
      const [rows] = await db.execute(
        "SELECT id FROM products WHERE id = ?",
        [productId]
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Product not found.",
        });
      }
    }

    res.json({ message: "Stock increased successfully." });
  } catch (error) {
    console.error("Error adding stock:", error.message);
    res.status(500).json({
      message: "Failed to add stock.",
    });
  }
});

// ==================================================
// DASHBOARD
// ==================================================

app.get("/api/dashboard", async (req, res) => {
  try {
    const [fruitRows] = await db.query(
      "SELECT COUNT(*) AS total FROM fruits"
    );

    const [supplierRows] = await db.query(
      "SELECT COUNT(*) AS total FROM suppliers"
    );

    const [vendorRows] = await db.query(
      "SELECT COUNT(*) AS total FROM street_vendors"
    );

    const [stockRows] = await db.query(`
      SELECT COALESCE(SUM(quantity_available), 0) AS total
      FROM products
    `);

    const [orderRows] = await db.query(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(status = 'pending'), 0) AS pending_orders,
        COALESCE(SUM(status = 'completed'), 0) AS completed_orders,
        COALESCE(
          SUM(
            CASE
              WHEN status = 'completed' THEN total_amount
              ELSE 0
            END
          ),
          0
        ) AS sales_value
      FROM orders
    `);

    res.json({
      totalFruits: Number(fruitRows[0].total),
      totalSuppliers: Number(supplierRows[0].total),
      registeredVendors: Number(vendorRows[0].total),
      availableStock: Number(stockRows[0].total),
      totalOrders: Number(orderRows[0].total_orders),
      pendingOrders: Number(orderRows[0].pending_orders),
      completedOrders: Number(orderRows[0].completed_orders),
      salesValue: Number(orderRows[0].sales_value),
    });
  } catch (error) {
    console.error("Dashboard error:", error.message);
    res.status(500).json({
      message: "Could not load dashboard statistics.",
    });
  }
});

// ==================================================
// SERVE THE BUILT FRONTEND (production)
// ==================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }

    res.sendFile(path.join(distDir, "index.html"));
  });
}

// ==================================================
// START SERVER - KEEP THIS AT THE VERY BOTTOM
// ==================================================

await ensureDatabaseReady();

app.listen(PORT, () => {
  console.log(
    `Batloung Fruits server running at http://localhost:${PORT}`
  );
});
