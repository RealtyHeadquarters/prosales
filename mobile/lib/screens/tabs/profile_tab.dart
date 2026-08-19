import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/auth_state.dart';
import '../../config/api_config.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final user = auth.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const SizedBox(height: 12),
          CircleAvatar(radius: 40, child: Text(user?.name.isNotEmpty == true ? user!.name[0].toUpperCase() : '?', style: const TextStyle(fontSize: 32))),
          const SizedBox(height: 12),
          Center(child: Text(user?.name ?? '', style: Theme.of(context).textTheme.titleLarge)),
          Center(child: Text(user?.role ?? '', style: TextStyle(color: Colors.grey.shade600))),
          const SizedBox(height: 24),
          Card(
            child: Column(
              children: [
                ListTile(leading: const Icon(Icons.email_outlined), title: Text(user?.email ?? '—')),
                if (user?.phone != null) ListTile(leading: const Icon(Icons.phone), title: Text(user!.phone!)),
                ListTile(leading: const Icon(Icons.dns_outlined), title: const Text('Server'), subtitle: Text(ApiConfig.origin)),
              ],
            ),
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade600),
            onPressed: () => auth.logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}
