import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client.dart';
import 'location_service.dart';

/// Foreground live-location tracking with an offline queue.
///
/// While tracking, every meaningful movement is POSTed to `/api/location`.
/// If the network is down, pings are buffered on disk and flushed in a single
/// `/api/location/batch` call once connectivity returns.
class TrackingService {
  TrackingService._();
  static final TrackingService instance = TrackingService._();

  final _api = ApiClient.instance;

  /// UI can listen to these.
  final ValueNotifier<bool> isTracking = ValueNotifier(false);
  final ValueNotifier<int> pending = ValueNotifier(0);

  StreamSubscription<Position>? _sub;
  Timer? _flushTimer;
  List<Map<String, dynamic>> _queue = [];
  bool _loaded = false;
  static const _key = 'ping_queue';

  Future<void> _load() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_key) ?? [];
    _queue = raw.map((e) => jsonDecode(e) as Map<String, dynamic>).toList();
    pending.value = _queue.length;
    _loaded = true;
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, _queue.map(jsonEncode).toList());
    pending.value = _queue.length;
  }

  Future<void> start() async {
    if (isTracking.value) return;
    await _load();
    // Make sure permission is granted (this also prompts the user once).
    try {
      await LocationService.current();
    } catch (_) {
      return; // no permission → stay off
    }
    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 25),
    ).listen(_onPosition, onError: (_) {});
    _flushTimer = Timer.periodic(const Duration(seconds: 30), (_) => _flush());
    isTracking.value = true;
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    _flushTimer?.cancel();
    _flushTimer = null;
    isTracking.value = false;
    await _flush(); // one last attempt to push anything queued
  }

  /// Called when the app resumes — good moment to drain the backlog.
  Future<void> onResume() => _flush();

  Future<void> _onPosition(Position p) async {
    final ping = {
      'lat': p.latitude,
      'lng': p.longitude,
      'accuracy': p.accuracy,
      'speed': p.speed,
      'recorded_at': DateTime.now().toUtc().toIso8601String(),
    };
    try {
      await _api.post('/location', ping);
      if (_queue.isNotEmpty) await _flush(); // back online → drain backlog
    } catch (_) {
      _queue.add(ping);
      await _persist();
    }
  }

  Future<void> _flush() async {
    await _load();
    if (_queue.isEmpty) return;
    final batch = List<Map<String, dynamic>>.from(_queue);
    try {
      await _api.post('/location/batch', {'pings': batch});
      _queue.clear();
      await _persist();
    } catch (_) {
      // still offline — keep the queue for next time
    }
  }
}
