import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../models/task.dart';
import '../../widgets/helpers.dart';

class TasksTab extends StatefulWidget {
  const TasksTab({super.key});

  @override
  State<TasksTab> createState() => _TasksTabState();
}

class _TasksTabState extends State<TasksTab> {
  final _api = ApiClient.instance;
  List<Task> _tasks = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get('/tasks');
      if (!mounted) return;
      setState(() => _tasks = (res['tasks'] as List).map((e) => Task.fromJson(e)).toList());
    } catch (e) {
      if (mounted) toast(context, 'Could not load tasks: $e', error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(Task t) async {
    try {
      await _api.patch('/tasks/${t.id}', {'status': t.isDone ? 'pending' : 'done'});
      _load();
    } catch (e) {
      if (mounted) toast(context, 'Could not update: $e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Tasks')),
      floatingActionButton: FloatingActionButton.extended(onPressed: _addTaskDialog, icon: const Icon(Icons.add), label: const Text('Task')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _tasks.isEmpty
                  ? ListView(children: const [SizedBox(height: 120), Center(child: Text('No tasks. Add one!'))])
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: _tasks.length,
                      itemBuilder: (_, i) => _tile(_tasks[i]),
                    ),
            ),
    );
  }

  Widget _tile(Task t) {
    return Card(
      child: CheckboxListTile(
        value: t.isDone,
        onChanged: (_) => _toggle(t),
        title: Text(t.title, style: TextStyle(decoration: t.isDone ? TextDecoration.lineThrough : null)),
        subtitle: Text([
          if (t.clientName != null) t.clientName,
          if (t.dueDate != null) 'Due: ${t.dueDate}',
        ].whereType<String>().join(' • ')),
        secondary: Icon(Icons.flag, color: statusColor(t.priority)),
      ),
    );
  }

  Future<void> _addTaskDialog() async {
    final title = TextEditingController();
    String type = 'todo';
    DateTime? due;

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('New Task'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: title, decoration: const InputDecoration(labelText: 'Title *')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Type'),
                items: const [
                  DropdownMenuItem(value: 'todo', child: Text('To-do')),
                  DropdownMenuItem(value: 'call', child: Text('Call')),
                  DropdownMenuItem(value: 'meeting', child: Text('Meeting')),
                  DropdownMenuItem(value: 'follow_up', child: Text('Follow-up')),
                ],
                onChanged: (v) => setDialog(() => type = v ?? 'todo'),
              ),
              const SizedBox(height: 8),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.event),
                title: Text(due == null ? 'Due date (optional)' : due!.toIso8601String().substring(0, 10)),
                onTap: () async {
                  final now = DateTime.now();
                  final d = await showDatePicker(context: ctx, firstDate: now, lastDate: now.add(const Duration(days: 365)), initialDate: now);
                  if (d != null) setDialog(() => due = d);
                },
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      ),
    );

    if (saved != true) return;
    if (title.text.trim().isEmpty) {
      if (mounted) toast(context, 'Title is required', error: true);
      return;
    }
    try {
      final today = DateTime.now().toIso8601String().substring(0, 10);
      await _api.post('/tasks', {
        'title': title.text.trim(),
        'type': type,
        'plan_date': today,
        if (due != null) 'due_date': due!.toIso8601String().substring(0, 10),
      });
      if (mounted) toast(context, 'Task added ✓');
      _load();
    } catch (e) {
      if (mounted) toast(context, 'Could not save: $e', error: true);
    }
  }
}
