# ProSales Web Admin (Manager Dashboard)

React + Vite dashboard for managers/admins. Free OpenStreetMap (Leaflet) for the live map, Recharts for reports.

## Run

1. **Start the backend** (see `../backend/README.md`) so the API is up on `http://localhost:4000`.
2. Start the dashboard:
   ```bash
   cd web-admin
   npm install     # first time only
   npm run dev
   ```
3. Open the printed URL (usually http://localhost:5173) and log in with a **manager/admin** account (seeded admin: `admin@prosales.com` / `Admin@123`).

To point at a different backend, set `VITE_API_URL` (e.g. create `.env` with `VITE_API_URL=http://localhost:4000/api`).

## Pages

| Page | Data source |
|------|-------------|
| 🗺️ Live Map (auto-refresh 15s) | `GET /api/location/live` |
| 🕘 Attendance (by date) | `GET /api/attendance` |
| 📊 Reports (chart + table) | `GET /api/reports/team` |
| 👥 Clients (+ add, auto-assign) | `/api/clients` |
| 📍 Territories (+ create) | `/api/territories` |
| 🧑‍💼 Team (+ add member) | `/api/users`, `/api/auth/register` |

## Build

```bash
npm run build   # outputs static site to dist/
```
