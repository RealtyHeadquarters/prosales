// End-to-end happy-path test against a RUNNING server + real database.
// Prereqs: `npm run migrate && npm run seed`, start the server, then: npm run smoke
// Override base URL with:  BASE_URL=http://localhost:4000 npm run smoke
const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const TODAY = new Date().toISOString().slice(0, 10);
const NEXT_WEEK = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

// Client sits at Connaught Place, Delhi. "Far" point is ~9km away.
const CP = { lat: 28.6329, lng: 77.2195 };
const FAR = { lat: 28.7041, lng: 77.1025 };

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name}  ${extra}`); fail++; }
}
async function api(path, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  let data = null;
  try { data = await res.json(); } catch { /* 204 */ }
  return { status: res.status, data };
}
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);

(async () => {
  console.log(`Running smoke test against ${BASE}\n`);

  // ---- Auth ----
  const admin = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@prosales.com', password: 'Admin@123' } });
  ok('admin login', admin.status === 200 && admin.data?.token, JSON.stringify(admin.data));
  const adminToken = admin.data?.token;
  if (!adminToken) { console.log('\nNo admin token — did you run migrate + seed?'); process.exit(1); }

  const settings = await api('/api/settings', { token: adminToken });
  ok('read settings (geofence on by default)', settings.status === 200 && settings.data?.settings?.geofence_enforce === true, JSON.stringify(settings.data));

  const created = await api('/api/auth/register', { method: 'POST', token: adminToken, body: { name: 'Rep One', email: 'rep1@prosales.com', phone: '9990001111', password: 'Rep@123', role: 'sales' } });
  ok('create sales rep (201 or 409 on re-run)', [201, 409].includes(created.status), JSON.stringify(created.data));

  const rep = await api('/api/auth/login', { method: 'POST', body: { email: 'rep1@prosales.com', password: 'Rep@123' } });
  ok('rep login', rep.status === 200 && rep.data?.token, JSON.stringify(rep.data));
  const repToken = rep.data?.token;
  const repId = rep.data?.user?.id;

  // ---- Territory + membership ----
  const terr = await api('/api/territories', { method: 'POST', token: adminToken, body: { name: `Delhi Central ${TODAY}`, center_lat: CP.lat, center_lng: CP.lng, radius_m: 8000 } });
  ok('create territory', terr.status === 201 && terr.data?.territory?.id, JSON.stringify(terr.data));
  const terrId = terr.data?.territory?.id;
  const addMember = await api(`/api/territories/${terrId}/members`, { method: 'POST', token: adminToken, body: { user_id: repId } });
  ok('add rep to territory', addMember.status === 201, JSON.stringify(addMember.data));

  // ---- Attendance + location ----
  const checkin = await api('/api/attendance/check-in', { method: 'POST', token: repToken, body: { lat: CP.lat, lng: CP.lng } });
  ok('attendance check-in', checkin.status === 201 && checkin.data?.attendance?.check_in_at, JSON.stringify(checkin.data));
  const ping = await api('/api/location', { method: 'POST', token: repToken, body: { lat: CP.lat, lng: CP.lng, accuracy: 8, battery: 82 } });
  ok('location ping', ping.status === 201 && ping.data?.ping?.id, JSON.stringify(ping.data));

  // ---- Client (rep-owned) at CP ----
  const client = await api('/api/clients', { method: 'POST', token: repToken, body: { name: 'Acme Corp', company: 'Acme', phone: '9812345678', address: 'CP, Delhi', lat: CP.lat, lng: CP.lng } });
  ok('create client (assigned to self)', client.status === 201 && client.data?.client?.assigned_to === repId, JSON.stringify(client.data));
  const clientId = client.data?.client?.id;

  // ---- Geofencing ----
  const inFence = await api('/api/visits', { method: 'POST', token: repToken, body: { client_id: clientId, purpose: 'Demo', notes: 'Discussed pricing', outcome: 'Positive', lat: CP.lat, lng: CP.lng } });
  ok('geofence: visit at client location accepted', inFence.status === 201 && inFence.data?.visit?.within_geofence === true, JSON.stringify(inFence.data));
  const visitId = inFence.data?.visit?.id;

  const outFence = await api('/api/visits', { method: 'POST', token: repToken, body: { client_id: clientId, notes: 'fake?', lat: FAR.lat, lng: FAR.lng } });
  ok('geofence: far-away visit rejected (422)', outFence.status === 422 && outFence.data?.code === 'OUTSIDE_GEOFENCE', JSON.stringify(outFence.data));

  const noLoc = await api('/api/visits', { method: 'POST', token: repToken, body: { client_id: clientId, notes: 'no gps' } });
  ok('geofence: missing location rejected (422)', noLoc.status === 422 && noLoc.data?.code === 'LOCATION_REQUIRED', JSON.stringify(noLoc.data));

  // ---- Follow-up auto-task ----
  const visitFU = await api('/api/visits', { method: 'POST', token: repToken, body: { client_id: clientId, notes: 'set follow-up', lat: CP.lat, lng: CP.lng, next_follow_up: NEXT_WEEK } });
  ok('visit with follow-up date', visitFU.status === 201, JSON.stringify(visitFU.data));
  const followTasks = await api('/api/tasks?type=follow_up', { token: repToken });
  ok('follow-up auto-created a task', followTasks.status === 200 && followTasks.data?.tasks?.some((t) => t.client_id === clientId), JSON.stringify(followTasks.data));

  // ---- Photo upload ----
  const form = new FormData();
  form.append('photos', new Blob([PNG], { type: 'image/png' }), 'site.png');
  form.append('lat', String(CP.lat)); form.append('lng', String(CP.lng));
  const photo = await api(`/api/visits/${visitId}/photos`, { method: 'POST', token: repToken, form });
  ok('upload visit photo', photo.status === 201 && photo.data?.photos?.length === 1, JSON.stringify(photo.data));

  // ---- Tasks / day-plan ----
  const task = await api('/api/tasks', { method: 'POST', token: repToken, body: { title: 'Call Acme', type: 'call', client_id: clientId, plan_date: TODAY, due_date: TODAY, priority: 'high' } });
  ok('create task', task.status === 201 && task.data?.task?.id, JSON.stringify(task.data));
  const taskId = task.data?.task?.id;
  const agenda = await api(`/api/tasks/agenda?date=${TODAY}`, { token: repToken });
  ok('day-plan agenda shows task', agenda.status === 200 && agenda.data?.tasks?.some((t) => t.id === taskId), JSON.stringify(agenda.data));
  const reminders = await api('/api/tasks/reminders', { token: repToken });
  ok('reminders include due task', reminders.status === 200 && reminders.data?.reminders?.some((t) => t.id === taskId), JSON.stringify(reminders.data));
  const doneTask = await api(`/api/tasks/${taskId}`, { method: 'PATCH', token: repToken, body: { status: 'done' } });
  ok('complete task sets completed_at', doneTask.status === 200 && doneTask.data?.task?.completed_at, JSON.stringify(doneTask.data));

  // ---- Auto lead-assignment (admin creates unassigned lead in territory) ----
  const autoLead = await api('/api/clients', { method: 'POST', token: adminToken, body: { name: 'Auto Lead', lat: CP.lat + 0.001, lng: CP.lng + 0.001 } });
  ok('unassigned lead auto-assigned to territory rep', autoLead.status === 201 && autoLead.data?.client?.assigned_to === repId, JSON.stringify(autoLead.data));

  // ---- Reports ----
  const summary = await api('/api/reports/summary', { token: repToken });
  ok('rep summary: meetings_done ≥ 1', summary.status === 200 && summary.data?.summary?.meetings_done >= 1, JSON.stringify(summary.data));
  const team = await api('/api/reports/team', { token: adminToken });
  ok('team report includes rep', team.status === 200 && team.data?.reps?.some((r) => r.user_id === repId), JSON.stringify(team.data));

  // ---- Manager visibility + role guards ----
  const live = await api('/api/location/live', { token: adminToken });
  ok('admin sees rep on live map', live.status === 200 && live.data?.locations?.some((l) => l.user_id === repId), JSON.stringify(live.data));
  const denied = await api('/api/reports/team', { token: repToken });
  ok('rep blocked from team report (403)', denied.status === 403, JSON.stringify(denied.data));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('Smoke test crashed:', e); process.exit(1); });
