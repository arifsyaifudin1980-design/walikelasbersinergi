import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  Plus,
  QrCode,
  RefreshCw,
  School,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {
  AcademicCalendarEvent,
  AcademicYear,
  AttendanceCorrectionLog,
  AuditLog,
  DailyAttendanceRecord,
  MadrasahProfile,
  ReportArchiveItem,
  Role,
  SchoolClass,
  Student,
  User,
} from '../../types';
import { ClassQrPosterModal } from '../teaching/ClassQrManagerView';

export type OPMSection =
  | 'overview'
  | 'students'
  | 'classes'
  | 'academic_years'
  | 'calendar'
  | 'users'
  | 'audit';

interface OPMDashboardProps {
  section: OPMSection;
  onNavigateSection: (section: OPMSection | string) => void;
  currentUser: User;
  madrasah: MadrasahProfile;
  classes: SchoolClass[];
  students: Student[];
  users: User[];
  academicYears: AcademicYear[];
  calendarEvents: AcademicCalendarEvent[];
  attendanceRecords: DailyAttendanceRecord[];
  archives: ReportArchiveItem[];
  correctionLogs: AttendanceCorrectionLog[];
  auditLogs: AuditLog[];
  // Student CRUD
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onImportStudents: (
    students: Omit<Student, 'id'>[]
  ) => Promise<{ added: number; skipped: number }> | { added: number; skipped: number };
  // Class CRUD
  onAddClass: (newClass: Omit<SchoolClass, 'id'>) => void;
  onUpdateClass: (updatedClass: SchoolClass) => void;
  onDeleteClass: (id: string) => void;
  onRegenerateClassQr?: (schoolClass: SchoolClass) => Promise<void>;
  // Academic Year CRUD
  onAddAcademicYear: (year: Omit<AcademicYear, 'id'>) => void;
  onSetActiveAcademicYear: (id: string) => void;
  onDeleteAcademicYear: (id: string) => void;
  // Calendar CRUD
  onAddCalendarEvent: (event: Omit<AcademicCalendarEvent, 'id'>) => void;
  onUpdateCalendarEvent: (event: AcademicCalendarEvent) => void;
  onDeleteCalendarEvent: (id: string) => void;
  // User CRUD
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
}

export const OPMDashboard: React.FC<OPMDashboardProps> = ({
  section,
  onNavigateSection,
  currentUser,
  madrasah,
  classes,
  students,
  users,
  academicYears,
  calendarEvents,
  attendanceRecords,
  archives,
  correctionLogs,
  auditLogs,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onImportStudents,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onRegenerateClassQr,
  onAddAcademicYear,
  onSetActiveAcademicYear,
  onDeleteAcademicYear,
  onAddCalendarEvent,
  onUpdateCalendarEvent,
  onDeleteCalendarEvent,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [auditTab, setAuditTab] = useState<'corrections' | 'system'>('corrections');
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [qrPreviewClass, setQrPreviewClass] = useState<SchoolClass | null>(null);

  // Student Add/Edit Modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    nis: '',
    nisn: '',
    gender: 'L' as 'L' | 'P',
    classId: '',
    parentName: '',
    parentWhatsapp: '',
    address: '',
  });
  const studentCsvRef = useRef<HTMLInputElement>(null);

  // Class Add/Edit Modal
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [classForm, setClassForm] = useState({
    name: '',
    grade: 'VII',
    academicYearId: '',
    homeroomTeacherId: '',
  });

  // Academic Year Modal
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [yearForm, setYearForm] = useState({
    year: '2026/2027',
    semester: 'Ganjil' as 'Ganjil' | 'Genap',
    startDate: '2026-07-13',
    endDate: '2026-12-19',
    isActive: true,
  });

  // Calendar Event Modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    title: '',
    type: 'libur_madrasah' as AcademicCalendarEvent['type'],
    isEffective: false,
  });

  // User Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showModalPin, setShowModalPin] = useState(false);
  const [revealedPinIds, setRevealedPinIds] = useState<Record<string, boolean>>({});
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    accessPin: '',
    email: '',
    role: 'wali_kelas' as Role,
    nip: '',
    assignedClassId: '',
    isActive: true,
  });

  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(null), 4000);
  };

  const activeYear = useMemo(
    () => academicYears.find((y) => y.isActive) || academicYears[0],
    [academicYears]
  );

  const waliKelasUsers = useMemo(
    () => users.filter((u) => u.role === 'wali_kelas' && u.isActive),
    [users]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.nisn.toLowerCase().includes(q);
      const matchesClass = selectedClassFilter === 'all' || s.classId === selectedClassFilter;
      return matchesSearch && matchesClass;
    });
  }, [students, searchQuery, selectedClassFilter]);

  // === STUDENT HANDLERS ===
  const openAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({
      name: '',
      nis: '',
      nisn: '',
      gender: 'L',
      classId: classes[0]?.id || '',
      parentName: '',
      parentWhatsapp: '',
      address: '',
    });
    setStudentModalOpen(true);
  };

  const openEditStudent = (s: Student) => {
    setEditingStudent(s);
    setStudentForm({
      name: s.name,
      nis: s.nis,
      nisn: s.nisn,
      gender: s.gender,
      classId: s.classId,
      parentName: s.parentName,
      parentWhatsapp: s.parentWhatsapp,
      address: s.address || '',
    });
    setStudentModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.nis.trim() || !studentForm.classId) return;
    if (editingStudent) {
      onUpdateStudent({
        ...editingStudent,
        ...studentForm,
      });
      showNotice(`Data siswa "${studentForm.name}" diperbarui.`);
    } else {
      onAddStudent({
        ...studentForm,
        isActive: true,
      });
      showNotice(`Siswa "${studentForm.name}" berhasil ditambahkan.`);
    }
    setStudentModalOpen(false);
  };

  const handleDownloadStudentTemplate = () => {
    const firstClass = classes[0]?.name || 'VII-A';
    const csv =
      `nis,nisn,nama_lengkap,L/P,kelas,nama_orang_tua,whatsapp_ortu,alamat\n` +
      `2601001,0110000001,Contoh Nama Siswa,L,${firstClass},Nama Wali,6281234567890,Alamat Siswa\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_impor_siswa.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportStudentsCsv = () => {
    const header = 'nis,nisn,nama_lengkap,L/P,kelas,nama_orang_tua,whatsapp_ortu,alamat\n';
    const rows = filteredStudents
      .map((s) => {
        const clsName = classes.find((c) => c.id === s.classId)?.name || '';
        return `${s.nis},${s.nisn},"${s.name}",${s.gender},"${clsName}","${s.parentName}",${s.parentWhatsapp},"${s.address || ''}"`;
      })
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data_siswa_madrasah.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportStudentsCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed: Omit<Student, 'id'>[] = [];
    lines.forEach((line, idx) => {
      const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (idx === 0 && cols[0].toLowerCase() === 'nis') return;
      const [nis, nisn, name, genderRaw, className, parentName, parentWhatsapp, address] = cols;
      if (!nis || !name) return;
      const matchedClass =
        classes.find((c) => c.name.toLowerCase() === (className || '').toLowerCase()) ||
        classes[0];
      if (!matchedClass) return;

      parsed.push({
        nis,
        nisn: nisn || '-',
        name,
        gender: genderRaw?.toUpperCase() === 'P' ? 'P' : 'L',
        classId: matchedClass.id,
        parentName: parentName || '-',
        parentWhatsapp: parentWhatsapp || '',
        address: address || '',
        isActive: true,
      });
    });

    const result = await onImportStudents(parsed);
    showNotice(
      `Impor selesai: ${result.added} siswa ditambahkan, ${result.skipped} dilewati (duplikat/tidak valid).`
    );
  };

  // === CLASS HANDLERS ===
  const openAddClass = () => {
    setEditingClass(null);
    setClassForm({
      name: '',
      grade: 'VII',
      academicYearId: activeYear?.id || '',
      homeroomTeacherId: waliKelasUsers[0]?.id || '',
    });
    setClassModalOpen(true);
  };

  const openEditClass = (c: SchoolClass) => {
    setEditingClass(c);
    setClassForm({
      name: c.name,
      grade: c.grade,
      academicYearId: c.academicYearId,
      homeroomTeacherId: c.homeroomTeacherId,
    });
    setClassModalOpen(true);
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name.trim()) return;
    const teacher = users.find((u) => u.id === classForm.homeroomTeacherId);
    const homeroomTeacherName = teacher ? teacher.name : '';

    if (editingClass) {
      onUpdateClass({
        ...editingClass,
        name: classForm.name.trim(),
        grade: classForm.grade,
        academicYearId: classForm.academicYearId,
        homeroomTeacherId: classForm.homeroomTeacherId,
        homeroomTeacherName,
      });
      showNotice(`Kelas "${classForm.name}" diperbarui.`);
    } else {
      onAddClass({
        name: classForm.name.trim(),
        grade: classForm.grade,
        academicYearId: classForm.academicYearId,
        homeroomTeacherId: classForm.homeroomTeacherId,
        homeroomTeacherName,
        isActive: true,
      });
      showNotice(`Kelas "${classForm.name}" ditambahkan.`);
    }
    setClassModalOpen(false);
  };

  // === ACADEMIC YEAR HANDLERS ===
  const handleSaveYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearForm.year.trim()) return;
    onAddAcademicYear(yearForm);
    setYearModalOpen(false);
    showNotice(`Tahun Pelajaran ${yearForm.year} Semester ${yearForm.semester} ditambahkan.`);
  };

  // === CALENDAR HANDLERS ===
  const openAddEvent = () => {
    setEditingEvent(null);
    setEventForm({
      date: new Date().toISOString().slice(0, 10),
      title: '',
      type: 'libur_madrasah',
      isEffective: false,
    });
    setEventModalOpen(true);
  };

  const openEditEvent = (ev: AcademicCalendarEvent) => {
    setEditingEvent(ev);
    setEventForm({
      date: ev.date,
      title: ev.title,
      type: ev.type,
      isEffective: ev.isEffective,
    });
    setEventModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.date) return;
    if (editingEvent) {
      onUpdateCalendarEvent({ ...editingEvent, ...eventForm });
      showNotice(`Agenda "${eventForm.title}" diperbarui.`);
    } else {
      onAddCalendarEvent(eventForm);
      showNotice(`Agenda "${eventForm.title}" ditambahkan.`);
    }
    setEventModalOpen(false);
  };

  const generateRandomPin = () => String(Math.floor(100000 + Math.random() * 900000));

  // === USER HANDLERS ===
  const openAddUser = () => {
    setEditingUser(null);
    setShowModalPin(true);
    setUserForm({
      name: '',
      username: '',
      accessPin: generateRandomPin(),
      email: '',
      role: 'wali_kelas',
      nip: '',
      assignedClassId: classes[0]?.id || '',
      isActive: true,
    });
    setUserModalOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setShowModalPin(false);
    setUserForm({
      name: u.name,
      username: u.username,
      accessPin: u.accessPin || (u.role === 'wali_kelas' ? generateRandomPin() : ''),
      email: u.email || '',
      role: u.role,
      nip: u.nip || '',
      assignedClassId: u.assignedClassId || '',
      isActive: u.isActive,
    });
    setUserModalOpen(true);
  };

  const handleCopyWaliLogin = async (u: User, className?: string) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const text = [
      `Akses Login Wali Kelas — ${madrasah.name.trim() || 'Presensi Pintar Madrasah'}`,
      className ? `Kelas: ${className}` : '',
      `Nama: ${u.name}`,
      `Username: ${u.username}`,
      `PIN / Password: ${u.accessPin || '(Belum diatur Admin)'}`,
      appUrl ? `Link Portal: ${appUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showNotice(`Info login "${u.name}" disalin ke clipboard.`);
    } catch {
      showNotice(`Username: ${u.username} · PIN: ${u.accessPin || '-'}`);
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim()) return;
    const rawUsername =
      userForm.username.trim() ||
      userForm.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30) ||
      `user_${Date.now().toString(36)}`;
    const cleanUsername = rawUsername.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
    const cleanPin =
      userForm.role === 'wali_kelas'
        ? userForm.accessPin.trim() || generateRandomPin()
        : '';
    const cleanEmail = userForm.email.trim();
    if (editingUser) {
      onUpdateUser({
        ...editingUser,
        ...userForm,
        username: cleanUsername,
        accessPin: cleanPin,
        email: cleanEmail,
        assignedClassId: userForm.role === 'wali_kelas' ? userForm.assignedClassId : undefined,
      });
      showNotice(`Akun "${userForm.name}" diperbarui.`);
    } else {
      onAddUser({
        ...userForm,
        username: cleanUsername,
        accessPin: cleanPin,
        email: cleanEmail,
        assignedClassId: userForm.role === 'wali_kelas' ? userForm.assignedClassId : undefined,
      });
      showNotice(`Akun "${userForm.name}" berhasil dibuat.`);
    }
    setUserModalOpen(false);
  };

  // Checklist for initial empty state setup
  const setupChecklist = [
    {
      label: 'Lengkapi Profil & Unggah Logo Madrasah',
      done: Boolean(madrasah.name.trim() && madrasah.logoUrl),
      target: 'opm_settings',
    },
    {
      label: 'Buat Tahun Pelajaran Aktif',
      done: academicYears.some((y) => y.isActive),
      target: 'opm_academic_years',
    },
    {
      label: 'Buat Akun Wali Kelas',
      done: users.some((u) => u.role === 'wali_kelas'),
      target: 'opm_users',
    },
    {
      label: 'Tambah Data Kelas & Penugasan Wali',
      done: classes.length > 0,
      target: 'opm_classes',
    },
    {
      label: 'Tambah atau Impor Data Siswa',
      done: students.length > 0,
      target: 'opm_students',
    },
  ];

  return (
    <div className="space-y-6">
      {noticeMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between">
          <span>{noticeMessage}</span>
          <button
            type="button"
            onClick={() => setNoticeMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION: OVERVIEW */}
      {section === 'overview' &&
        (() => {
          const now = new Date();
          const hour = now.getHours();
          const greeting =
            hour < 11
              ? 'Selamat Pagi'
              : hour < 15
              ? 'Selamat Siang'
              : hour < 18
              ? 'Selamat Sore'
              : 'Selamat Malam';
          const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
            2,
            '0'
          )}-${String(now.getDate()).padStart(2, '0')}`;
          const todayLabel = now.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });

          const todayRecords = attendanceRecords.filter((r) => r.date === todayIso);
          const todayRecordedStudents = new Set(todayRecords.map((r) => r.studentId)).size;
          const todayCoveragePct =
            students.length > 0 ? Math.round((todayRecordedStudents / students.length) * 100) : 0;

          const assignedClassCount = classes.filter((c) => Boolean(c.homeroomTeacherId)).length;
          const deliveredArchivesCount = archives.filter(
            (a) => a.deliveryStatus === 'terkirim'
          ).length;

          // Overall attendance status breakdown from real records
          const statusTotals = attendanceRecords.reduce(
            (acc, r) => {
              if (r.status === 'H') acc.H++;
              else if (r.status === 'S') acc.S++;
              else if (r.status === 'I') acc.I++;
              else if (r.status === 'A') acc.A++;
              return acc;
            },
            { H: 0, S: 0, I: 0, A: 0 }
          );
          const totalAttRecords =
            statusTotals.H + statusTotals.S + statusTotals.I + statusTotals.A;

          const maxClassStudentCount = Math.max(
            ...classes.map((c) => students.filter((s) => s.classId === c.id).length),
            1
          );

          const doneCount = setupChecklist.filter((i) => i.done).length;
          const progressPct = Math.round((doneCount / setupChecklist.length) * 100);

          // Combined real activity timeline (auditLogs + correctionLogs)
          const recentActivities = [
            ...auditLogs.map((log) => ({
              id: `aud_${log.id}`,
              title: log.action,
              description: log.details,
              actor: log.userName,
              timestamp: log.timestamp,
              kind: 'system' as const,
            })),
            ...correctionLogs.map((log) => ({
              id: `cor_${log.id}`,
              title: `Koreksi Presensi (${log.previousStatus} ➔ ${log.newStatus})`,
              description: `${log.studentName} · ${log.date} — ${log.reason}`,
              actor: log.changedByName,
              timestamp: log.timestamp,
              kind: 'correction' as const,
            })),
          ]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 6);

          return (
            <div className="space-y-6">
              {/* Executive Welcome Banner (Deep Navy Architectural Hero) */}
              <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-7 shadow-xs border border-[#142844]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300 font-medium">
                      <span className="text-emerald-400 font-semibold">
                        {madrasah.name.trim() || 'Presensi Pintar Madrasah'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{todayLabel}</span>
                      {activeYear && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            TA {activeYear.year} ({activeYear.semester})
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-balance">
                      {greeting}, {currentUser.name}
                    </h2>
                    <p className="text-xs sm:text-[13px] text-slate-300/90 leading-relaxed">
                      Pantau kesiapan data madrasah, progres input presensi harian kelas, dan riwayat aktivitas administrasi dari satu pusat kendali.
                    </p>
                  </div>

                  {/* Quick Operational Launchers */}
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigateSection('attendance_matrix')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-emerald text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Input Presensi Hari Ini</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateSection('opm_qr_classes')}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      <span>Barcode QR Kelas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateSection('opm_settings')}
                      className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Settings className="w-4 h-4 text-slate-300" />
                      <span>Profil Madrasah</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4-Column Executive KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="surface-card p-5 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500">Total Siswa Aktif</div>
                      <div className="text-2xl font-bold text-[#0B192C] mt-1 tabular-nums">
                        {students.length}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-[#0B192C] flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>Tersebar di {classes.length} kelas</span>
                    <button
                      type="button"
                      onClick={() => onNavigateSection('opm_students')}
                      className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Kelola
                    </button>
                  </div>
                </div>

                <div className="surface-card p-5 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500">Kelas &amp; Wali Kelas</div>
                      <div className="text-2xl font-bold text-[#0B192C] mt-1 tabular-nums">
                        {classes.length}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-[#0B192C] flex items-center justify-center shrink-0">
                      <School className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>
                      {assignedClassCount}/{classes.length} kelas terisi wali
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigateSection('opm_classes')}
                      className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Atur
                    </button>
                  </div>
                </div>

                <div className="surface-card p-5 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500">Presensi Hari Ini</div>
                      <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                        {todayCoveragePct}%
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${todayCoveragePct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                      <span>
                        {todayRecordedStudents} dari {students.length} siswa tercatat
                      </span>
                    </div>
                  </div>
                </div>

                <div className="surface-card p-5 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500">Arsip Laporan JPG</div>
                      <div className="text-2xl font-bold text-[#0B192C] mt-1 tabular-nums">
                        {archives.length}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 text-[#0B192C] flex items-center justify-center shrink-0">
                      <Archive className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                    <span>{deliveredArchivesCount} terkirim WhatsApp</span>
                    <button
                      type="button"
                      onClick={() => onNavigateSection('archives')}
                      className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Buka
                    </button>
                  </div>
                </div>
              </div>

              {/* Asymmetric 12-Column Analytics & Operations Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 7 Cols: Attendance Statistics Chart & Class Distribution */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Statistik Kehadiran & Populasi Kelas */}
                  <div className="surface-card p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#0B192C] flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-emerald-700" />
                          <span>Statistik Kehadiran &amp; Populasi Kelas</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Akumulasi seluruh catatan kehadiran yang tersimpan serta sebaran siswa per kelas.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                        {totalAttRecords} Entri Presensi
                      </span>
                    </div>

                    {/* Global H / S / I / A Proportional Stacked Distribution */}
                    <div className="p-4 rounded-xl bg-[#F6F8FB] border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#0B192C]">
                          Distribusi Status Kehadiran Keseluruhan
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {totalAttRecords > 0
                            ? `${Math.round((statusTotals.H / totalAttRecords) * 100)}% Hadir`
                            : 'Belum ada catatan'}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden flex">
                        {totalAttRecords > 0 && (
                          <>
                            <div
                              className="bg-emerald-600 h-full"
                              style={{ width: `${(statusTotals.H / totalAttRecords) * 100}%` }}
                              title={`Hadir: ${statusTotals.H}`}
                            />
                            <div
                              className="bg-amber-500 h-full"
                              style={{ width: `${(statusTotals.S / totalAttRecords) * 100}%` }}
                              title={`Sakit: ${statusTotals.S}`}
                            />
                            <div
                              className="bg-blue-600 h-full"
                              style={{ width: `${(statusTotals.I / totalAttRecords) * 100}%` }}
                              title={`Izin: ${statusTotals.I}`}
                            />
                            <div
                              className="bg-rose-600 h-full"
                              style={{ width: `${(statusTotals.A / totalAttRecords) * 100}%` }}
                              title={`Alpa: ${statusTotals.A}`}
                            />
                          </>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 shrink-0" />
                          <span className="text-slate-600">Hadir:</span>
                          <strong className="text-[#0B192C]">{statusTotals.H}</strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
                          <span className="text-slate-600">Sakit:</span>
                          <strong className="text-[#0B192C]">{statusTotals.S}</strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 shrink-0" />
                          <span className="text-slate-600">Izin:</span>
                          <strong className="text-[#0B192C]">{statusTotals.I}</strong>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 shrink-0" />
                          <span className="text-slate-600">Alpa:</span>
                          <strong className="text-[#0B192C]">{statusTotals.A}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Class Bar Distribution */}
                    {classes.length === 0 ? (
                      <div className="py-10 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                        <School className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
                        <div className="text-xs font-bold text-[#0B192C]">
                          Belum Ada Rombongan Belajar
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                          Tambahkan kelas dan siswa terlebih dahulu untuk melihat grafik populasi dan cakupan presensi per kelas.
                        </p>
                        <button
                          type="button"
                          onClick={() => onNavigateSection('opm_classes')}
                          className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg btn-navy text-xs font-semibold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Buat Kelas Pertama</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span>Sebaran Siswa &amp; Cakupan Hari Ini per Kelas</span>
                          <button
                            type="button"
                            onClick={() => onNavigateSection('opm_classes')}
                            className="text-emerald-700 hover:underline cursor-pointer"
                          >
                            Kelola Kelas
                          </button>
                        </div>
                        <div className="space-y-3">
                          {classes.map((cls) => {
                            const clsStudents = students.filter((s) => s.classId === cls.id);
                            const clsTodayRecorded = new Set(
                              todayRecords
                                .filter((r) => r.classId === cls.id)
                                .map((r) => r.studentId)
                            ).size;
                            const barWidth = Math.round(
                              (clsStudents.length / maxClassStudentCount) * 100
                            );
                            return (
                              <div key={cls.id} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-bold text-[#0B192C]">
                                      Kelas {cls.name}
                                    </span>
                                    <span className="text-[11px] text-slate-400 truncate">
                                      · {cls.homeroomTeacherName || 'Wali belum diatur'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-mono tabular-nums text-slate-600 shrink-0">
                                    <strong className="text-[#0B192C]">{clsStudents.length}</strong>{' '}
                                    siswa · hari ini {clsTodayRecorded}/{clsStudents.length}
                                  </div>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#0B192C] rounded-full transition-all duration-300"
                                    style={{ width: `${Math.max(barWidth, clsStudents.length > 0 ? 6 : 0)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ringkasan Tabel Kelas Terdaftar */}
                  <div className="surface-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#0B192C]">Daftar Kelas Terdaftar</h3>
                      <button
                        type="button"
                        onClick={() => onNavigateSection('opm_classes')}
                        className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        Lihat Semua
                      </button>
                    </div>
                    {classes.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        Belum ada kelas terdaftar.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                            <tr>
                              <th className="py-2.5 px-4">Nama Kelas</th>
                              <th className="py-2.5 px-4">Tingkat</th>
                              <th className="py-2.5 px-4">Wali Kelas</th>
                              <th className="py-2.5 px-4 text-right">Siswa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {classes.map((c) => {
                              const count = students.filter((s) => s.classId === c.id).length;
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-2.5 px-4 font-bold text-[#0B192C]">{c.name}</td>
                                  <td className="py-2.5 px-4 text-slate-600">Tingkat {c.grade}</td>
                                  <td className="py-2.5 px-4 text-slate-700">
                                    {c.homeroomTeacherName || (
                                      <span className="text-slate-400 italic">Belum ditetapkan</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-[#0B192C]">
                                    {count}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right 5 Cols: Setup Checklist + Recent Activity + System Condition */}
                <div className="lg:col-span-5 space-y-6">
                  {/* 1. Panduan Penyiapan Sistem */}
                  <div className="surface-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#0B192C]">
                          Kesiapan Operasional Madrasah
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Langkah penyiapan modul inti sistem presensi.
                        </p>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 tabular-nums shrink-0">
                        {doneCount}/{setupChecklist.length} ({progressPct}%)
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="divide-y divide-slate-100">
                      {setupChecklist.map((item) => (
                        <div
                          key={item.label}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CheckCircle2
                              className={`w-4 h-4 shrink-0 ${
                                item.done ? 'text-emerald-600' : 'text-slate-300'
                              }`}
                            />
                            <span
                              className={`truncate ${
                                item.done
                                  ? 'text-slate-600 font-medium'
                                  : 'font-semibold text-[#0B192C]'
                              }`}
                            >
                              {item.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigateSection(item.target)}
                            className={`px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 text-[11px] ${
                              item.done
                                ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                                : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.done ? 'Kelola' : 'Atur'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Panel Aktivitas Terbaru */}
                  <div className="surface-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#0B192C] flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-700" />
                        <span>Aktivitas Terbaru</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => onNavigateSection('opm_audit')}
                        className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        Lihat Log
                      </button>
                    </div>

                    {recentActivities.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        <Clock className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                        Belum ada aktivitas sistem atau koreksi presensi yang tercatat.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {recentActivities.map((act) => (
                          <div key={act.id} className="px-5 py-3 text-xs space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-[#0B192C]">{act.title}</span>
                              <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                                {new Date(act.timestamp).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {act.description}
                            </p>
                            <div className="text-[11px] text-slate-400">Oleh: {act.actor}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Informasi Kondisi Sistem */}
                  <div className="surface-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#0B192C] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>Kondisi &amp; Konfigurasi Sistem</span>
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100 text-xs">
                      <div className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-slate-500">Profil &amp; Logo Madrasah</span>
                        <span
                          className={`font-semibold ${
                            madrasah.name.trim() && madrasah.logoUrl
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {madrasah.name.trim() && madrasah.logoUrl
                            ? 'Lengkap'
                            : madrasah.name.trim()
                            ? 'Logo belum diunggah'
                            : 'Belum diatur'}
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-slate-500">Tahun Pelajaran Aktif</span>
                        <span className="font-semibold text-[#0B192C] tabular-nums">
                          {activeYear ? `${activeYear.year} · ${activeYear.semester}` : 'Belum ada'}
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-slate-500">Akun Wali Kelas Aktif</span>
                        <span className="font-semibold text-[#0B192C] tabular-nums">
                          {waliKelasUsers.length} Akun
                        </span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between gap-2">
                        <span className="text-slate-500">Agenda Kalender Terdaftar</span>
                        <span className="font-semibold text-[#0B192C] tabular-nums">
                          {calendarEvents.length} Agenda
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* SECTION: STUDENTS */}
      {section === 'students' && (
        <div className="surface-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B192C]">Master Data Siswa</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola biodata siswa, kelas, dan nomor WhatsApp orang tua untuk distribusi laporan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={studentCsvRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportStudentsCsv}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleDownloadStudentTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-[#0B192C] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template CSV</span>
              </button>
              <button
                type="button"
                onClick={() => studentCsvRef.current?.click()}
                disabled={classes.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-[#0B192C] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-700" />
                <span>Impor CSV</span>
              </button>
              {students.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportStudentsCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-[#0B192C] text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor</span>
                </button>
              )}
              <button
                type="button"
                onClick={openAddStudent}
                disabled={classes.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-navy disabled:opacity-50 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Tambah Siswa</span>
              </button>
            </div>
          </div>

          {classes.length === 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex flex-wrap items-center justify-between gap-2">
              <span>Buat minimal 1 kelas terlebih dahulu sebelum menambahkan data siswa.</span>
              <button
                type="button"
                onClick={() => onNavigateSection('opm_classes')}
                className="font-semibold underline cursor-pointer"
              >
                Ke Menu Kelas
              </button>
            </div>
          )}

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama, NIS, atau NISN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="app-input pl-9"
              />
            </div>

            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="app-input sm:w-52 bg-slate-50 font-medium cursor-pointer"
            >
              <option value="all">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto mb-3">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-[#0B192C]">Belum Ada Data Siswa</div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tambahkan siswa secara manual atau impor daftar siswa sekaligus menggunakan berkas CSV.
              </p>
              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={openAddStudent}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl btn-navy text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Tambah Siswa Pertama</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Student Cards (< md) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredStudents.map((s) => {
                  const sClass = classes.find((c) => c.id === s.classId);
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 truncate">{s.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                            NIS {s.nis} · {s.gender} · Kelas {sClass?.name || '-'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditStudent(s)}
                            className="p-2 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer"
                            title="Edit Siswa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteStudent(s.id);
                              showNotice(`Siswa "${s.name}" dihapus.`);
                            }}
                            className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="Hapus Siswa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate pr-2">Wali: {s.parentName || '-'}</span>
                        <span className="font-mono tabular-nums shrink-0">
                          {s.parentWhatsapp ? `+${s.parentWhatsapp}` : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Student Table (md+) */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3">Nama Siswa</th>
                      <th className="py-2.5 px-3">NIS / NISN</th>
                      <th className="py-2.5 px-3">L/P</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">Orang Tua / Wali</th>
                      <th className="py-2.5 px-3">WhatsApp</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((s, idx) => {
                      const sClass = classes.find((c) => c.id === s.classId);
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{s.name}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                            {s.nis} / {s.nisn || '-'}
                          </td>
                          <td className="py-2.5 px-3">{s.gender}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-700">
                            {sClass?.name || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{s.parentName || '-'}</td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                            {s.parentWhatsapp ? `+${s.parentWhatsapp}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditStudent(s)}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer"
                                title="Edit Siswa"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteStudent(s.id);
                                  showNotice(`Siswa "${s.name}" dihapus.`);
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                                title="Hapus Siswa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* SECTION: CLASSES */}
      {section === 'classes' && (
        <div className="surface-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B192C]">
                Manajemen Kelas &amp; Penugasan Wali Kelas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Buat rombongan belajar, tugaskan wali kelas, serta generate poster Barcode QR untuk absensi guru.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateSection('opm_qr_classes')}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B192C] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <QrCode className="w-4 h-4 text-emerald-700" />
                <span>Semua Barcode QR</span>
              </button>
              <button
                type="button"
                onClick={openAddClass}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl btn-navy text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Tambah Kelas</span>
              </button>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto mb-3">
                <School className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-[#0B192C]">Belum Ada Data Kelas</div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Buat kelas baru seperti VII-A, VIII-B, atau X-1 untuk mengelompokkan siswa dan menugaskan wali kelas.
              </p>
              <button
                type="button"
                onClick={openAddClass}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl btn-navy text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Tambah Kelas Pertama</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Class Cards (< md) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {classes.map((cls) => {
                  const ay = academicYears.find((y) => y.id === cls.academicYearId);
                  const count = students.filter((s) => s.classId === cls.id).length;
                  return (
                    <div
                      key={cls.id}
                      className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900">Kelas {cls.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            Tingkat {cls.grade} • {ay ? `${ay.year} (${ay.semester})` : 'Tahun pelajaran belum diatur'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setQrPreviewClass(cls)}
                            className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                            title="Barcode QR Kelas"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditClass(cls)}
                            className="p-2 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer"
                            title="Edit Kelas"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteClass(cls.id);
                              showNotice(`Kelas "${cls.name}" dihapus.`);
                            }}
                            className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="Hapus Kelas"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 truncate pr-2">
                          Wali: <strong className="text-slate-800">{cls.homeroomTeacherName || 'Belum ditetapkan'}</strong>
                        </span>
                        <span className="font-semibold text-emerald-700 tabular-nums shrink-0">
                          {count} Siswa
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Class Table (md+) */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Nama Kelas</th>
                      <th className="py-2.5 px-4">Tingkat</th>
                      <th className="py-2.5 px-4">Tahun Pelajaran</th>
                      <th className="py-2.5 px-4">Wali Kelas</th>
                      <th className="py-2.5 px-4 text-right">Siswa</th>
                      <th className="py-2.5 px-4 text-center">Barcode QR</th>
                      <th className="py-2.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map((cls) => {
                      const ay = academicYears.find((y) => y.id === cls.academicYearId);
                      const count = students.filter((s) => s.classId === cls.id).length;
                      return (
                        <tr key={cls.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{cls.name}</td>
                          <td className="py-3 px-4 text-slate-600">Tingkat {cls.grade}</td>
                          <td className="py-3 px-4 text-slate-600 tabular-nums">
                            {ay ? `${ay.year} (${ay.semester})` : '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium">
                            {cls.homeroomTeacherName || (
                              <span className="text-slate-400 italic">Belum ditetapkan</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold tabular-nums">
                            {count}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setQrPreviewClass(cls)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-semibold cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Lihat QR</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditClass(cls)}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer"
                                title="Edit Kelas"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteClass(cls.id);
                                  showNotice(`Kelas "${cls.name}" dihapus.`);
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                                title="Hapus Kelas"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* SECTION: ACADEMIC YEARS */}
      {section === 'academic_years' && (
        <div className="surface-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B192C]">Tahun Pelajaran &amp; Semester</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tetapkan periode tahun pelajaran dan semester yang sedang berjalan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setYearModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl btn-navy text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tambah Tahun Pelajaran</span>
            </button>
          </div>

          {academicYears.length === 0 ? (
            <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-[#0B192C]">Belum Ada Tahun Pelajaran</div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tambahkan tahun pelajaran dan semester aktif untuk memulai pencatatan dan arsip laporan.
              </p>
              <button
                type="button"
                onClick={() => setYearModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl btn-navy text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Tambah Tahun Pelajaran</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Academic Years Cards (< md) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {academicYears.map((y) => (
                  <div
                    key={y.id}
                    className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-slate-900 tabular-nums">
                          {y.year} · Semester {y.semester}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                          {y.startDate} s.d. {y.endDate}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          y.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {y.isActive ? 'Aktif Berjalan' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                      {!y.isActive && (
                        <button
                          type="button"
                          onClick={() => onSetActiveAcademicYear(y.id)}
                          className="px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold cursor-pointer"
                        >
                          Aktifkan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteAcademicYear(y.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Academic Years Table (md+) */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Tahun Pelajaran</th>
                      <th className="py-2.5 px-4">Semester</th>
                      <th className="py-2.5 px-4">Rentang Tanggal</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {academicYears.map((y) => (
                      <tr key={y.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">{y.year}</td>
                        <td className="py-3 px-4 text-slate-700">{y.semester}</td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                          {y.startDate} s.d. {y.endDate}
                        </td>
                        <td className="py-3 px-4">
                          {y.isActive ? (
                            <span className="text-emerald-700 font-semibold">Aktif Berjalan</span>
                          ) : (
                            <span className="text-slate-400">Nonaktif</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            {!y.isActive && (
                              <button
                                type="button"
                                onClick={() => onSetActiveAcademicYear(y.id)}
                                className="px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold cursor-pointer"
                              >
                                Aktifkan
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteAcademicYear(y.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* SECTION: CALENDAR */}
      {section === 'calendar' && (
        <div className="surface-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B192C]">
                Kalender Akademik &amp; Penentuan Hari Efektif
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hari libur yang ditandai non-efektif otomatis dikecualikan dari pembagi persentase kehadiran.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddEvent}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl btn-navy text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tambah Agenda / Libur</span>
            </button>
          </div>

          {calendarEvents.length === 0 ? (
            <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-[#0B192C]">Belum Ada Agenda Kalender</div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tambahkan hari libur nasional, libur madrasah, atau kegiatan khusus agar perhitungan hari efektif akurat.
              </p>
              <button
                type="button"
                onClick={openAddEvent}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl btn-navy text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Tambah Agenda Pertama</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Calendar Cards (< md) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {calendarEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-semibold text-slate-500 tabular-nums">
                          {ev.date} · <span className="capitalize">{ev.type.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900 mt-0.5">{ev.title}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditEvent(ev)}
                          className="p-2 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer"
                          title="Edit Agenda"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteCalendarEvent(ev.id);
                            showNotice(`Agenda "${ev.title}" dihapus.`);
                          }}
                          className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Hapus Agenda"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 text-[11px]">
                      {ev.isEffective ? (
                        <span className="text-emerald-700 font-semibold">Hari Efektif</span>
                      ) : (
                        <span className="text-rose-600 font-semibold">Libur (Non-Efektif)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Calendar Table (md+) */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Tanggal</th>
                      <th className="py-2.5 px-4">Nama Agenda / Hari Libur</th>
                      <th className="py-2.5 px-4">Kategori</th>
                      <th className="py-2.5 px-4">Status Hari Efektif</th>
                      <th className="py-2.5 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calendarEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900">
                          {ev.date}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{ev.title}</td>
                        <td className="py-2.5 px-4 capitalize text-slate-600">
                          {ev.type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-4">
                          {ev.isEffective ? (
                            <span className="text-emerald-700 font-semibold">Hari Efektif</span>
                          ) : (
                            <span className="text-rose-600 font-semibold">Libur (Non-Efektif)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditEvent(ev)}
                              className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer"
                              title="Edit Agenda"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteCalendarEvent(ev.id);
                                showNotice(`Agenda "${ev.title}" dihapus.`);
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                              title="Hapus Agenda"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* SECTION: USERS */}
      {section === 'users' && (
        <div className="surface-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B192C]">
                Manajemen Akun Pengguna (Admin &amp; Wali Kelas)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Buat akun &amp; PIN akses agar setiap Wali Kelas dapat login mandiri dari perangkat masing-masing untuk mengelola kelasnya.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddUser}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl btn-navy text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tambah Akun</span>
            </button>
          </div>

          {/* Mobile User Cards (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {users.map((u) => {
              const uClass = classes.find((c) => c.id === u.assignedClassId);
              const isSelf = u.id === currentUser.id;
              const isRevealed = Boolean(revealedPinIds[u.id]);
              return (
                <div
                  key={u.id}
                  className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">{u.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 truncate">
                        @{u.username} {u.nip ? `· NIP ${u.nip}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {u.role === 'wali_kelas' && (
                        <button
                          type="button"
                          onClick={() => void handleCopyWaliLogin(u, uClass?.name)}
                          className="p-2 text-slate-500 hover:text-[#0B192C] rounded-lg hover:bg-slate-100 cursor-pointer"
                          title="Salin Info Login"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditUser(u)}
                        className="p-2 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer"
                        title="Edit Akun"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteUser(u.id);
                            showNotice(`Akun "${u.name}" dihapus.`);
                          }}
                          className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {u.role === 'wali_kelas' && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px]">
                      <div className="font-mono text-slate-700 truncate">
                        PIN:{' '}
                        {u.accessPin ? (
                          <strong className="text-[#0B192C]">
                            {isRevealed ? u.accessPin : '••••••'}
                          </strong>
                        ) : (
                          <span className="text-amber-700 font-sans">Belum diatur</span>
                        )}
                      </div>
                      {u.accessPin && (
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedPinIds((prev) => ({ ...prev, [u.id]: !isRevealed }))
                          }
                          className="text-slate-500 hover:text-[#0B192C] cursor-pointer"
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">
                      {u.role === 'opm' ? 'Administrator / OPM' : `Wali Kelas (${uClass?.name || '-'})`}
                    </span>
                    <button
                      type="button"
                      disabled={isSelf}
                      onClick={() => onUpdateUser({ ...u, isActive: !u.isActive })}
                      className={`font-semibold cursor-pointer disabled:cursor-not-allowed ${
                        u.isActive ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop User Table (md+) */}
          <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Nama &amp; Username</th>
                  <th className="py-2.5 px-4">Akses Masuk (PIN / Google)</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Kelas Ditugaskan</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const uClass = classes.find((c) => c.id === u.assignedClassId);
                  const isSelf = u.id === currentUser.id;
                  const isRevealed = Boolean(revealedPinIds[u.id]);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          @{u.username}
                          {u.nip ? ` · NIP ${u.nip}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        {u.role === 'opm' ? (
                          <span className="font-mono text-slate-700">{u.email || 'Google Admin'}</span>
                        ) : u.accessPin ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="font-mono text-[11px] px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-[#0B192C] font-semibold tabular-nums">
                              {isRevealed ? u.accessPin : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedPinIds((prev) => ({ ...prev, [u.id]: !isRevealed }))
                              }
                              className="p-1 text-slate-400 hover:text-[#0B192C] cursor-pointer"
                              title={isRevealed ? 'Sembunyikan PIN' : 'Lihat PIN'}
                            >
                              {isRevealed ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyWaliLogin(u, uClass?.name)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-[#0B192C] cursor-pointer"
                              title="Salin username & PIN untuk dibagikan ke Wali Kelas"
                            >
                              <Copy className="w-3 h-3 text-emerald-700" />
                              <span>Salin</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditUser(u)}
                            className="text-[11px] text-amber-700 font-semibold hover:underline cursor-pointer"
                          >
                            Belum ada PIN · Atur Sekarang
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {u.role === 'opm' ? 'Administrator / OPM' : 'Wali Kelas'}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-emerald-700">
                        {u.role === 'wali_kelas' ? uClass?.name || '-' : 'Semua Kelas'}
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => onUpdateUser({ ...u, isActive: !u.isActive })}
                          className={`font-semibold cursor-pointer disabled:cursor-not-allowed ${
                            u.isActive ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                          title={isSelf ? 'Akun sedang aktif digunakan' : 'Klik untuk ubah status'}
                        >
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditUser(u)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 cursor-pointer"
                            title="Edit Akun"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteUser(u.id);
                                showNotice(`Akun "${u.name}" dihapus.`);
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                              title="Hapus Akun"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: AUDIT & LOG AKTIVITAS */}
      {section === 'audit' && (
        <div className="surface-card p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#0B192C]">Audit Koreksi &amp; Log Aktivitas</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Seluruh koreksi presensi dan aktivitas konfigurasi tercatat dengan waktu dan pelaku.
              </p>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setAuditTab('corrections')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap tabular-nums ${
                  auditTab === 'corrections'
                    ? 'bg-[#0B192C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                Koreksi Presensi ({correctionLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setAuditTab('system')}
                className={`px-3.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors whitespace-nowrap tabular-nums ${
                  auditTab === 'system'
                    ? 'bg-[#0B192C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                Log Aktivitas ({auditLogs.length})
              </button>
            </div>
          </div>

          {auditTab === 'corrections' ? (
            correctionLogs.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40 text-xs text-slate-500">
                Belum ada riwayat koreksi status presensi.
              </div>
            ) : (
              <>
                {/* Mobile Corrections Cards (< md) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {correctionLogs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-200 p-4 space-y-1.5 bg-white text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{log.studentName}</span>
                        <span className="font-semibold shrink-0">
                          <span className="text-slate-500">{log.previousStatus}</span>
                          <span className="mx-1 text-slate-400">➔</span>
                          <span className="text-emerald-700">{log.newStatus}</span>
                        </span>
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500">
                        Tanggal Presensi: {log.date}
                      </div>
                      <p className="text-[11px] text-slate-700 pt-1">{log.reason}</p>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Oleh: {log.changedByName}</span>
                        <span className="tabular-nums">{new Date(log.timestamp).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Corrections Table (md+) */}
                <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Perubahan</th>
                        <th className="py-2.5 px-3">Alasan</th>
                        <th className="py-2.5 px-3">Pengubah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {correctionLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 tabular-nums whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {log.studentName}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums">{log.date}</td>
                          <td className="py-2.5 px-3 font-semibold">
                            <span className="text-slate-500">{log.previousStatus}</span>
                            <span className="mx-1.5 text-slate-400">➔</span>
                            <span className="text-emerald-700">{log.newStatus}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{log.reason}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {log.changedByName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          ) : auditLogs.length === 0 ? (
            <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40 text-xs text-slate-500">
              Belum ada aktivitas sistem yang tercatat.
            </div>
          ) : (
            <>
              {/* Mobile System Activity Cards (< md) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {auditLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-200 p-4 space-y-1.5 bg-white text-xs">
                    <div className="font-bold text-slate-900">{log.action}</div>
                    <p className="text-[11px] text-slate-700">{log.details}</p>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{log.userName}</span>
                      <span className="tabular-nums">{new Date(log.timestamp).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop System Activity Table (md+) */}
              <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Waktu</th>
                      <th className="py-2.5 px-3">Aksi</th>
                      <th className="py-2.5 px-3">Rincian</th>
                      <th className="py-2.5 px-3">Pengguna</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 tabular-nums whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{log.action}</td>
                        <td className="py-2.5 px-3 text-slate-700">{log.details}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{log.userName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT STUDENT */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B192C]">
                {editingStudent ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setStudentModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveStudent}>
              <div className="p-6 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    className="app-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NIS *</label>
                    <input
                      type="text"
                      required
                      value={studentForm.nis}
                      onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })}
                      className="app-input font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NISN</label>
                    <input
                      type="text"
                      value={studentForm.nisn}
                      onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                      className="app-input font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                    <select
                      value={studentForm.gender}
                      onChange={(e) =>
                        setStudentForm({ ...studentForm, gender: e.target.value as 'L' | 'P' })
                      }
                      className="app-input"
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kelas *</label>
                    <select
                      required
                      value={studentForm.classId}
                      onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
                      className="app-input"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Orang Tua / Wali</label>
                  <input
                    type="text"
                    value={studentForm.parentName}
                    onChange={(e) => setStudentForm({ ...studentForm, parentName: e.target.value })}
                    className="app-input"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp Orang Tua</label>
                  <input
                    type="text"
                    value={studentForm.parentWhatsapp}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, parentWhatsapp: e.target.value })
                    }
                    placeholder="6281234567890"
                    className="app-input font-mono tabular-nums"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-emerald font-semibold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CLASS */}
      {classModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B192C]">
                {editingClass ? 'Edit Kelas' : 'Tambah Kelas Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setClassModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveClass}>
              <div className="p-6 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Kelas *</label>
                    <input
                      type="text"
                      required
                      value={classForm.name}
                      onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                      placeholder="Contoh: VII-A"
                      className="app-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tingkat</label>
                    <select
                      value={classForm.grade}
                      onChange={(e) => setClassForm({ ...classForm, grade: e.target.value })}
                      className="app-input"
                    >
                      {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'].map(
                        (g) => (
                          <option key={g} value={g}>
                            Tingkat {g}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahun Pelajaran</label>
                  <select
                    value={classForm.academicYearId}
                    onChange={(e) => setClassForm({ ...classForm, academicYearId: e.target.value })}
                    className="app-input"
                  >
                    <option value="">-- Pilih Tahun Pelajaran --</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.year} - {y.semester}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Wali Kelas</label>
                  <select
                    value={classForm.homeroomTeacherId}
                    onChange={(e) =>
                      setClassForm({ ...classForm, homeroomTeacherId: e.target.value })
                    }
                    className="app-input"
                  >
                    <option value="">-- Belum Ditetapkan --</option>
                    {waliKelasUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  {waliKelasUsers.length === 0 && (
                    <p className="text-[11px] text-amber-700 mt-1.5">
                      Belum ada akun Wali Kelas. Tambahkan di menu Akun Pengguna agar dapat dipilih di sini.
                    </p>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-emerald font-semibold cursor-pointer"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACADEMIC YEAR */}
      {yearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B192C]">Tambah Tahun Pelajaran</h3>
              <button
                type="button"
                onClick={() => setYearModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveYear}>
              <div className="p-6 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tahun Pelajaran *</label>
                    <input
                      type="text"
                      required
                      value={yearForm.year}
                      onChange={(e) => setYearForm({ ...yearForm, year: e.target.value })}
                      placeholder="2026/2027"
                      className="app-input font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Semester</label>
                    <select
                      value={yearForm.semester}
                      onChange={(e) =>
                        setYearForm({ ...yearForm, semester: e.target.value as 'Ganjil' | 'Genap' })
                      }
                      className="app-input"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Mulai</label>
                    <input
                      type="date"
                      required
                      value={yearForm.startDate}
                      onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                      className="app-input tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Selesai</label>
                    <input
                      type="date"
                      required
                      value={yearForm.endDate}
                      onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                      className="app-input tabular-nums"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={yearForm.isActive}
                    onChange={(e) => setYearForm({ ...yearForm, isActive: e.target.checked })}
                  />
                  <span className="font-medium text-slate-700">Jadikan Tahun Pelajaran Aktif</span>
                </label>
              </div>
              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setYearModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-emerald font-semibold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CALENDAR EVENT */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B192C]">
                {editingEvent ? 'Edit Agenda Kalender' : 'Tambah Agenda / Hari Libur'}
              </h3>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEvent}>
              <div className="p-6 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    className="app-input tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Agenda / Libur *</label>
                  <input
                    type="text"
                    required
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    placeholder="Contoh: Libur Hari Raya"
                    className="app-input"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={eventForm.type}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        type: e.target.value as AcademicCalendarEvent['type'],
                      })
                    }
                    className="app-input"
                  >
                    <option value="libur_nasional">Libur Nasional</option>
                    <option value="libur_madrasah">Libur Madrasah</option>
                    <option value="libur_semester">Libur Semester</option>
                    <option value="kegiatan_khusus">Kegiatan Khusus</option>
                    <option value="non_efektif">Hari Non-Efektif</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eventForm.isEffective}
                    onChange={(e) => setEventForm({ ...eventForm, isEffective: e.target.checked })}
                  />
                  <span className="font-medium text-slate-700">
                    Tetap dihitung sebagai hari efektif belajar
                  </span>
                </label>
              </div>
              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-emerald font-semibold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT USER */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0B192C]">
                {editingUser ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="p-6 space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    placeholder="Contoh: Ust. Hasanudin, S.Pd"
                    className="app-input"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Username Login {userForm.role === 'wali_kelas' ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      placeholder="contoh: wali_7a"
                      className="app-input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Role</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
                      className="app-input"
                    >
                      <option value="wali_kelas">Wali Kelas</option>
                      <option value="opm">Administrator / OPM</option>
                    </select>
                  </div>
                </div>

                {userForm.role === 'wali_kelas' && (
                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-[#0B192C] flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                        <span>PIN / Password Masuk Wali Kelas *</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowModalPin(true);
                          setUserForm({ ...userForm, accessPin: generateRandomPin() });
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Acak PIN</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showModalPin ? 'text' : 'password'}
                        required
                        minLength={4}
                        maxLength={32}
                        value={userForm.accessPin}
                        onChange={(e) => setUserForm({ ...userForm, accessPin: e.target.value })}
                        placeholder="Minimal 4 karakter / 6 digit angka"
                        className="app-input font-mono pr-10 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalPin((s) => !s)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-[#0B192C] cursor-pointer"
                      >
                        {showModalPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Wali Kelas login langsung di portal menggunakan <strong>Username</strong> dan{' '}
                      <strong>PIN/Password</strong> ini tanpa perlu akun Google.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NIP</label>
                    <input
                      type="text"
                      value={userForm.nip}
                      onChange={(e) => setUserForm({ ...userForm, nip: e.target.value })}
                      className="app-input font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Email Google (Opsional)
                    </label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      placeholder="Opsional"
                      className="app-input font-mono"
                    />
                  </div>
                </div>

                {userForm.role === 'wali_kelas' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Penugasan Kelas *</label>
                    <select
                      value={userForm.assignedClassId}
                      onChange={(e) =>
                        setUserForm({ ...userForm, assignedClassId: e.target.value })
                      }
                      className="app-input"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-emerald font-semibold cursor-pointer"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrPreviewClass && (
        <ClassQrPosterModal
          schoolClass={classes.find((c) => c.id === qrPreviewClass.id) || qrPreviewClass}
          madrasah={madrasah}
          onRegenerateQr={onRegenerateClassQr}
          onClose={() => setQrPreviewClass(null)}
        />
      )}
    </div>
  );
};
