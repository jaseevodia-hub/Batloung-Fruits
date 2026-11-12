# Batloung Fruits Distribution Management System

A full-stack React + Express + MySQL application. Forms submit data to the Express API, and the API writes business records to MySQL. The frontend fetches saved records back from the API; JSON is only used to send data between the frontend and backend.

## Forms and database-backed modules

- **Fruit Management:** create/edit/delete fruit types and product listings (fruit, box size, quantity per box, selling price, stock, and status).
- **Supplier Management:** save supplier name, province, contact person, telephone, email, and physical address.
- **Street Vendor Management:** save vendor, business, telephone, area, registration date, and status.
- **Stock Management:** update stock and record purchases with supplier, product, quantity, cost, date, and notes. The purchase form stores a purchase record and increases available stock. Saving a purchase adds a row to `purchases` and increases product stock in a database transaction.
- **Orders:** create orders for vendors with one or more products and quantities; view details and update order status.
- **Reports and Dashboard:** display totals derived from database records, including stock and purchase reports with a period filter.
- **User Management (administrator):** create, edit, and delete user accounts; set roles and active status, and reset passwords.

## Requirements

- Node.js and npm
- MySQL Server 8 or compatible

## Setup

1. Open the project folder in PowerShell or VS Code.
2. Create a database named `batloung_fruits` in MySQL. For a fresh database, import `server/database.sql`, then import `server/initial_reference_data.sql` to add the province and box-size dropdown options. **Do not import `server/database.sql` over a database with records you need to keep without taking a backup first.** If you are using an existing database, run only `server/initial_reference_data.sql` if provinces or box sizes are missing; it uses `INSERT IGNORE` to preserve existing rows.
3. Copy `.env.example` to `.env`. On Windows PowerShell, run `Copy-Item .env.example .env`, then edit `.env` and enter the MySQL password plus a long random `JWT_SECRET`. Never share or upload the real `.env` file.
4. Install packages: `npm install`.
5. Seed the login accounts (creates the `users` table if needed): `npm run seed:users`.
6. Start the backend in Terminal 1: `npm run server`. It should report a successful MySQL connection and listen on port 5001.
7. Start the frontend in Terminal 2: `npm run dev`. Open the local URL Vite prints (for example `http://localhost:5173/`; the port may change if busy).

## Authentication and roles

The app requires a login before any page or API call works. Passwords are hashed with bcrypt, and the API issues a JWT that the frontend stores and sends as a `Bearer` token on every request. On the login screen (and when setting a password) you can tick **Show password** to reveal what you have typed.

Two roles exist:

- **administrator** — full access, including creating/editing/deleting records and updating stock, purchases, and users.
- **sales** — read-only access to dashboards, reports, orders, stock, and catalog data; cannot perform administrator-only writes.

Seeded accounts (change the passwords after first login in a real deployment):

| Role | Email | Password |
| --- | --- | --- |
| administrator | `tholoanajase20@gmail.com` | `INNOCENT1234567890` |
| sales | `sales@batloung.com` | `Sales@123` |

Public endpoints: `GET /api/health` and the `/api/auth/*` routes (login/register). Every other `/api` route requires a valid JWT. Secrets and tokens live in `.env` and in the browser's local storage respectively; never commit the real `.env`.

## Verify the API

- Health check: `http://localhost:5001/api/health` (public)
- Fruit types: `http://localhost:5001/api/fruits`
- Products: `http://localhost:5001/api/products`
- Suppliers: `http://localhost:5001/api/suppliers`
- Vendors: `http://localhost:5001/api/vendors`
- Stock: `http://localhost:5001/api/stock`
- Purchases: `http://localhost:5001/api/purchases`
- Orders: `http://localhost:5001/api/orders`

Every endpoint except `/api/health` and `/api/auth/*` requires an `Authorization: Bearer <token>` header, obtained from `POST /api/auth/login`. Opening those URLs directly in a browser will return `401` until you log in through the app.

To verify a form submission, save an entry in the website and refresh the relevant API endpoint. The returned record should appear there. You can also query the corresponding MySQL table directly.

## Testing

- Automated smoke test: with the backend running, run `npm test`. It logs in as the seeded admin/sales users and checks that health, login, protected endpoints, and authentication rules behave correctly.
- Manual test plan: see `TESTING.md` for the full checklist of forms, validation, reports, and role-based access to verify.
- Lint the frontend: `npm run lint`.

## Order stock rule

Creating an order does not deduct stock. When an order is changed to `completed`, the server checks stock and deducts ordered quantities in a transaction. If stock is insufficient, completion is rejected. Cancelling an order that already deducted stock restores the quantities.

## Build

Run `npm run build` to build the frontend for production.
