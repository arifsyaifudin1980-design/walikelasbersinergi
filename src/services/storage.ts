import { auth } from '../firebase';
import {
  AcademicCalendarEvent,
  ClassMonthlySummary,
  DailyAttendanceRecord,
  ReportArchiveItem,
  SchoolClass,
  Student,
  StudentMonthlyRecap,
  User,
} from '../types';
import { firestoreService } from './firestoreService';

/**
 * Helper to determine if a date is effective.
 * Standard 6-day week (Monday to Saturday effective, Sunday is weekend holiday).
 */
export function isDateEffective(dateStr: string, events: AcademicCalendarEvent[]): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return false;
  const dayOfWeek = date.getDay(); // 0 = Sunday

  if (dayOfWeek === 0) {
    return false;
  }

  const matchingEvent = events.find((e) => e.date === dateStr);
  if (matchingEvent && !matchingEvent.isEffective) {
    return false;
  }

  return true;
}

/**
 * Generate effective dates in a month.
 */
export function getEffectiveDatesInMonth(
  year: number,
  month: number,
  events: AcademicCalendarEvent[]
): string[] {
  const effectiveDates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    if (isDateEffective(dateStr, events)) {
      effectiveDates.push(dateStr);
    }
  }

  return effectiveDates;
}

/**
 * Pure calculation for monthly class recap from Firestore-synced arrays.
 */
export function calculateClassRecapFromData(
  classId: string,
  month: number,
  year: number,
  classes: SchoolClass[],
  students: Student[],
  calendarEvents: AcademicCalendarEvent[],
  attendanceRecords: DailyAttendanceRecord[]
): ClassMonthlySummary {
  const schoolClass = classes.find((c) => c.id === classId);
  const activeClassStudents = classId
    ? students.filter((s) => s.classId === classId && s.isActive)
    : [];

  const effectiveDates = getEffectiveDatesInMonth(year, month, calendarEvents);
  const effectiveDays = effectiveDates.length;

  let totalHadir = 0;
  let totalSakit = 0;
  let totalIzin = 0;
  let totalAlpa = 0;
  let incompleteCount = 0;
  let sumPercentages = 0;

  const recaps: StudentMonthlyRecap[] = activeClassStudents.map((student) => {
    const studentMonthRecords = attendanceRecords.filter(
      (r) => r.studentId === student.id && effectiveDates.includes(r.date)
    );

    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;

    studentMonthRecords.forEach((r) => {
      if (r.status === 'H') hadir++;
      else if (r.status === 'S') sakit++;
      else if (r.status === 'I') izin++;
      else if (r.status === 'A') alpa++;
    });

    const recordedDays = hadir + sakit + izin + alpa;
    const unrecordedDays = Math.max(0, effectiveDays - recordedDays);
    const isDataComplete = effectiveDays > 0 && unrecordedDays === 0;

    if (!isDataComplete) {
      incompleteCount++;
    }

    let attendancePercentage = 0;
    if (effectiveDays > 0) {
      attendancePercentage = Number(((hadir / effectiveDays) * 100).toFixed(2));
    }

    totalHadir += hadir;
    totalSakit += sakit;
    totalIzin += izin;
    totalAlpa += alpa;
    sumPercentages += attendancePercentage;

    return {
      student,
      month,
      year,
      effectiveDays,
      hadir,
      sakit,
      izin,
      alpa,
      attendancePercentage,
      isDataComplete,
      unrecordedDays,
    };
  });

  const averagePercentage =
    activeClassStudents.length > 0
      ? Number((sumPercentages / activeClassStudents.length).toFixed(2))
      : 0;

  return {
    classId: schoolClass?.id || '',
    className: schoolClass?.name || '-',
    month,
    year,
    effectiveDays,
    totalStudents: activeClassStudents.length,
    totalHadir,
    totalSakit,
    totalIzin,
    totalAlpa,
    averagePercentage,
    incompleteStudentCount: incompleteCount,
    recaps,
  };
}

/**
 * Bridge service for components calling archive/delivery/audit updates directly.
 */
function getStoredWaliSession(): { userId: string; classSecret: string } | null {
  try {
    const raw = localStorage.getItem('ppm_wali_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; classSecret?: string };
    if (parsed.userId) {
      return { userId: parsed.userId, classSecret: parsed.classSecret || '' };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export const storageService = {
  calculateClassRecap(
    classId: string,
    month: number,
    year: number,
    classes: SchoolClass[] = [],
    students: Student[] = [],
    calendarEvents: AcademicCalendarEvent[] = [],
    attendanceRecords: DailyAttendanceRecord[] = []
  ): ClassMonthlySummary {
    return calculateClassRecapFromData(
      classId,
      month,
      year,
      classes,
      students,
      calendarEvents,
      attendanceRecords
    );
  },

  async saveArchiveItem(
    item: ReportArchiveItem,
    existingArchives: ReportArchiveItem[] = [],
    classes: SchoolClass[] = []
  ): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await firestoreService.saveArchiveItem(item, existingArchives, classes, uid);
      return;
    }
    const wali = getStoredWaliSession();
    if (!wali) return;
    await firestoreService.saveArchiveItem(
      item,
      existingArchives,
      classes,
      wali.userId,
      wali.classSecret
    );
  },

  async updateDeliveryStatus(
    studentId: string,
    month: number,
    year: number,
    status: 'terkirim' | 'gagal'
  ): Promise<void> {
    if (auth.currentUser?.uid) {
      await firestoreService.updateDeliveryStatus(studentId, month, year, status);
      return;
    }
    const wali = getStoredWaliSession();
    if (!wali?.classSecret) return;
    await firestoreService.updateDeliveryStatus(
      studentId,
      month,
      year,
      status,
      wali.classSecret
    );
  },

  async addAuditLog(action: string, details: string, actor?: User): Promise<void> {
    const authUser = auth.currentUser;
    if (!authUser) return;
    const fallbackActor: User = actor || {
      id: authUser.uid,
      username: authUser.email || 'staff',
      name: authUser.displayName || authUser.email || 'Pengguna',
      role: 'wali_kelas',
      isActive: true,
    };
    await firestoreService.addAuditLog(action, details, fallbackActor, authUser.uid);
  },
};
