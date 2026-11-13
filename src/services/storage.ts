import {
  AcademicCalendarEvent,
  AcademicYear,
  AttendanceCorrectionLog,
  AttendanceStatus,
  AuditLog,
  ClassMonthlySummary,
  DailyAttendanceRecord,
  MadrasahProfile,
  ReportArchiveItem,
  SchoolClass,
  Student,
  StudentMonthlyRecap,
  User,
} from '../types';

const STORAGE_KEYS = {
  USER: 'presensi_v3_current_user',
  USERS: 'presensi_v3_users',
  MADRASAH: 'presensi_v3_madrasah_profile',
  ACADEMIC_YEARS: 'presensi_v3_academic_years',
  CALENDAR: 'presensi_v3_calendar_events',
  CLASSES: 'presensi_v3_classes',
  STUDENTS: 'presensi_v3_students',
  ATTENDANCE: 'presensi_v3_daily_attendance',
  CORRECTIONS: 'presensi_v3_corrections',
  ARCHIVES: 'presensi_v3_archives',
  AUDIT_LOGS: 'presensi_v3_audit_logs',
};

// Clean empty initial profile (NO AI-generated dummy logo, NO dummy school data)
const INITIAL_MADRASAH: MadrasahProfile = {
  name: '',
  nsm: '',
  npsn: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  headmasterName: '',
  headmasterNip: '',
  city: '',
  logoUrl: '', // Empty container (wadah logo saja) until uploaded by admin
  signatureNoteDefault: '',
};

// Initial system administrator account only (so Admin/OPM can log in and configure real data)
const INITIAL_USERS: User[] = [
  {
    id: 'user_admin',
    username: 'admin',
    password: '123',
    name: 'Administrator (OPM)',
    role: 'opm',
    nip: '',
    isActive: true,
  },
];

// Helper to determine if a date is effective
// Standard 6-day week (Monday to Saturday effective, Sunday is weekend holiday)
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

// Generate effective dates in a month
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

export const storageService = {
  // === AUTH / CURRENT USER ===
  getCurrentUser(): User {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as User;
        const users = this.getUsers();
        const fresh = users.find((u) => u.id === parsed.id && u.isActive);
        if (fresh) return fresh;
      } catch {
        // fallback
      }
    }
    const users = this.getUsers();
    return users[0] || INITIAL_USERS[0];
  },

  setCurrentUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  // === USERS CRUD ===
  getUsers(): User[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  },

  saveUsers(users: User[]): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  addUser(user: Omit<User, 'id'>): User {
    const users = this.getUsers();
    const created: User = { ...user, id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    const updated = [...users, created];
    this.saveUsers(updated);
    this.addAuditLog('Tambah Akun Pengguna', `Akun "${created.name}" (${created.username}) ditambahkan`);
    return created;
  },

  updateUser(updatedUser: User): void {
    const users = this.getUsers();
    const updated = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    this.saveUsers(updated);
    // Sync current user if editing self
    const current = this.getCurrentUser();
    if (current.id === updatedUser.id) {
      this.setCurrentUser(updatedUser);
    }
    this.addAuditLog('Edit Akun Pengguna', `Akun "${updatedUser.name}" diperbarui`);
  },

  deleteUser(userId: string): void {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    const updated = users.filter((u) => u.id !== userId);
    this.saveUsers(updated);
    if (target) {
      this.addAuditLog('Hapus Akun Pengguna', `Akun "${target.name}" dihapus`);
    }
  },

  // === MADRASAH PROFILE ===
  getMadrasahProfile(): MadrasahProfile {
    const raw = localStorage.getItem(STORAGE_KEYS.MADRASAH);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MADRASAH, JSON.stringify(INITIAL_MADRASAH));
      return INITIAL_MADRASAH;
    }
    try {
      return { ...INITIAL_MADRASAH, ...JSON.parse(raw) };
    } catch {
      return INITIAL_MADRASAH;
    }
  },

  saveMadrasahProfile(profile: MadrasahProfile): void {
    localStorage.setItem(STORAGE_KEYS.MADRASAH, JSON.stringify(profile));
    this.addAuditLog(
      'Pembaruan Profil Madrasah',
      `Profil identitas madrasah ${profile.name ? `'${profile.name}'` : ''} diperbarui`
    );
  },

  // === ACADEMIC YEARS CRUD ===
  getAcademicYears(): AcademicYear[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ACADEMIC_YEARS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ACADEMIC_YEARS, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveAcademicYears(years: AcademicYear[]): void {
    localStorage.setItem(STORAGE_KEYS.ACADEMIC_YEARS, JSON.stringify(years));
  },

  addAcademicYear(yearData: Omit<AcademicYear, 'id'>): AcademicYear[] {
    let years = this.getAcademicYears();
    const created: AcademicYear = {
      ...yearData,
      id: `ay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    if (created.isActive) {
      years = years.map((y) => ({ ...y, isActive: false }));
    }
    const updated = [created, ...years];
    this.saveAcademicYears(updated);
    this.addAuditLog('Tambah Tahun Pelajaran', `TA ${created.year} Semester ${created.semester} ditambahkan`);
    return updated;
  },

  setActiveAcademicYear(id: string): AcademicYear[] {
    const years = this.getAcademicYears().map((y) => ({
      ...y,
      isActive: y.id === id,
    }));
    this.saveAcademicYears(years);
    const active = years.find((y) => y.id === id);
    if (active) {
      this.addAuditLog('Aktivasi Tahun Pelajaran', `TA ${active.year} (${active.semester}) diaktifkan`);
    }
    return years;
  },

  deleteAcademicYear(id: string): AcademicYear[] {
    const years = this.getAcademicYears();
    const target = years.find((y) => y.id === id);
    const updated = years.filter((y) => y.id !== id);
    this.saveAcademicYears(updated);
    if (target) {
      this.addAuditLog('Hapus Tahun Pelajaran', `TA ${target.year} (${target.semester}) dihapus`);
    }
    return updated;
  },

  // === CALENDAR EVENTS CRUD ===
  getCalendarEvents(): AcademicCalendarEvent[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CALENDAR);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveCalendarEvents(events: AcademicCalendarEvent[]): void {
    localStorage.setItem(STORAGE_KEYS.CALENDAR, JSON.stringify(events));
  },

  addCalendarEvent(event: Omit<AcademicCalendarEvent, 'id'>): AcademicCalendarEvent[] {
    const events = this.getCalendarEvents();
    const created: AcademicCalendarEvent = {
      ...event,
      id: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    const updated = [...events, created].sort((a, b) => a.date.localeCompare(b.date));
    this.saveCalendarEvents(updated);
    this.addAuditLog('Tambah Kalender Akademik', `${created.date}: ${created.title}`);
    return updated;
  },

  updateCalendarEvent(updatedEvent: AcademicCalendarEvent): AcademicCalendarEvent[] {
    const events = this.getCalendarEvents();
    const updated = events
      .map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
      .sort((a, b) => a.date.localeCompare(b.date));
    this.saveCalendarEvents(updated);
    this.addAuditLog('Edit Kalender Akademik', `${updatedEvent.date}: ${updatedEvent.title}`);
    return updated;
  },

  deleteCalendarEvent(id: string): AcademicCalendarEvent[] {
    const events = this.getCalendarEvents();
    const target = events.find((e) => e.id === id);
    const updated = events.filter((e) => e.id !== id);
    this.saveCalendarEvents(updated);
    if (target) {
      this.addAuditLog('Hapus Kalender Akademik', `${target.date}: ${target.title}`);
    }
    return updated;
  },

  // === CLASSES CRUD ===
  getClasses(): SchoolClass[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASSES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveClasses(classes: SchoolClass[]): void {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  },

  addClass(newClass: Omit<SchoolClass, 'id'>): SchoolClass[] {
    const classes = this.getClasses();
    const created: SchoolClass = {
      ...newClass,
      id: `cls_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    const updated = [...classes, created];
    this.saveClasses(updated);

    // Sync assignedClassId to homeroom teacher user if selected
    if (created.homeroomTeacherId) {
      const users = this.getUsers().map((u) =>
        u.id === created.homeroomTeacherId ? { ...u, assignedClassId: created.id } : u
      );
      this.saveUsers(users);
    }

    this.addAuditLog('Tambah Kelas', `Kelas ${created.name} ditambahkan`);
    return updated;
  },

  updateClass(updatedClass: SchoolClass): SchoolClass[] {
    const classes = this.getClasses();
    const updated = classes.map((c) => (c.id === updatedClass.id ? updatedClass : c));
    this.saveClasses(updated);

    if (updatedClass.homeroomTeacherId) {
      const users = this.getUsers().map((u) =>
        u.id === updatedClass.homeroomTeacherId
          ? { ...u, assignedClassId: updatedClass.id }
          : u.assignedClassId === updatedClass.id
          ? { ...u, assignedClassId: undefined }
          : u
      );
      this.saveUsers(users);
    }

    this.addAuditLog('Edit Kelas', `Kelas ${updatedClass.name} diperbarui`);
    return updated;
  },

  deleteClass(classId: string): SchoolClass[] {
    const classes = this.getClasses();
    const target = classes.find((c) => c.id === classId);
    const updated = classes.filter((c) => c.id !== classId);
    this.saveClasses(updated);
    if (target) {
      this.addAuditLog('Hapus Kelas', `Kelas ${target.name} dihapus`);
    }
    return updated;
  },

  // === STUDENTS CRUD ===
  getStudents(classId?: string): Student[] {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    let students: Student[] = [];
    if (raw) {
      try {
        students = JSON.parse(raw);
      } catch {
        students = [];
      }
    } else {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    }

    if (classId) {
      return students.filter((s) => s.classId === classId && s.isActive);
    }
    return students;
  },

  saveStudents(students: Student[]): void {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  },

  addStudent(student: Omit<Student, 'id'>): Student[] {
    const students = this.getStudents();
    const created: Student = {
      ...student,
      id: `std_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };
    const updated = [...students, created];
    this.saveStudents(updated);
    this.addAuditLog('Tambah Siswa', `Siswa "${created.name}" (NIS: ${created.nis}) ditambahkan`);
    return updated;
  },

  updateStudent(updatedStudent: Student): Student[] {
    const students = this.getStudents();
    const updated = students.map((s) => (s.id === updatedStudent.id ? updatedStudent : s));
    this.saveStudents(updated);
    this.addAuditLog('Edit Siswa', `Data siswa "${updatedStudent.name}" diperbarui`);
    return updated;
  },

  deleteStudent(studentId: string): Student[] {
    const students = this.getStudents();
    const target = students.find((s) => s.id === studentId);
    const updated = students.filter((s) => s.id !== studentId);
    this.saveStudents(updated);
    if (target) {
      this.addAuditLog('Hapus Siswa', `Data siswa "${target.name}" dihapus`);
    }
    return updated;
  },

  importStudentsBatch(newStudents: Omit<Student, 'id'>[]): { added: number; skipped: number; students: Student[] } {
    const existing = this.getStudents();
    const existingNis = new Set(existing.map((s) => s.nis.trim()));
    const toAdd: Student[] = [];
    let skipped = 0;

    newStudents.forEach((s, idx) => {
      if (!s.name.trim() || !s.nis.trim() || existingNis.has(s.nis.trim())) {
        skipped++;
        return;
      }
      existingNis.add(s.nis.trim());
      toAdd.push({
        ...s,
        id: `std_imp_${Date.now()}_${idx}`,
      });
    });

    const updated = [...existing, ...toAdd];
    this.saveStudents(updated);
    this.addAuditLog('Impor Data Siswa', `${toAdd.length} siswa diimpor (${skipped} duplikat/dilewati)`);
    return { added: toAdd.length, skipped, students: updated };
  },

  // === DAILY ATTENDANCE ===
  getAttendance(): DailyAttendanceRecord[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveAttendance(records: DailyAttendanceRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
  },

  setStudentAttendance(
    studentId: string,
    classId: string,
    date: string,
    status: AttendanceStatus,
    user: User,
    options?: {
      reason?: string;
      note?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      removeAttachment?: boolean;
    }
  ): void {
    const records = this.getAttendance();
    const existingIndex = records.findIndex((r) => r.studentId === studentId && r.date === date);
    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      const prevRecord = records[existingIndex];
      const prevStatus = prevRecord.status;

      if (prevStatus !== status) {
        const student = this.getStudents().find((s) => s.id === studentId);
        this.addCorrectionLog({
          id: `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          studentId,
          studentName: student ? student.name : studentId,
          date,
          previousStatus: prevStatus,
          newStatus: status,
          reason: options?.reason || `Perubahan status oleh ${user.name}`,
          changedBy: user.id,
          changedByName: user.name,
          timestamp: nowIso,
        });
      }

      records[existingIndex] = {
        ...prevRecord,
        status,
        note: options?.note !== undefined ? options.note : prevRecord.note,
        attachmentUrl: options?.removeAttachment
          ? undefined
          : options?.attachmentUrl !== undefined
          ? options.attachmentUrl
          : prevRecord.attachmentUrl,
        attachmentName: options?.removeAttachment
          ? undefined
          : options?.attachmentName !== undefined
          ? options.attachmentName
          : prevRecord.attachmentName,
        attachmentUploadedAt: options?.removeAttachment
          ? undefined
          : options?.attachmentUrl
          ? nowIso
          : prevRecord.attachmentUploadedAt,
        updatedAt: nowIso,
      };
    } else {
      records.push({
        id: `att_${studentId}_${date}`,
        studentId,
        classId,
        date,
        status,
        note: options?.note,
        attachmentUrl: options?.attachmentUrl,
        attachmentName: options?.attachmentName,
        attachmentUploadedAt: options?.attachmentUrl ? nowIso : undefined,
        recordedBy: user.id,
        createdAt: nowIso,
      });
    }

    this.saveAttendance(records);
  },

  bulkSetClassAttendance(classId: string, date: string, status: AttendanceStatus, user: User): number {
    const students = this.getStudents(classId);
    let count = 0;
    students.forEach((student) => {
      this.setStudentAttendance(student.id, classId, date, status, user, {
        reason: 'Input cepat kehadiran kelas',
      });
      count++;
    });
    this.addAuditLog('Input Presensi Massal', `${count} siswa kelas diset berstatus ${status} pada ${date}`);
    return count;
  },

  // === CORRECTION LOGS & AUDIT ===
  getCorrectionLogs(): AttendanceCorrectionLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CORRECTIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  addCorrectionLog(log: AttendanceCorrectionLog): void {
    const logs = this.getCorrectionLogs();
    logs.unshift(log);
    localStorage.setItem(STORAGE_KEYS.CORRECTIONS, JSON.stringify(logs));
    this.addAuditLog(
      'Koreksi Presensi',
      `Siswa: ${log.studentName}, Tgl: ${log.date}, Ubah: ${log.previousStatus} -> ${log.newStatus}, Alasan: ${log.reason}`
    );
  },

  // === ARCHIVES ===
  getArchives(): ReportArchiveItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ARCHIVES);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveArchiveItem(item: ReportArchiveItem): void {
    const archives = this.getArchives();
    const existingIdx = archives.findIndex(
      (a) => a.studentId === item.studentId && a.month === item.month && a.year === item.year
    );

    if (existingIdx >= 0) {
      item.version = archives[existingIdx].version + 1;
      archives[existingIdx] = item;
    } else {
      item.version = 1;
      archives.unshift(item);
    }

    localStorage.setItem(STORAGE_KEYS.ARCHIVES, JSON.stringify(archives));
  },

  updateDeliveryStatus(
    studentId: string,
    month: number,
    year: number,
    status: 'terkirim' | 'gagal'
  ): void {
    const archives = this.getArchives();
    const item = archives.find((a) => a.studentId === studentId && a.month === month && a.year === year);
    if (item) {
      item.deliveryStatus = status;
      item.lastDeliveredAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.ARCHIVES, JSON.stringify(archives));
    }
  },

  // === AUDIT LOGS ===
  getAuditLogs(): AuditLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  addAuditLog(action: string, details: string): void {
    const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
    let user: User = INITIAL_USERS[0];
    if (rawUser) {
      try {
        user = JSON.parse(rawUser);
      } catch {
        // fallback
      }
    }
    const logs = this.getAuditLogs();
    logs.unshift({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      action,
      details,
      userId: user.id,
      userName: user.name,
      timestamp: new Date().toISOString(),
    });
    if (logs.length > 300) logs.pop();
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  },

  // === RECAP CALCULATION (PRD Section 9) ===
  calculateClassRecap(classId: string, month: number, year: number): ClassMonthlySummary {
    const classes = this.getClasses();
    const schoolClass = classes.find((c) => c.id === classId);
    const students = classId ? this.getStudents(classId) : [];
    const calendarEvents = this.getCalendarEvents();
    const attendanceRecords = this.getAttendance();

    const effectiveDates = getEffectiveDatesInMonth(year, month, calendarEvents);
    const effectiveDays = effectiveDates.length;

    let totalHadir = 0;
    let totalSakit = 0;
    let totalIzin = 0;
    let totalAlpa = 0;
    let incompleteCount = 0;
    let sumPercentages = 0;

    const recaps: StudentMonthlyRecap[] = students.map((student) => {
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
      students.length > 0 ? Number((sumPercentages / students.length).toFixed(2)) : 0;

    return {
      classId: schoolClass?.id || '',
      className: schoolClass?.name || '-',
      month,
      year,
      effectiveDays,
      totalStudents: students.length,
      totalHadir,
      totalSakit,
      totalIzin,
      totalAlpa,
      averagePercentage,
      incompleteStudentCount: incompleteCount,
      recaps,
    };
  },

  resetAllData(): void {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  },
};
