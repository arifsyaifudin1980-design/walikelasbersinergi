/**
 * Data structures and types for Aplikasi Monitoring dan Laporan Presensi Siswa
 * Based on PRD v5.0 + Teacher Teaching QR Attendance Extension
 */

export type Role = 'opm' | 'wali_kelas';

export type AttendanceStatus = 'H' | 'S' | 'I' | 'A';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: Role;
  nip?: string;
  email?: string;
  authUid?: string;
  assignedClassId?: string; // For Wali Kelas
  isActive: boolean;
}

export interface MadrasahProfile {
  name: string;
  nsm: string; // Nomor Statistik Madrasah
  npsn: string; // Nomor Pokok Sekolah Nasional
  address: string;
  phone: string;
  email: string;
  website?: string;
  headmasterName: string;
  headmasterNip: string;
  city: string;
  logoUrl: string; // Empty string '' when no logo uploaded (empty logo container)
  signatureNoteDefault: string;
}

export interface AcademicYear {
  id: string;
  year: string; // e.g. "2026/2027"
  semester: 'Ganjil' | 'Genap';
  isActive: boolean;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface AcademicCalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'libur_nasional' | 'libur_madrasah' | 'libur_semester' | 'kegiatan_khusus' | 'non_efektif';
  isEffective: boolean; // false for holidays, not counted in effective school days
}

export interface SchoolClass {
  id: string;
  name: string; // e.g. "VII-A"
  grade: string; // e.g. "VII", "VIII", "IX", "X", "XI", "XII", or "I"-"VI"
  academicYearId: string;
  homeroomTeacherId: string;
  homeroomTeacherName: string;
  homeroomTeacherEmail?: string;
  homeroomTeacherUid?: string;
  qrToken?: string;
  qrGeneratedAt?: string;
  isActive: boolean;
}

export interface ClassQrCodeRegistry {
  classId: string;
  className: string;
  grade: string;
  homeroomTeacherName: string;
  homeroomTeacherUid: string;
  qrToken: string;
  isActive: boolean;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  classId: string;
  homeroomTeacherEmail?: string;
  parentName: string;
  parentWhatsapp: string;
  isActive: boolean;
  address?: string;
}

export interface DailyAttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  homeroomTeacherEmail?: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
  attachmentUrl?: string; // Base64 Data URL of uploaded photo proof (surat sakit/izin/foto bukti)
  attachmentName?: string;
  attachmentUploadedAt?: string;
  recordedBy: string;
  recordedByUid?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TeachingAttendanceRecord {
  id: string;
  classId: string;
  className: string;
  qrToken: string;
  homeroomTeacherUid: string;
  homeroomTeacherEmail: string;
  teacherName: string;
  teacherNip?: string;
  subject: string;
  lessonPeriod?: string;
  date: string; // YYYY-MM-DD
  arrivalTime: string; // HH:mm
  completedTime?: string; // HH:mm
  arrivalTimestampMs: number;
  completedTimestampMs?: number;
  durationMinutes?: number;
  status: 'mengajar' | 'selesai';
  arrivalNote?: string;
  closingNote?: string;
  recordedByUid: string;
  recordedByEmail: string;
}

export interface AttendanceCorrectionLog {
  id: string;
  studentId: string;
  studentName: string;
  classId?: string;
  homeroomTeacherEmail?: string;
  date: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  changedBy: string;
  changedByName: string;
  timestamp: string;
}

export interface StudentMonthlyRecap {
  student: Student;
  month: number; // 1-12
  year: number;
  effectiveDays: number;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  attendancePercentage: number; // 2 decimal places: (hadir / effectiveDays) * 100
  isDataComplete: boolean;
  unrecordedDays: number;
}

export interface ClassMonthlySummary {
  classId: string;
  className: string;
  month: number;
  year: number;
  effectiveDays: number;
  totalStudents: number;
  totalHadir: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpa: number;
  averagePercentage: number;
  incompleteStudentCount: number;
  recaps: StudentMonthlyRecap[];
}

export interface ReportArchiveItem {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  homeroomTeacherEmail?: string;
  month: number;
  year: number;
  academicYear: string;
  effectiveDays: number;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  percentage: number;
  createdAt: string;
  createdByName: string;
  createdByUid?: string;
  version: number;
  customNote?: string;
  deliveryStatus: 'belum_dikirim' | 'terkirim' | 'gagal';
  lastDeliveredAt?: string;
  parentWhatsapp: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  userId: string;
  userName: string;
  timestamp: string;
}
