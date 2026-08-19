import 'dart:io';

/// Where the backend lives.
///
/// Production build (points at your deployed backend):
///   flutter build apk --release --dart-define=API_URL=https://prosales-backend.onrender.com/api
///
/// Local dev (no --dart-define):
///   - Android emulator reaches the host machine at 10.0.2.2 (not localhost).
///   - iOS simulator can use localhost.
///   - Real phone on same Wi-Fi → set [_lanHost] to your computer's IP.
class ApiConfig {
  static const String _override = String.fromEnvironment('API_URL');
  static const String _lanHost = ''; // e.g. 'http://192.168.1.5:4000'

  static String get baseUrl => _override.isNotEmpty ? _override : '$origin/api';

  static String get origin {
    if (_override.isNotEmpty) {
      return _override.replaceAll(RegExp(r'/api/?$'), '');
    }
    if (_lanHost.isNotEmpty) return _lanHost;
    if (Platform.isAndroid) return 'http://10.0.2.2:4000';
    return 'http://localhost:4000';
  }
}
