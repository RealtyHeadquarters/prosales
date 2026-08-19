import 'package:geolocator/geolocator.dart';

class LocationService {
  /// Returns the device's current position, requesting permission if needed.
  /// Throws a human-readable String on failure.
  static Future<Position> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw 'Location (GPS) is turned off. Please enable it.';
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw 'Location permission was denied.';
    }
    if (permission == LocationPermission.deniedForever) {
      throw 'Location permission is permanently denied. Enable it from Settings.';
    }
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }
}
