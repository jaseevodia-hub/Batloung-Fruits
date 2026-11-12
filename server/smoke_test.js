import dotenv from "dotenv";

dotenv.config();

const BASE = process.env.API_BASE || "http://localhost:5001/api";

const ADMIN = {
  email: "tholoanajase20@gmail.com",
  password: "INNOCENT1234567890",
};

const SALES = {
  email: "sales@batloung.com",
  password: "Sales@123",
};

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function request(path, options = {}) {
  try {
    const response = await fetch(`${BASE}${path}`, options);
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } catch (error) {
    return { status: 0, body: null, error: error.message };
  }
}

async function login(credentials) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
}

async function main() {
  console.log(`Running smoke tests against ${BASE}\n`);

  const health = await request("/health");
  check(
    "GET /health returns 200",
    health.status === 200,
    health.error || `status ${health.status}`
  );

  const noToken = await request("/products");
  check(
    "GET /products without token returns 401",
    noToken.status === 401,
    `status ${noToken.status}`
  );

  const badLogin = await login({ email: ADMIN.email, password: "wrong-password" });
  check(
    "login with wrong password returns 401",
    badLogin.status === 401,
    `status ${badLogin.status}`
  );

  const adminLogin = await login(ADMIN);
  check(
    "admin login returns 200 and a token",
    adminLogin.status === 200 && Boolean(adminLogin.body?.token),
    `status ${adminLogin.status}`
  );

  const salesLogin = await login(SALES);
  check(
    "sales login returns 200 and a token",
    salesLogin.status === 200 && Boolean(salesLogin.body?.token),
    `status ${salesLogin.status}`
  );

  const token = adminLogin.body?.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  for (const path of [
    "/products",
    "/fruits",
    "/suppliers",
    "/vendors",
    "/stock",
    "/purchases",
    "/orders",
  ]) {
    const result = await request(path, { headers: authHeaders });
    check(
      `GET ${path} with token returns 200`,
      result.status === 200,
      `status ${result.status}`
    );
  }

  const invalidToken = await request("/products", {
    headers: { Authorization: "Bearer not-a-real-token" },
  });
  check(
    "GET /products with an invalid token returns 401",
    invalidToken.status === 401,
    `status ${invalidToken.status}`
  );

  console.log(`\n${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
