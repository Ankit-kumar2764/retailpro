# RetailPro Inventory Management System

RetailPro is a React/Vite and Node.js/Express retail inventory system backed by MySQL. It includes authentication, products, warehouses, inventory, suppliers, purchase orders, customer orders, fulfillment, and live dashboard analytics.

## Stack

- React 18, Vite, React Router, Recharts
- Node.js, Express, MySQL2
- MySQL 8
- JWT and bcryptjs authentication
- Docker Compose and Jenkins pipeline definitions

## Local setup

```powershell
cd D:\Retail
Copy-Item .\backend\.env.example .\backend\.env
# Edit backend\.env with a real DB password, JWT_SECRET, and registration key.

Get-Content .\backend\database.sql | mysql -u root -p
npm ci
npm ci --prefix backend
```

Run the API:

```powershell
npm run backend:dev
```

Run the frontend in another terminal:

```powershell
npm run dev
```

Open `http://localhost:5173/login`. The API health endpoint is `http://localhost:5000/api/health`.

## Environment

Use [backend/.env.example](./backend/.env.example). Never commit `.env` files, passwords, JWT secrets, or registration keys.

## Modules

- `/products`: product catalog
- `/inventory`: warehouse stock and adjustments
- `/warehouses`: warehouse management
- `/suppliers`: supplier CRUD and safe deactivation
- `/purchase-orders`: purchasing and transactional receiving
- `/orders`: customer order CRUD and status workflow
- `/fulfillment`: processing, shipping, and delivery
- `/`: live dashboard summary and analytics
- `/reports`: reserved dashboard workspace
- `/settings`: profile, password, admin users/roles, system preferences, and secure logout

## API groups

All operational and dashboard APIs require a JWT except login/register and health:

```text
/api/auth
/api/products
/api/inventory
/api/warehouses
/api/suppliers
/api/purchase-orders
/api/customers
/api/orders
/api/fulfillment
/api/dashboard
/api/settings
```

Settings endpoints include `/profile`, `/password`, `/users`, `/roles`, and `/system` under `/api/settings`. User and role administration requires the Admin role; system updates are Admin-only.

## Docker

Create a local `.env` in the project root (not committed):

```dotenv
MYSQL_ROOT_PASSWORD=change_this_locally
JWT_SECRET=use_a_long_random_value
ADMIN_REGISTRATION_KEY=change_this_locally
```

Then run:

```powershell
docker compose up --build
```

Frontend: `http://localhost:5173`; API: `http://localhost:5000/api/health`.

The MySQL data is stored in the `mysql_data` named volume. Do not run destructive volume commands against production data.

## Testing

```powershell
npm run build
node --check backend/server.js
npm run backend:health
```

For authenticated API testing, login first:

```text
POST /api/auth/login
Authorization: Bearer <token>
```

Use the returned token to test CRUD, status transitions, inventory changes, and dashboard aggregations in Postman.

To insert repeatable non-destructive sample data without changing existing users:

```powershell
npm --prefix backend run seed:sample
```

The seed uses `RP-SAMPLE-*` identifiers, preserves existing records, and can be run again safely.

## CI/CD

[Jenkinsfile](./Jenkinsfile) installs dependencies, builds the frontend, checks backend syntax, and runs the API health smoke test. AWS deployment is intentionally not configured or executed.
