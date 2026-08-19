import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../services/location_service.dart';
import '../../models/client.dart';
import '../../widgets/helpers.dart';
import '../client_detail_screen.dart';

class ClientsTab extends StatefulWidget {
  const ClientsTab({super.key});

  @override
  State<ClientsTab> createState() => _ClientsTabState();
}

class _ClientsTabState extends State<ClientsTab> {
  final _api = ApiClient.instance;
  List<Client> _all = [];
  String _search = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get('/clients');
      if (!mounted) return;
      setState(() => _all = (res['clients'] as List).map((e) => Client.fromJson(e)).toList());
    } catch (e) {
      if (mounted) toast(context, 'Could not load clients: $e', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Client> get _filtered {
    if (_search.isEmpty) return _all;
    final q = _search.toLowerCase();
    return _all.where((c) => c.name.toLowerCase().contains(q) || (c.company ?? '').toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Clients')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addClientDialog,
        icon: const Icon(Icons.add),
        label: const Text('New'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: const InputDecoration(hintText: 'Search name or company', prefixIcon: Icon(Icons.search)),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _filtered.isEmpty
                        ? ListView(children: const [SizedBox(height: 120), Center(child: Text('No clients yet.'))])
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            itemCount: _filtered.length,
                            itemBuilder: (_, i) => _clientTile(_filtered[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _clientTile(Client c) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(child: Text(c.name.isNotEmpty ? c.name[0].toUpperCase() : '?')),
        title: Text(c.name),
        subtitle: Text([c.company, c.phone].where((e) => e != null && e.isNotEmpty).join(' • ')),
        trailing: Chip(
          label: Text(c.status ?? 'lead', style: const TextStyle(fontSize: 11, color: Colors.white)),
          backgroundColor: statusColor(c.status),
          visualDensity: VisualDensity.compact,
        ),
        onTap: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => ClientDetailScreen(client: c)));
          _load();
        },
      ),
    );
  }

  Future<void> _addClientDialog() async {
    final name = TextEditingController();
    final company = TextEditingController();
    final phone = TextEditingController();
    final address = TextEditingController();
    bool useLocation = true;

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('New Client'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: name, decoration: const InputDecoration(labelText: 'Name *')),
                const SizedBox(height: 10),
                TextField(controller: company, decoration: const InputDecoration(labelText: 'Company')),
                const SizedBox(height: 10),
                TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
                const SizedBox(height: 10),
                TextField(controller: address, decoration: const InputDecoration(labelText: 'Address')),
                const SizedBox(height: 6),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: useLocation,
                  onChanged: (v) => setDialog(() => useLocation = v ?? true),
                  title: const Text('Save my current location as the site'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      ),
    );

    if (saved != true) return;
    if (name.text.trim().isEmpty) {
      if (mounted) toast(context, 'Name is required', error: true);
      return;
    }
    try {
      double? lat, lng;
      if (useLocation) {
        try {
          final pos = await LocationService.current();
          lat = pos.latitude;
          lng = pos.longitude;
        } catch (_) {/* location optional */}
      }
      await _api.post('/clients', {
        'name': name.text.trim(),
        'company': company.text.trim(),
        'phone': phone.text.trim(),
        'address': address.text.trim(),
        'lat': ?lat,
        'lng': ?lng,
      });
      if (mounted) toast(context, 'Client added ✓');
      _load();
    } catch (e) {
      if (mounted) toast(context, 'Could not save: $e', error: true);
    }
  }
}
