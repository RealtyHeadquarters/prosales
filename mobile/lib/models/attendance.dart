class Attendance {
  final String? checkInAt;
  final String? checkOutAt;
  final String? workDate;

  Attendance({this.checkInAt, this.checkOutAt, this.workDate});

  factory Attendance.fromJson(Map<String, dynamic> j) => Attendance(
        checkInAt: j['check_in_at'] as String?,
        checkOutAt: j['check_out_at'] as String?,
        workDate: j['work_date'] as String?,
      );

  bool get checkedIn => checkInAt != null;
  bool get checkedOut => checkOutAt != null;
}
