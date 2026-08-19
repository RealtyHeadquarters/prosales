import 'package:flutter_test/flutter_test.dart';
import 'package:prosales/widgets/helpers.dart';

void main() {
  test('formatDateTime handles null', () {
    expect(formatDateTime(null), '—');
  });

  test('formatDateTime formats an ISO string', () {
    // 2026-08-19T09:05:00Z → local time; just ensure it is not the placeholder.
    expect(formatDateTime('2026-08-19T09:05:00.000Z'), isNot('—'));
  });
}
