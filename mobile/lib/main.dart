import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'state/auth_state.dart';
import 'services/tracking_service.dart';
import 'theme.dart';
import 'screens/splash_screen.dart';

void main() {
  runApp(const ProSalesApp());
}

class ProSalesApp extends StatefulWidget {
  const ProSalesApp({super.key});

  @override
  State<ProSalesApp> createState() => _ProSalesAppState();
}

class _ProSalesAppState extends State<ProSalesApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // On resume, try to drain any location pings that were queued offline.
    if (state == AppLifecycleState.resumed) {
      TrackingService.instance.onResume();
    }
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthState()..tryAutoLogin(),
      child: MaterialApp(
        title: 'ProSales',
        debugShowCheckedModeBanner: false,
        theme: appTheme,
        home: const SplashScreen(),
      ),
    );
  }
}
