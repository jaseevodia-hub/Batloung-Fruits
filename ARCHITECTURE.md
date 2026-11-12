# Architecture

The Batloung Fruits Distribution Management System is a three-tier web application: a React single-page app, an Express REST API, and a MySQL database.

## System diagram

```mermaid
flowchart TD
    subgraph Client["Browser (React + Vite SPA)"]
        UI["Pages: Dashboard, Fruits, Suppliers,<br/>Vendors, Stock, Orders, Reports, Login"]
        API_CLIENT["api.js<br/>apiFetch · getToken · isAdmin · logout"]
        STORE["localStorage<br/>JWT token + user"]
        UI --> API_CLIENT
        API_CLIENT --> STORE
    end

    subgraph Server["Express API (port 5001)"]
        AUTH["/api/auth<br/>login · register"]
        MW["middleware.js<br/>authenticate · requireRole"]
        ROUTES["Business routes<br/>fruits · products · suppliers · vendors<br/>stock · purchases · orders · reports"]
        AUTH --> MW
        ROUTES --> MW
    end

    subgraph Data["MySQL"]
        DB[("batloung_fruits<br/>users · fruits · products · suppliers<br/>street_vendors · orders · order_items<br/>purchases · provinces · box_sizes")]
    end

    API_CLIENT -->|"HTTP JSON + Bearer token"| AUTH
    API_CLIENT -->|"HTTP JSON + Bearer token"| ROUTES
    MW --> ROUTES
    ROUTES -->|"mysql2 pool"| DB
    AUTH -->|"mysql2 pool"| DB
```

## Layers

### 1. Frontend (React + Vite)

- Entry point `src/main.jsx` renders `src/App.jsx`, which defines the routes with `react-router-dom`.
- `src/api.js` centralizes all HTTP calls. `apiFetch` attaches the `Authorization: Bearer <token>` header, and on a `401` it clears the session with `logout()`.
- `RequireAuth` in `src/App.jsx` wraps protected routes; unauthenticated users are redirected to `/login`.
- `isAdmin()` gates administrator-only controls in the UI. The server enforces the same rules, so hiding a button is convenience, not security.
- State is local component state via `useState`/`useEffect`; there is no global state library.

### 2. Backend (Express + mysql2)

- `server/server.js` creates the Express app, enables CORS and JSON parsing, and mounts the routers.
- `server/auth.js` handles `/api/auth/login` (bcrypt compare + JWT issue) and `/api/auth/register` (administrator only).
- `server/middleware.js`:
  - `authenticate` verifies the JWT and sets `req.user`.
  - `requireRole(...roles)` restricts an endpoint to specific roles.
- Public routes: `GET /api/health` and `/api/auth/*`. All other `/api` routes pass through `authenticate`.
- Order creation and completion use database transactions so stock changes and order rows stay consistent. Completing an order deducts stock; cancelling restores it.
- `/api/orders` inserts `created_by` from the logged-in user for auditing.

### 3. Database (MySQL)

- Schema and constraints live in `server/database.sql` (source of truth).
- Reference/lookup data (provinces, box sizes) is in `server/initial_reference_data.sql` using `INSERT IGNORE`.
- See `ERD.md` for the entity-relationship diagram and the relationship overview.

## Request lifecycle (example: creating an order)

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant C as apiFetch (React)
    participant E as Express (server.js)
    participant M as middleware.js
    participant D as MySQL

    U->>C: Submit order form
    C->>E: POST /api/orders + Bearer token
    E->>M: authenticate
    M->>M: verify JWT, set req.user
    M-->>E: next()
    E->>D: BEGIN transaction
    E->>D: validate vendor + products (FOR UPDATE)
    E->>D: INSERT orders (created_by = req.user.id)
    E->>D: INSERT order_items
    E->>D: COMMIT
    E-->>C: 201 JSON (order)
    C-->>U: Show success, refresh list
```

## Security

- Passwords are hashed with bcrypt; plain passwords are never stored.
- Sessions use signed JWTs with a 24-hour expiry, signed with `JWT_SECRET` from `.env`.
- Secrets (`DB_PASSWORD`, `JWT_SECRET`) stay in `.env`, which is excluded from version control via `.gitignore`. `.env.example` documents the variables.
- Role checks are enforced server-side with `requireRole`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DB_HOST` | MySQL host (default `localhost`) |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (`batloung_fruits`) |
| `PORT` | API port (default `5001`) |
| `JWT_SECRET` | Secret used to sign and verify login tokens |
