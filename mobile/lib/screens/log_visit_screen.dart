import 'dart:io';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_client.dart';
import '../services/location_service.dart';
import '../models/client.dart';
import '../widgets/helpers.dart';

class LogVisitScreen extends StatefulWidget {
  final Client? client;
  const LogVisitScreen({super.key, this.client});

  @override
  State<LogVisitScreen> createState() => _LogVisitScreenState();
}

class _LogVisitScreenState extends State<LogVisitScreen> {
  final _api = ApiClient.instance;
  final _purpose = TextEditingController();
  final _notes = TextEditingController();
  final _outcome = TextEditingController();

  List<Client> _clients = [];
  String? _clientId;
  Position? _pos;
  DateTime? _followUp;
  final List<XFile> _photos = [];
  bool _capturing = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _clientId = widget.client?.id;
    if (widget.client == null) _loadClients();
    _capture();
  }

  @override
  void dispose() {
    _purpose.dispose();
    _notes.dispose();
    _outcome.dispose();
    super.dispose();
  }

  Future<void> _loadClients() async {
    try {
      final res = await _api.get('/clients');
      if (!mounted) return;
      setState(() => _clients = (res['clients'] as List).map((e) => Client.fromJson(e)).toList());
    } catch (e) {
      if (mounted) toast(context, 'Could not load clients: $e', error: true);
    }
  }

  Future<void> _capture() async {
    setState(() => _capturing = true);
    try {
      final p = await LocationService.current();
      if (mounted) setState(() => _pos = p);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _addPhoto(ImageSource src) async {
    try {
      final img = await ImagePicker().pickImage(source: src, imageQuality: 70, maxWidth: 1600);
      if (img != null) setState(() => _photos.add(img));
    } catch (e) {
      if (mounted) toast(context, 'Could not get photo: $e', error: true);
    }
  }

  Future<void> _pickFollowUp() async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 365)), initialDate: now.add(const Duration(days: 3)));
    if (d != null) setState(() => _followUp = d);
  }

  Future<void> _submit() async {
    if (_clientId == null) {
      toast(context, 'Please select a client', error: true);
      return;
    }
    setState(() => _submitting = true);
    try {
      final res = await _api.post('/visits', {
        'client_id': _clientId,
        'purpose': _purpose.text.trim(),
        'notes': _notes.text.trim(),
        'outcome': _outcome.text.trim(),
        if (_pos != null) 'lat': _pos!.latitude,
        if (_pos != null) 'lng': _pos!.longitude,
        if (_followUp != null) 'next_follow_up': _followUp!.toIso8601String().substring(0, 10),
      });
      final visitId = res['visit']['id'] as String;
      if (_photos.isNotEmpty) {
        await _api.uploadPhotos('/visits/$visitId/photos', _photos.map((e) => e.path).toList(), lat: _pos?.latitude, lng: _pos?.longitude);
      }
      if (mounted) {
        toast(context, 'Visit logged ✓');
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      String msg = e.message;
      if (e.data is Map && e.data['code'] == 'OUTSIDE_GEOFENCE') {
        msg = 'You are ${e.data['distance_m']}m away (allowed ${e.data['allowed_radius_m']}m). Move closer to the client.';
      } else if (e.data is Map && e.data['code'] == 'LOCATION_REQUIRED') {
        msg = 'Your location is required. Tap "Capture location" and retry.';
      }
      if (mounted) toast(context, msg, error: true);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Log Visit')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (widget.client != null)
            Card(child: ListTile(leading: const Icon(Icons.business), title: Text(widget.client!.name), subtitle: Text(widget.client!.company ?? '')))
          else
            DropdownButtonFormField<String>(
              initialValue: _clientId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Client *'),
              items: _clients.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name, overflow: TextOverflow.ellipsis))).toList(),
              onChanged: (v) => setState(() => _clientId = v),
            ),
          const SizedBox(height: 16),
          _locationRow(),
          const SizedBox(height: 16),
          TextField(controller: _purpose, decoration: const InputDecoration(labelText: 'Purpose (e.g. Demo, Payment)')),
          const SizedBox(height: 12),
          TextField(controller: _notes, maxLines: 3, decoration: const InputDecoration(labelText: 'Meeting details / notes')),
          const SizedBox(height: 12),
          TextField(controller: _outcome, decoration: const InputDecoration(labelText: 'Outcome (e.g. Positive, Follow-up needed)')),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: const Icon(Icons.event),
              title: Text(_followUp == null ? 'Set follow-up date' : 'Follow-up: ${_followUp!.toIso8601String().substring(0, 10)}'),
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickFollowUp,
            ),
          ),
          const SizedBox(height: 16),
          Text('Photos', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          _photoRow(),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: _submitting ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check),
            label: const Text('Save Visit'),
          ),
        ],
      ),
    );
  }

  Widget _locationRow() {
    return Card(
      child: ListTile(
        leading: Icon(_pos != null ? Icons.gps_fixed : Icons.gps_off, color: _pos != null ? Colors.green : Colors.grey),
        title: Text(_pos != null ? 'Location captured' : (_capturing ? 'Getting location…' : 'No location')),
        subtitle: _pos != null ? Text('${_pos!.latitude.toStringAsFixed(5)}, ${_pos!.longitude.toStringAsFixed(5)}') : null,
        trailing: TextButton(onPressed: _capturing ? null : _capture, child: const Text('Recapture')),
      ),
    );
  }

  Widget _photoRow() {
    return SizedBox(
      height: 90,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _addPhotoButton(),
          ..._photos.map((p) => Padding(
                padding: const EdgeInsets.only(left: 8),
                child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.file(File(p.path), width: 90, height: 90, fit: BoxFit.cover)),
              )),
        ],
      ),
    );
  }

  Widget _addPhotoButton() {
    return InkWell(
      onTap: () => showModalBottomSheet(
        context: context,
        builder: (_) => SafeArea(
          child: Wrap(children: [
            ListTile(leading: const Icon(Icons.camera_alt), title: const Text('Camera'), onTap: () { Navigator.pop(context); _addPhoto(ImageSource.camera); }),
            ListTile(leading: const Icon(Icons.photo_library), title: const Text('Gallery'), onTap: () { Navigator.pop(context); _addPhoto(ImageSource.gallery); }),
          ]),
        ),
      ),
      child: Container(
        width: 90,
        height: 90,
        decoration: BoxDecoration(border: Border.all(color: Colors.grey), borderRadius: BorderRadius.circular(10)),
        child: const Icon(Icons.add_a_photo, color: Colors.grey),
      ),
    );
  }
}
