class Visit {
  final String id;
  final String? purpose;
  final String? notes;
  final String? outcome;
  final String? status;
  final String? clientName;
  final String? createdAt;
  final int photoCount;

  Visit({
    required this.id,
    this.purpose,
    this.notes,
    this.outcome,
    this.status,
    this.clientName,
    this.createdAt,
    this.photoCount = 0,
  });

  factory Visit.fromJson(Map<String, dynamic> j) => Visit(
        id: j['id'] as String,
        purpose: j['purpose'] as String?,
        notes: j['notes'] as String?,
        outcome: j['outcome'] as String?,
        status: j['status'] as String?,
        clientName: j['client_name'] as String?,
        createdAt: j['created_at'] as String?,
        photoCount: (j['photo_count'] as num?)?.toInt() ?? 0,
      );
}
