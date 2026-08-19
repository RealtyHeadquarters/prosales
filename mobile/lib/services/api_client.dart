import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/api_config.dart';

/// Thrown for any non-2xx response. [data] is the parsed JSON body (if any),
/// so callers can read fields like `code` (e.g. OUTSIDE_GEOFENCE).
class ApiException implements Exception {
  final int statusCode;
  final String message;
  final dynamic data;
  ApiException(this.statusCode, this.message, [this.data]);
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  final _storage = const FlutterSecureStorage();

  Future<String?> get token => _storage.read(key: 'token');
  Future<void> setToken(String value) => _storage.write(key: 'token', value: value);
  Future<void> clearToken() => _storage.delete(key: 'token');

  Future<Map<String, String>> _headers({bool json = true}) async {
    final t = await token;
    return {
      if (json) 'Content-Type': 'application/json',
      if (t != null) 'Authorization': 'Bearer $t',
    };
  }

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    final q = query?.map((k, v) => MapEntry(k, '$v'));
    return Uri.parse('${ApiConfig.baseUrl}$path').replace(queryParameters: q);
  }

  dynamic _decode(http.Response res) {
    final body = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    final msg = (body is Map && body['error'] != null)
        ? body['error'].toString()
        : 'Request failed (${res.statusCode})';
    throw ApiException(res.statusCode, msg, body);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    final res = await http.get(_uri(path, query), headers: await _headers(json: false));
    return _decode(res);
  }

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) async {
    final res = await http.post(_uri(path), headers: await _headers(), body: jsonEncode(body ?? {}));
    return _decode(res);
  }

  Future<dynamic> patch(String path, [Map<String, dynamic>? body]) async {
    final res = await http.patch(_uri(path), headers: await _headers(), body: jsonEncode(body ?? {}));
    return _decode(res);
  }

  Future<dynamic> delete(String path) async {
    final res = await http.delete(_uri(path), headers: await _headers(json: false));
    return _decode(res);
  }

  // Map a file path's extension to an image MIME type (default jpeg) so the
  // server never sees "application/octet-stream" for a photo.
  MediaType _imageType(String filePath) {
    final ext = filePath.contains('.') ? filePath.split('.').last.toLowerCase() : '';
    const map = {
      'jpg': 'jpeg', 'jpeg': 'jpeg', 'png': 'png', 'gif': 'gif',
      'webp': 'webp', 'heic': 'heic', 'heif': 'heif', 'bmp': 'bmp',
    };
    return MediaType('image', map[ext] ?? 'jpeg');
  }

  /// Multipart upload for visit photos (field name: "photos").
  Future<dynamic> uploadPhotos(String path, List<String> filePaths, {double? lat, double? lng}) async {
    final req = http.MultipartRequest('POST', _uri(path));
    req.headers.addAll(await _headers(json: false));
    if (lat != null) req.fields['lat'] = '$lat';
    if (lng != null) req.fields['lng'] = '$lng';
    for (final p in filePaths) {
      req.files.add(await http.MultipartFile.fromPath('photos', p, contentType: _imageType(p)));
    }
    final res = await http.Response.fromStream(await req.send());
    return _decode(res);
  }
}
