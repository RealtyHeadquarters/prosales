# ProSales Mobile (Flutter)

Sales team's field app — login, attendance (GPS check-in/out), client visits with geo-fencing + photo upload, tasks/day-plan.

## Run

1. **Start the backend first** (see `../backend/README.md`) so the API is reachable:
   ```bash
   cd ../backend && PORT=4000 npm run dev
   ```
2. Point the app at the backend. Edit `lib/config/api_config.dart`:
   - **Android emulator** → already works (`http://10.0.2.2:4000`).
   - **iOS simulator** → already works (`http://localhost:4000`).
   - **Real phone** → set `_lanHost` to your computer's Wi-Fi IP, e.g. `http://192.168.1.5:4000` (phone + computer on same Wi-Fi).
3. Run:
   ```bash
   flutter run
   ```

## Login

Use a user created in the backend. Seeded admin: `admin@prosales.com` / `Admin@123`.
For a real field rep, create a `sales` user via the backend (admin → `POST /api/auth/register`).

## What's inside

| Area | File(s) |
|------|---------|
| API client (JWT, multipart) | `lib/services/api_client.dart` |
| Location (GPS) | `lib/services/location_service.dart` |
| Auth/session | `lib/state/auth_state.dart` |
| Login | `lib/screens/login_screen.dart` |
| Home + attendance | `lib/screens/tabs/home_tab.dart` |
| Clients + detail | `lib/screens/tabs/clients_tab.dart`, `client_detail_screen.dart` |
| Log visit (geo-fence + photos) | `lib/screens/log_visit_screen.dart` |
| Tasks / day-plan | `lib/screens/tabs/tasks_tab.dart` |
| Profile | `lib/screens/tabs/profile_tab.dart` |

## Not yet (next milestones)

- **M6** Live location pings in the background/foreground loop.
- **M7** Offline queue for pings/visits, richer error states, polish.
