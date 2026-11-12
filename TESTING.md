# Testing the Batloung Fruits Distribution Management System

This document describes how to test the application: automated checks first, then a manual test plan covering forms, validation, reports, and role-based access.

## Automated smoke test

The smoke test verifies the API is running, that authentication is enforced, and that the main data endpoints respond.

### Prerequisites

1. MySQL is running with the `batloung_fruits` database set up (see `README.md`).
2. The seeded users exist: run `npm run seed:users` if you have not already.
3. The backend is running: `npm run server`.

### Run it

```powershell
npm test
```

### What it checks

- `GET /api/health` returns `200`.
- A protected endpoint (`GET /api/products`) returns `401` without a token.
- Logging in with a wrong password returns `401`.
- The seeded admin and sales users both log in and receive a token.
- With a valid token, `/api/products`, `/api/fruits`, `/api/suppliers`, `/api/vendors`, `/api/stock`, `/api/purchases`, and `/api/orders` all return `200`.
- An invalid token returns `401`.

The script prints `PASS`/`FAIL` for each check and exits with a non-zero code if anything fails, so it can be used in CI.

## Manual test plan

Perform these in the browser with both a fresh admin login and a sales login. Use the seeded accounts unless you have created your own.

### 1. Authentication

| # | Steps | Expected |
| --- | --- | --- |
| 1.1 | Open the app while logged out. | You are redirected to `/login`. |
| 1.2 | Enter a wrong password. | An error message is shown; you stay on the login page. |
| 1.3 | Type a password, then tick **Show password**. | The password becomes readable; unticking hides it again. |
| 1.4 | Log in with the admin account. | You reach the dashboard; the sidebar shows the user and a Logout button. |
| 1.5 | Reload the page. | You stay logged in (token persisted). |
| 1.6 | Click Logout. | You are returned to `/login` and protected routes are blocked. |

### 2. Fruit and product management (administrator)

| # | Steps | Expected |
| --- | --- | --- |
| 2.1 | Create a new fruit type. | It appears in the list and via `GET /api/fruits`. |
| 2.2 | Create a product with a box size, quantity per box, selling price, and status. | It appears in the list and in Stock. |
| 2.3 | Edit a fruit or product and save. | The updated values persist after reload. |
| 2.4 | Delete a fruit or product. | It disappears; related rows behave as designed. |
| 2.5 | Submit an empty required field. | Validation blocks the save with a message. |

### 3. Supplier management

| # | Steps | Expected |
| --- | --- | --- |
| 3.1 | Create a supplier with name, province, contact, telephone, email, address. | Saved and listed. |
| 3.2 | Submit an invalid email. | Validation blocks the save. |
| 3.3 | Edit and delete a supplier. | Changes persist / record removed. |

### 4. Street vendor management

| # | Steps | Expected |
| --- | --- | --- |
| 4.1 | Create a vendor with business name, telephone, area, registration date, status. | Saved and listed. |
| 4.2 | Edit and delete a vendor. | Changes persist / record removed. |
| 4.3 | Inactive vendors. | Cannot be used when creating an order (server rejects). |

### 5. Stock and purchases (administrator)

| # | Steps | Expected |
| --- | --- | --- |
| 5.1 | Record a purchase (supplier, product, boxes, unit cost, date). | A purchase row is created and product stock increases. |
| 5.2 | Check the total purchase cost preview before saving. | It equals boxes × unit cost. |
| 5.3 | Update available stock directly. | Saved stock matches the value you entered. |
| 5.4 | Use the stock search box. | The table filters by fruit, box size, or status. |

### 6. Orders

| # | Steps | Expected |
| --- | --- | --- |
| 6.1 | Create an order for an active vendor with one or more products. | Order is created with status `pending`; stock is not deducted yet. |
| 6.2 | Set an order to `completed`. | Server deducts ordered quantities if stock is sufficient. |
| 6.3 | Try to complete an order that needs more stock than available. | Completion is rejected with a message; stock unchanged. |
| 6.4 | Cancel an order that already deducted stock. | Quantities are restored. |

### 7. Reports

| # | Steps | Expected |
| --- | --- | --- |
| 7.1 | Change the period filter. | Order, sales, and purchase tables update to the selected period. |
| 7.2 | View the Stock Report. | Shows each product's available boxes and stock value plus a total. |
| 7.3 | View the Purchases Report. | Shows purchases in the period and total spend. |

### 8. Role-based access

| # | Steps | Expected |
| --- | --- | --- |
| 8.1 | Log in as `sales`. | You can view dashboards, reports, orders, stock, and catalogs. |
| 8.2 | As `sales`, attempt an administrator-only action (create/edit/delete, update stock). | The controls are hidden and the API returns `403` if called directly. |
| 8.3 | Call a protected endpoint with no token. | API returns `401`. |
| 8.4 | As `sales`, try to open `/users` directly or look for the Users menu link. | The link is hidden and the route redirects to the dashboard. |

### 9. User management (administrator)

| # | Steps | Expected |
| --- | --- | --- |
| 9.1 | Open **Users** from the sidebar. | The list of accounts is shown. |
| 9.2 | Create a user with a password (tick **Show password** to check it). | The account appears and can log in. |
| 9.3 | Edit a user: change role to administrator and toggle active off. | Changes persist. |
| 9.4 | Leave the password blank when editing. | The existing password is kept. |
| 9.5 | Try to delete your own account. | The button is disabled; the API rejects it with a message. |
| 9.6 | Delete another user. | The account is removed. |
| 9.7 | Use the search box on the Users page. | The table filters by name, email, or role. |

## Known limitations

- The smoke test assumes the default seeded credentials; change `ADMIN`/`SALES` in `server/smoke_test.js` or set `API_BASE` if your setup differs.
- Tests require a running backend and MySQL; they are not isolated unit tests.
