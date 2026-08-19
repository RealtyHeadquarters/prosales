# ProSales Tracking App

Field-sales team tracking system — attendance, live GPS tracking, CRM, client visits with geo-tagged photos.

## Components

| Folder        | What it is                          | Stack                        | Status        |
|---------------|-------------------------------------|------------------------------|---------------|
| `backend/`    | REST API + database                 | Node.js, Express, PostgreSQL | ✅ Done        |
| `mobile/`     | Sales team's phone app              | Flutter (Android + iOS)      | ✅ Done        |
| `web-admin/`  | Manager CRM dashboard (live map)    | React + Vite + Leaflet       | ✅ Done        |

## Features

- **Login time / attendance** — daily check-in & check-out with GPS location.
- **Live tracking** — periodic location pings; managers see the team on a live map.
- **CRM** — clients/leads with status, assigned rep, contact info.
- **Client visits** — log meetings with purpose, notes (meeting detail), outcome, follow-up date.
- **Photo upload** — geo-tagged photos attached to each visit.
- **Roles** — `admin`, `manager`, `sales` with scoped access.

## Quick start (backend)

See [`backend/README.md`](backend/README.md). In short:

```bash
cd backend
npm install
cp .env.example .env        # then set DATABASE_URL
npm run migrate             # create tables
npm run seed                # create the first admin (admin@prosales.com / Admin@123)
npm run dev                 # start API on http://localhost:4000
```

## Roadmap

- [x] **Phase 1** — Backend API + PostgreSQL schema (+ Field Force extensions: geofencing, tasks, territories, reports)
- [x] **Phase 2** — Flutter mobile app (attendance, foreground live tracking + offline queue, visits, photos, tasks)
- [x] **Phase 3** — React admin dashboard (live map, attendance, reports, clients, territories, team)
- [ ] **Phase 4** — Advanced integrations (route optimization, OCR, WhatsApp/SMS, payout automation)
