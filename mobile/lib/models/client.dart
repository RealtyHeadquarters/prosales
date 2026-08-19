class Client {
  final String id;
  final String name;
  final String? company;
  final String? phone;
  final String? email;
  final String? address;
  final String? status;
  final String? notes;
  final double? lat;
  final double? lng;

  Client({
    required this.id,
    required this.name,
    this.company,
    this.phone,
    this.email,
    this.address,
    this.status,
    this.notes,
    this.lat,
    this.lng,
  });

  factory Client.fromJson(Map<String, dynamic> j) => Client(
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        company: j['company'] as String?,
        phone: j['phone'] as String?,
        email: j['email'] as String?,
        address: j['address'] as String?,
        status: j['status'] as String?,
        notes: j['notes'] as String?,
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
      );
}
