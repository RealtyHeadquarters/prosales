import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../models/client.dart';
import '../models/visit.dart';
import '../widgets/helpers.dart';
import 'log_visit_screen.dart';

class ClientDetailScreen extends StatefulWidget {
  final Client client;
  const ClientDetailScreen({super.key, required this.client});

  @override
  State<ClientDetailScreen> createState() => _ClientDetailScreenState();
}

class _ClientDetailScreenState extends State<ClientDetailScreen> {
  final _api = ApiClient.instance;
  List<Visit> _visits = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get('/visits', query: {'client_id': widget.client.id});
      if (!mounted) return;
      setState(() => _visits = (res['visits'] as List).map((e) => Visit.fromJson(e)).toList());
    } catch (e) {
      if (mounted) toast(context, 'Could not load visits: $e', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.client;
    return Scaffold(
      appBar: AppBar(title: Text(c.name)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => LogVisitScreen(client: c)));
          _load();
        },
        icon: const Icon(Icons.add_location_alt),
        label: const Text('Log Visit'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (c.company != null && c.company!.isNotEmpty) _row(Icons.business, c.company!),
                          if (c.phone != null && c.phone!.isNotEmpty) _row(Icons.phone, c.phone!),
                          if (c.email != null && c.email!.isNotEmpty) _row(Icons.email_outlined, c.email!),
                          if (c.address != null && c.address!.isNotEmpty) _row(Icons.place, c.address!),
                          _row(Icons.flag, 'Status: ${c.status ?? 'lead'}'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('Visit history', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  if (_visits.isEmpty)
                    const Card(child: Padding(padding: EdgeInsets.all(20), child: Text('No visits logged yet.'))),
                  ..._visits.map(_visitTile),
                  const SizedBox(height: 80),
                ],
              ),
            ),
    );
  }

  Widget _row(IconData icon, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [Icon(icon, size: 18, color: Colors.grey), const SizedBox(width: 10), Expanded(child: Text(text))]),
      );

  Widget _visitTile(Visit v) => Card(
        child: ListTile(
          title: Text(v.purpose?.isNotEmpty == true ? v.purpose! : 'Visit'),
          subtitle: Text([v.notes, if (v.outcome != null) 'Outcome: ${v.outcome}'].where((e) => e != null && e.isNotEmpty).join('\n')),
          isThreeLine: (v.notes ?? '').isNotEmpty,
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(formatDateTime(v.createdAt), style: const TextStyle(fontSize: 11)),
              if (v.photoCount > 0) Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.photo, size: 14), Text('${v.photoCount}')]),
            ],
          ),
        ),
      );
}
