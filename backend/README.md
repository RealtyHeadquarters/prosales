# ProSales Backend

Node.js + Express + PostgreSQL REST API.

## 1. Install

```bash
cd backend
npm install
```

## 2. Get a PostgreSQL database

Pick **one**:

**Option A — Local (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb prosales
# DATABASE_URL=postgresql://<your-mac-username>@localhost:5432/prosales
```

**Option B — Free cloud (Neon, no install):**
1. Sign up at https://neon.tech and create a project.
2. Copy the connection string (looks like `postgresql://...@ep-xxx.neon.tech/prosales?sslmode=require`).

## 3. Configure

```bash
cp .env.example .env
```
Edit `.env` and set `DATABASE_URL` (and a real `JWT_SECRET`).

## 4. Create tables + first admin

```bash
npm run migrate
npm run seed     # creates admin@prosales.com / Admin@123
```

## 5. Run

```bash
npm run dev      # auto-reload
# or: npm start
```

Server: http://localhost:4000 — health check at `/health`.

---

## API overview

All `/api/*` routes (except register/login) need an `Authorization: Bearer <token>` header.

### Auth
| Method | Path                | Who            | Body / notes |
|--------|---------------------|----------------|--------------|
| POST   | `/api/auth/register`| first user = admin (no auth); after that admin/manager | `{name,email,phone,password,role,manager_id}` |
| POST   | `/api/auth/login`   | anyone         | `{email,password}` → `{token,user}` |
| GET    | `/api/auth/me`      | logged in      | current profile |

### Users
| Method | Path                     | Who            |
|--------|--------------------------|----------------|
| GET    | `/api/users`             | admin/manager  |
| PATCH  | `/api/users/:id/active`  | admin          |

### Attendance (login time)
| Method | Path                       | Who           | Body |
|--------|----------------------------|---------------|------|
| POST   | `/api/attendance/check-in` | logged in     | `{lat,lng}` |
| POST   | `/api/attendance/check-out`| logged in     | `{lat,lng}` |
| GET    | `/api/attendance/me`       | logged in     | my history |
| GET    | `/api/attendance`          | admin/manager | `?date=&user_id=` |

### Live location
| Method | Path                        | Who           | Body / notes |
|--------|-----------------------------|---------------|--------------|
| POST   | `/api/location`             | logged in     | `{lat,lng,accuracy,speed,battery}` |
| POST   | `/api/location/batch`       | logged in     | `{pings:[...]}` (offline sync) |
| GET    | `/api/location/live`        | admin/manager | latest position per rep |
| GET    | `/api/location/track/:userId`| self or admin/manager | `?from=&to=` trail |

### Clients (CRM)
| Method | Path              | Who                    |
|--------|-------------------|------------------------|
| GET    | `/api/clients`    | sales=own, admin/mgr=all |
| POST   | `/api/clients`    | logged in              |
| GET    | `/api/clients/:id`| logged in              |
| PATCH  | `/api/clients/:id`| logged in              |
| DELETE | `/api/clients/:id`| admin/manager          |

### Visits + photos
| Method | Path                      | Who        | Notes |
|--------|---------------------------|------------|-------|
| POST   | `/api/visits`             | logged in  | `{client_id,purpose,notes,outcome,lat,lng,next_follow_up}` |
| GET    | `/api/visits`             | logged in  | `?client_id=&user_id=` |
| GET    | `/api/visits/:id`         | logged in  | includes photos |
| POST   | `/api/visits/:id/photos`  | logged in  | multipart, field `photos` (+ optional `lat`,`lng`) |

**Geo-fencing (fake-visit prevention):** when `geofence_enforce` is on, logging a `completed` visit for a client that has coordinates requires the rep's `lat,lng` and that they be within the allowed radius (per-client `geofence_radius_m`, else the global default). Otherwise the API returns **422** with `code: LOCATION_REQUIRED` or `OUTSIDE_GEOFENCE`. Every visit stores `distance_m` + `within_geofence` for audit.

### Tasks / Day-plan / Follow-ups
| Method | Path                    | Notes |
|--------|-------------------------|-------|
| POST   | `/api/tasks`            | `{title,type,client_id,priority,plan_date,due_date}` (admin/mgr can set `user_id`) |
| GET    | `/api/tasks`            | `?status=&type=&plan_date=&user_id=` (reps see own) |
| GET    | `/api/tasks/agenda`     | `?date=YYYY-MM-DD` → that day's tasks + planned meetings |
| GET    | `/api/tasks/reminders`  | my pending tasks due today/overdue |
| PATCH  | `/api/tasks/:id`        | update; `status:'done'` stamps `completed_at` |
| DELETE | `/api/tasks/:id`        | |

> A visit with `next_follow_up` **auto-creates** a follow-up task for the rep.

### Territories + lead assignment
| Method | Path                              | Who           | Notes |
|--------|-----------------------------------|---------------|-------|
| GET    | `/api/territories`                | logged in     | with member/client counts |
| POST   | `/api/territories`                | admin/manager | `{name,center_lat,center_lng,radius_m}` |
| GET/PATCH/DELETE | `/api/territories/:id`  | admin/manager | |
| POST   | `/api/territories/:id/members`    | admin/manager | `{user_id}` |
| DELETE | `/api/territories/:id/members/:userId` | admin/manager | |
| POST   | `/api/clients/auto-assign`        | admin/manager | assign all unassigned leads |
| POST   | `/api/users/:id/reassign-clients` | admin         | `{to_user_id, deactivate?}` when a rep leaves |

> New leads created by admin/manager without `assigned_to` are **auto-assigned** by territory (nearest covering territory) + load balance (rep with fewest clients).

### Reports
| Method | Path                    | Who           | Notes |
|--------|-------------------------|---------------|-------|
| GET    | `/api/reports/summary`  | self / admin/mgr | `?user_id=&from=&to=` (default last 30 days) |
| GET    | `/api/reports/team`     | admin/manager | per-rep: distance, working hours, meetings done/planned, tasks, clients |

### Settings
| Method | Path             | Who       | Notes |
|--------|------------------|-----------|-------|
| GET    | `/api/settings`  | logged in | `{geofence_enforce, default_geofence_radius_m}` |
| PATCH  | `/api/settings`  | admin     | toggle geofencing / change default radius |
