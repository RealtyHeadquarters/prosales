import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../services/location_service.dart';
import '../../services/tracking_service.dart';
import '../../state/auth_state.dart';
import '../../models/attendance.dart';
import '../../models/task.dart';
import '../../widgets/helpers.dart';
import '../log_visit_screen.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key});

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  final _api = ApiClient.instance;
  Attendance? _today;
  List<Task> _agenda = [];
  int _visitsToday = 0;
  int _pendingTasks = 0;
  int _clients = 0;
  bool _loading = true;
  bool _busy = false;

  String get _todayStr => DateTime.now().toIso8601String().substring(0, 10);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await Future.wait([
        _api.get('/attendance/me'),
        _api.get('/tasks/agenda', query: {'date': _todayStr}),
        _api.get('/visits'),
        _api.get('/tasks', query: {'status': 'pending'}),
        _api.get('/clients'),
      ]);
      final list = (res[0]['attendance'] as List).map((e) => Attendance.fromJson(e)).toList();
      Attendance? today;
      for (final a in list) {
        if (a.workDate == _todayStr) {
          today = a;
          break;
        }
      }
      final visits = res[2]['visits'] as List;
      if (!mounted) return;
      setState(() {
        _today = today;
        _agenda = (res[1]['tasks'] as List).map((e) => Task.fromJson(e)).toList();
        _visitsToday = visits.where((v) => (v['created_at'] ?? '').toString().startsWith(_todayStr)).length;
        _pendingTasks = (res[3]['tasks'] as List).length;
        _clients = (res[4]['clients'] as List).length;
      });
      // Resume tracking if the rep is checked in but not yet out.
      if (today?.checkedIn == true && today?.checkedOut != true) {
        TrackingService.instance.start();
      }
    } catch (e) {
      if (mounted) toast(context, 'Could not load: $e', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _mark(String action) async {
    setState(() => _busy = true);
    try {
      final pos = await LocationService.current();
      await _api.post('/attendance/$action', {'lat': pos.latitude, 'lng': pos.longitude});
      if (action == 'check-in') {
        await TrackingService.instance.start();
      } else {
        await TrackingService.instance.stop();
      }
      await _load();
      if (mounted) toast(context, action == 'check-in' ? 'Checked in ✓' : 'Checked out ✓');
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    return Scaffold(
      appBar: AppBar(title: Text('Hi, ${user?.name ?? 'there'} 👋')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _attendanceCard(),
                  const SizedBox(height: 16),
                  _statsRow(),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LogVisitScreen())),
                      icon: const Icon(Icons.add_location_alt),
                      label: const Text('Log a Client Visit'),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text("Today's plan", style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  if (_agenda.isEmpty)
                    const Card(child: Padding(padding: EdgeInsets.all(20), child: Text('No tasks planned for today.'))),
                  ..._agenda.map(_taskTile),
                ],
              ),
            ),
    );
  }

  Widget _statsRow() {
    return Row(
      children: [
        _statCard('Visits today', '$_visitsToday', Icons.place, Colors.blue),
        const SizedBox(width: 10),
        _statCard('Pending tasks', '$_pendingTasks', Icons.checklist, Colors.orange),
        const SizedBox(width: 10),
        _statCard('My clients', '$_clients', Icons.people, Colors.teal),
      ],
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
          child: Column(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 6),
              Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600), textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }

  Widget _attendanceCard() {
    final checkedIn = _today?.checkedIn ?? false;
    final checkedOut = _today?.checkedOut ?? false;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.access_time, color: brand),
                const SizedBox(width: 8),
                Text('Attendance', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            if (checkedIn)
              Text('Checked in: ${formatDateTime(_today?.checkInAt)}'),
            if (checkedOut)
              Text('Checked out: ${formatDateTime(_today?.checkOutAt)}'),
            if (!checkedIn) const Text('You have not checked in today.'),
            const SizedBox(height: 16),
            if (!checkedIn)
              FilledButton.icon(
                onPressed: _busy ? null : () => _mark('check-in'),
                icon: const Icon(Icons.login),
                label: const Text('Check In'),
              )
            else if (!checkedOut)
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: Colors.orange.shade700),
                onPressed: _busy ? null : () => _mark('check-out'),
                icon: const Icon(Icons.logout),
                label: const Text('Check Out'),
              )
            else
              Row(children: const [Icon(Icons.check_circle, color: Colors.green), SizedBox(width: 8), Text('Day complete 🎉')]),
            _trackingStatus(),
          ],
        ),
      ),
    );
  }

  Widget _trackingStatus() {
    return ValueListenableBuilder<bool>(
      valueListenable: TrackingService.instance.isTracking,
      builder: (_, on, _) => ValueListenableBuilder<int>(
        valueListenable: TrackingService.instance.pending,
        builder: (_, queued, _) => Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Row(
            children: [
              Icon(on ? Icons.gps_fixed : Icons.gps_off, size: 16, color: on ? Colors.green : Colors.grey),
              const SizedBox(width: 6),
              Text(on ? 'Location sharing ON' : 'Location sharing OFF', style: const TextStyle(fontSize: 13)),
              if (queued > 0) ...[
                const Spacer(),
                const Icon(Icons.sync_problem, size: 15, color: Colors.orange),
                const SizedBox(width: 4),
                Text('$queued to sync', style: const TextStyle(fontSize: 12, color: Colors.orange)),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _taskTile(Task t) {
    return Card(
      child: ListTile(
        leading: Icon(_iconFor(t.type), color: statusColor(t.priority)),
        title: Text(t.title),
        subtitle: t.clientName != null ? Text(t.clientName!) : null,
        trailing: t.dueDate != null ? Text(t.dueDate!.substring(5)) : null,
      ),
    );
  }

  IconData _iconFor(String? type) {
    switch (type) {
      case 'call':
        return Icons.phone;
      case 'meeting':
        return Icons.groups;
      case 'follow_up':
        return Icons.replay;
      default:
        return Icons.task_alt;
    }
  }
}

const brand = Color(0xFF2563EB);
