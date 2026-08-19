class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? phone;

  User({required this.id, required this.name, required this.email, required this.role, this.phone});

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        email: (j['email'] ?? '') as String,
        role: (j['role'] ?? 'sales') as String,
        phone: j['phone'] as String?,
      );

  bool get isManager => role == 'admin' || role == 'manager';
}
