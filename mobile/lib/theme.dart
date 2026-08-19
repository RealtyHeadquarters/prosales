import 'package:flutter/material.dart';

const brandBlue = Color(0xFF2563EB);

final appTheme = ThemeData(
  colorScheme: ColorScheme.fromSeed(seedColor: brandBlue),
  useMaterial3: true,
  scaffoldBackgroundColor: const Color(0xFFF5F6F8),
  appBarTheme: const AppBarTheme(centerTitle: false, elevation: 0),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      minimumSize: const Size.fromHeight(48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    filled: true,
    fillColor: Colors.white,
  ),
  cardTheme: CardThemeData(
    elevation: 0,
    color: Colors.white,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
  ),
);
