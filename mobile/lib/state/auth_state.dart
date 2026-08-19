import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_client.dart';
import '../services/tracking_service.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState extends ChangeNotifier {
  final _api = ApiClient.instance;

  AuthStatus status = AuthStatus.unknown;
  User? user;

  /// Called on launch: if a stored token still works, go straight to Home.
  Future<void> tryAutoLogin() async {
    final t = await _api.token;
    if (t == null) {
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      final res = await _api.get('/auth/me');
      user = User.fromJson(res['user']);
      status = AuthStatus.authenticated;
    } catch (_) {
      await _api.clearToken();
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final res = await _api.post('/auth/login', {'email': email, 'password': password});
    await _api.setToken(res['token'] as String);
    user = User.fromJson(res['user']);
    status = AuthStatus.authenticated;
    notifyListeners();
  }

  Future<void> logout() async {
    await TrackingService.instance.stop();
    await _api.clearToken();
    user = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
