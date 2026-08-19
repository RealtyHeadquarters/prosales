class Task {
  final String id;
  final String title;
  final String? type;
  final String? priority;
  final String? status;
  final String? planDate;
  final String? dueDate;
  final String? clientId;
  final String? clientName;
  final String? description;

  Task({
    required this.id,
    required this.title,
    this.type,
    this.priority,
    this.status,
    this.planDate,
    this.dueDate,
    this.clientId,
    this.clientName,
    this.description,
  });

  factory Task.fromJson(Map<String, dynamic> j) => Task(
        id: j['id'] as String,
        title: (j['title'] ?? '') as String,
        type: j['type'] as String?,
        priority: j['priority'] as String?,
        status: j['status'] as String?,
        planDate: j['plan_date'] as String?,
        dueDate: j['due_date'] as String?,
        clientId: j['client_id'] as String?,
        clientName: j['client_name'] as String?,
        description: j['description'] as String?,
      );

  bool get isDone => status == 'done';
}
