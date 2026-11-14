import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseAuthUser } from 'firebase/auth';
import { AlertCircle, X } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  AcademicCalendarEvent,
  AcademicYear,
  AttendanceCorrectionLog,
  AttendanceStatus,
  AuditLog,
  DailyAttendanceRecord,
  MadrasahProfile,
  ReportArchiveItem,
  SchoolClass,
  Student,
  StudentMonthlyRecap,
  TeachingAttendanceRecord,
  User,
} from './types';
import {
  EMPTY_MADRASAH,
  firestoreService,
  formatDateYYYYMMDD,
  ResolvedAuthProfile,
} from './services/firestoreService';
import { calculateClassRecapFromData } from './services/storage';
import { EntryPortal } from './components/auth/EntryPortal';
import { TeachingQRScanner } from './components/teaching/TeachingQRScanner';
import { ClassQrManagerView } from './components/teaching/ClassQrManagerView';
import { TeachingRecapView } from './components/teaching/TeachingRecapView';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { WaliKelasDashboard } from './components/dashboard/WaliKelasDashboard';
import { OPMDashboard, OPMSection } from './components/dashboard/OPMDashboard';
import { AttendanceMatrix } from './components/attendance/AttendanceMatrix';
import { ReportArchiveView } from './components/archive/ReportArchiveView';
import { HostingerDeploymentView } from './components/hostinger/HostingerDeploymentView';
import { MadrasahSettingsView } from './components/master/MadrasahSettingsView';
import { MadrasahProfileModal } from './components/master/MadrasahProfileModal';
import { ReportPreviewModal } from './components/reports/ReportPreviewModal';
import { BatchExportModal } from './components/reports/BatchExportModal';
import { OfflineIndicator } from './components/common/OfflineIndicator';

interface ReportModalContext {
  recap: StudentMonthlyRecap;
  className: string;
  homeroomTeacherName: string;
  homeroomTeacherNip?: string;
}

type PortalView = 'portal' | 'scanner' | 'app';

const TAB_META: Record<string, { title: string; section: string }> = {
  opm_overview: { title: 'Ringkasan Sistem', section: 'Utama' },
  dashboard: { title: 'Dashboard Kelas', section: 'Utama' },
  attendance_matrix: { title: 'Input Presensi & Foto', section: 'Utama' },
  teaching_recap: { title: 'Rekap Guru Mengajar', section: 'Utama' },
  opm_students: { title: 'Data Siswa', section: 'Master Data' },
  opm_classes: { title: 'Kelas & Wali Kelas', section: 'Master Data' },
  opm_qr_classes: { title: 'Barcode QR Kelas', section: 'Master Data' },
  opm_academic_years: { title: 'Tahun Pelajaran', section: 'Master Data' },
  opm_calendar: { title: 'Kalender Akademik', section: 'Master Data' },
  opm_users: { title: 'Akun Pengguna', section: 'Administrasi' },
  opm_audit: { title: 'Audit & Log Aktivitas', section: 'Administrasi' },
  opm_settings: { title: 'Profil & Logo Madrasah', section: 'Administrasi' },
  archives: { title: 'Arsip Laporan JPG', section: 'Laporan' },
  hostinger: { title: 'Ekspor Hostinger', section: 'Laporan' },
};

const OPM_TAB_TO_SECTION: Record<string, OPMSection> = {
  opm_overview: 'overview',
  opm_students: 'students',
  opm_classes: 'classes',
  opm_academic_years: 'academic_years',
  opm_calendar: 'calendar',
  opm_users: 'users',
  opm_audit: 'audit',
};

export default function App() {
  // === AUTHENTICATION & ENTRY PORTAL STATE ===
  const [portalView, setPortalView] = useState<PortalView>('portal');
  const [authUser, setAuthUser] = useState<FirebaseAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resolvedProfile, setResolvedProfile] = useState<ResolvedAuthProfile | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const enterAppAfterLoginRef = useRef<boolean>(false);
  const syncedQrClassIdsRef = useRef<Set<string>>(new Set());

  // === CLOUD FIRESTORE REAL-TIME STATE ===
  const [madrasah, setMadrasah] = useState<MadrasahProfile>(EMPTY_MADRASAH);
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<DailyAttendanceRecord[]>([]);
  const [teachingRecords, setTeachingRecords] = useState<TeachingAttendanceRecord[]>([]);
  const [correctionLogs, setCorrectionLogs] = useState<AttendanceCorrectionLog[]>([]);
  const [archives, setArchives] = useState<ReportArchiveItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // === NAVIGATION & PERIOD STATE ===
  const now = new Date();
  const [activeTab, setActiveTab] = useState<string>('opm_overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedClassIdForMatrix, setSelectedClassIdForMatrix] = useState<string>('');

  // === MODAL STATES ===
  const [reportModalContext, setReportModalContext] = useState<ReportModalContext | null>(null);
  const [showBatchExportModal, setShowBatchExportModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  // Listen to Firebase Authentication State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setAuthUser(fbUser);
      setAuthError(null);
      if (!fbUser) {
        setResolvedProfile(null);
        setPreviewUserId(null);
        setUsers([]);
        setClasses([]);
        setStudents([]);
        setAcademicYears([]);
        setCalendarEvents([]);
        setAttendanceRecords([]);
        setTeachingRecords([]);
        setCorrectionLogs([]);
        setArchives([]);
        setAuditLogs([]);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);
      try {
        const resolved = await firestoreService.resolveUserSession(fbUser);
        setResolvedProfile(resolved);
        setPreviewUserId(null);

        if (resolved.isAdmin || resolved.isBoundStaff) {
          setActiveTab(resolved.appUser?.role === 'opm' ? 'opm_overview' : 'dashboard');
          if (enterAppAfterLoginRef.current) {
            setPortalView('app');
            enterAppAfterLoginRef.current = false;
          }
        } else {
          enterAppAfterLoginRef.current = false;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memverifikasi akun Google Anda.';
        setAuthError(msg);
        enterAppAfterLoginRef.current = false;
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Subscribe to Firestore Cloud Collections once staff session is verified
  useEffect(() => {
    if (!resolvedProfile || (!resolvedProfile.isAdmin && !resolvedProfile.isBoundStaff)) {
      return;
    }

    const unsub = firestoreService.subscribePortalData(resolvedProfile, {
      onMadrasah: setMadrasah,
      onUsers: setUsers,
      onAcademicYears: setAcademicYears,
      onCalendarEvents: setCalendarEvents,
      onClasses: (list) => {
        setClasses(list);
        setSelectedClassIdForMatrix((prev) =>
          prev && list.some((c) => c.id === prev) ? prev : list[0]?.id || ''
        );
      },
      onStudents: setStudents,
      onAttendance: setAttendanceRecords,
      onTeachingAttendance: setTeachingRecords,
      onCorrections: setCorrectionLogs,
      onArchives: setArchives,
      onAuditLogs: setAuditLogs,
      onError: (err) => {
        setActionError(`Sinkronisasi cloud terganggu: ${err.message}`);
      },
    });

    return () => unsub();
  }, [resolvedProfile]);

  // Admin background sync: ensure all classes have QR registry & backfill Wali Kelas UID onto teaching records
  useEffect(() => {
    if (!resolvedProfile?.isAdmin || !authUser || classes.length === 0) return;
    const unsynced = classes.filter(
      (c) => !c.qrToken || !syncedQrClassIdsRef.current.has(c.id)
    );
    if (unsynced.length > 0) {
      unsynced.forEach((c) => syncedQrClassIdsRef.current.add(c.id));
      void firestoreService.ensureClassQrRegistries(unsynced, authUser.uid);
    }
  }, [resolvedProfile?.isAdmin, authUser, classes]);

  useEffect(() => {
    if (!resolvedProfile?.isAdmin || classes.length === 0 || teachingRecords.length === 0) return;
    void firestoreService.syncMissingTeachingHomeroomUid(classes, teachingRecords);
  }, [resolvedProfile?.isAdmin, classes, teachingRecords]);

  // Trigger Google Login Popup
  const handleGoogleLogin = async (enterDashboardOnSuccess: boolean) => {
    setAuthError(null);
    enterAppAfterLoginRef.current = enterDashboardOnSuccess;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      enterAppAfterLoginRef.current = false;
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        return;
      }
      setAuthError('Login Google dibatalkan atau gagal. Pastikan pop-up diizinkan browser.');
    }
  };

  const handleSignOut = async () => {
    enterAppAfterLoginRef.current = false;
    await signOut(auth);
    setPortalView('portal');
  };

  // Effective Active User (real auth user, or Admin previewing a Wali Kelas account)
  const currentUser: User = useMemo(() => {
    if (resolvedProfile?.isAdmin && previewUserId) {
      const preview = users.find((u) => u.id === previewUserId && u.isActive);
      if (preview) return preview;
    }
    return (
      resolvedProfile?.appUser || {
        id: authUser?.uid || 'guest',
        username: authUser?.email || 'user',
        name: authUser?.displayName || 'Pengguna Madrasah',
        role: 'wali_kelas',
        isActive: true,
      }
    );
  }, [resolvedProfile, previewUserId, users, authUser]);

  const actorForLogs: User = useMemo(
    () => resolvedProfile?.appUser || currentUser,
    [resolvedProfile?.appUser, currentUser]
  );

  // Resolve active class for current role
  const effectiveMatrixClassId = useMemo(() => {
    if (currentUser.role === 'wali_kelas') {
      return currentUser.assignedClassId || '';
    }
    if (selectedClassIdForMatrix && classes.some((c) => c.id === selectedClassIdForMatrix)) {
      return selectedClassIdForMatrix;
    }
    return classes[0]?.id || '';
  }, [currentUser, classes, selectedClassIdForMatrix]);

  const activeClass = useMemo(() => {
    if (currentUser.role === 'wali_kelas') {
      return currentUser.assignedClassId
        ? classes.find((c) => c.id === currentUser.assignedClassId)
        : undefined;
    }
    return classes.find((c) => c.id === effectiveMatrixClassId);
  }, [currentUser, classes, effectiveMatrixClassId]);

  const activeAcademicYear = useMemo(() => {
    return academicYears.find((y) => y.isActive) || academicYears[0];
  }, [academicYears]);

  // Dynamic Class Recap Calculation
  const classRecap = useMemo(() => {
    return calculateClassRecapFromData(
      activeClass?.id || '',
      selectedMonth,
      selectedYear,
      classes,
      students,
      calendarEvents,
      attendanceRecords
    );
  }, [activeClass?.id, selectedMonth, selectedYear, attendanceRecords, calendarEvents, students, classes]);

  const todayTeachingRecordsForActiveClass = useMemo(() => {
    if (!activeClass?.id) return [];
    const todayStr = formatDateYYYYMMDD();
    return teachingRecords.filter((r) => r.classId === activeClass.id && r.date === todayStr);
  }, [teachingRecords, activeClass?.id]);

  // Helper to wrap async cloud mutations
  const runCloudAction = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan perubahan ke database cloud.';
      setActionError(msg);
    }
  };

  // === FIRESTORE CRUD HANDLERS ===
  const handleUpdateAttendance = (
    studentId: string,
    classId: string,
    date: string,
    status: AttendanceStatus,
    options?: {
      reason?: string;
      note?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      removeAttachment?: boolean;
    }
  ) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.setStudentAttendance(
        studentId,
        classId,
        date,
        status,
        actorForLogs,
        authUser.uid,
        classes,
        students,
        attendanceRecords,
        options
      )
    );
  };

  const handleBulkSetHadir = (classId: string, date: string) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.bulkSetClassAttendance(
        classId,
        date,
        'H',
        actorForLogs,
        authUser.uid,
        classes,
        students,
        attendanceRecords
      )
    );
  };

  const handleSwitchUser = (user: User) => {
    if (!resolvedProfile?.isAdmin) return;
    setPreviewUserId(user.id === resolvedProfile.appUser?.id ? null : user.id);
    setActiveTab(user.role === 'opm' ? 'opm_overview' : 'dashboard');
  };

  const handleSaveProfile = (newProfile: MadrasahProfile) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.saveMadrasahProfile(newProfile, actorForLogs, authUser.uid)
    );
  };

  const handleAddStudent = (newStudent: Omit<Student, 'id'>) => {
    if (!authUser) return;
    void runCloudAction(async () => {
      await firestoreService.addStudent(newStudent, classes, actorForLogs, authUser.uid);
    });
  };

  const handleUpdateStudent = (student: Student) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.updateStudent(student, classes, actorForLogs, authUser.uid)
    );
  };

  const handleDeleteStudent = (id: string) => {
    if (!authUser) return;
    const target = students.find((s) => s.id === id);
    if (!target) return;
    void runCloudAction(() =>
      firestoreService.deleteStudent(target, actorForLogs, authUser.uid)
    );
  };

  const handleImportStudents = async (newStudents: Omit<Student, 'id'>[]) => {
    if (!authUser) return { added: 0, skipped: newStudents.length };
    setActionError(null);
    try {
      return await firestoreService.importStudentsBatch(
        newStudents,
        students,
        classes,
        actorForLogs,
        authUser.uid
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengimpor siswa ke cloud.';
      setActionError(msg);
      return { added: 0, skipped: newStudents.length };
    }
  };

  const handleAddClass = (newClass: Omit<SchoolClass, 'id'>) => {
    if (!authUser) return;
    void runCloudAction(async () => {
      const created = await firestoreService.addClass(newClass, users, actorForLogs, authUser.uid);
      syncedQrClassIdsRef.current.add(created.id);
      if (!selectedClassIdForMatrix) {
        setSelectedClassIdForMatrix(created.id);
      }
    });
  };

  const handleUpdateClass = (updatedClass: SchoolClass) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.updateClass(
        updatedClass,
        users,
        students,
        attendanceRecords,
        teachingRecords,
        archives,
        actorForLogs,
        authUser.uid
      )
    );
  };

  const handleDeleteClass = (id: string) => {
    if (!authUser) return;
    const target = classes.find((c) => c.id === id);
    if (!target) return;
    void runCloudAction(() =>
      firestoreService.deleteClass(target, actorForLogs, authUser.uid)
    );
  };

  const handleRegenerateClassQr = async (schoolClass: SchoolClass) => {
    if (!authUser) return;
    await runCloudAction(async () => {
      await firestoreService.regenerateClassQr(schoolClass, actorForLogs, authUser.uid);
    });
  };

  const handleAddAcademicYear = (year: Omit<AcademicYear, 'id'>) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.addAcademicYear(
        year,
        academicYears,
        calendarEvents,
        actorForLogs,
        authUser.uid
      )
    );
  };

  const handleSetActiveAcademicYear = (id: string) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.setActiveAcademicYear(
        id,
        academicYears,
        calendarEvents,
        actorForLogs,
        authUser.uid
      )
    );
  };

  const handleDeleteAcademicYear = (id: string) => {
    if (!authUser) return;
    const target = academicYears.find((y) => y.id === id);
    if (!target) return;
    void runCloudAction(() =>
      firestoreService.deleteAcademicYear(
        target,
        academicYears,
        calendarEvents,
        actorForLogs,
        authUser.uid
      )
    );
  };

  const handleAddCalendarEvent = (event: Omit<AcademicCalendarEvent, 'id'>) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.addCalendarEvent(
        event,
        academicYears,
        calendarEvents,
        actorForLogs,
        authUser.uid
      )
    );
  };

  const handleUpdateCalendarEvent = (event: AcademicCalendarEvent) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.updateCalendarEvent(
        event,
        academicYears,
        calendarEvents,
        actorForLogs,
        authUser.uid
      )
    );
  };

  const handleDeleteCalendarEvent = (id: string) => {
    if (!authUser) return;
    const target = calendarEvents.find((e) => e.id === id);
    if (!target) return;
    void runCloudAction(() =>
      firestoreService.deleteCalendarEvent(
        target,
        academicYears,
        calendarEvents,
        actorForLogs,
        authUser.uid
      )
    );
  };

  const handleAddUser = (user: Omit<User, 'id'>) => {
    if (!authUser) return;
    void runCloudAction(async () => {
      await firestoreService.addUser(user, actorForLogs, authUser.uid);
    });
  };

  const handleUpdateUser = (user: User) => {
    if (!authUser) return;
    void runCloudAction(() =>
      firestoreService.updateUser(user, actorForLogs, authUser.uid)
    );
  };

  const handleDeleteUser = (id: string) => {
    if (!authUser) return;
    const target = users.find((u) => u.id === id);
    if (!target) return;
    void runCloudAction(() =>
      firestoreService.deleteUser(target, actorForLogs, authUser.uid)
    );
  };

  const handleNavigateOPMSection = (target: OPMSection | string) => {
    if (
      target === 'opm_settings' ||
      target === 'attendance_matrix' ||
      target === 'archives' ||
      target === 'opm_qr_classes' ||
      target === 'teaching_recap'
    ) {
      setActiveTab(target);
      return;
    }
    const tabMap: Record<OPMSection, string> = {
      overview: 'opm_overview',
      students: 'opm_students',
      classes: 'opm_classes',
      academic_years: 'opm_academic_years',
      calendar: 'opm_calendar',
      users: 'opm_users',
      audit: 'opm_audit',
    };
    setActiveTab(tabMap[target as OPMSection] || target);
  };

  const handleOpenArchiveReport = (item: ReportArchiveItem) => {
    const targetRecapSummary = calculateClassRecapFromData(
      item.classId,
      item.month,
      item.year,
      classes,
      students,
      calendarEvents,
      attendanceRecords
    );
    const matchedClass = classes.find((c) => c.id === item.classId);
    const matchingRecap = targetRecapSummary.recaps.find((r) => r.student.id === item.studentId);

    const fallbackRecap: StudentMonthlyRecap = matchingRecap || {
      student: {
        id: item.studentId,
        nis: '-',
        nisn: '-',
        name: item.studentName,
        gender: 'L',
        classId: item.classId,
        parentName: 'Orang Tua / Wali',
        parentWhatsapp: item.parentWhatsapp,
        isActive: true,
      },
      month: item.month,
      year: item.year,
      effectiveDays: item.effectiveDays,
      hadir: item.hadir,
      sakit: item.sakit,
      izin: item.izin,
      alpa: item.alpa,
      attendancePercentage: item.percentage,
      isDataComplete: true,
      unrecordedDays: 0,
    };

    const homeroomUser = users.find((u) => u.id === matchedClass?.homeroomTeacherId);

    setReportModalContext({
      recap: fallbackRecap,
      className: matchedClass?.name || item.className,
      homeroomTeacherName:
        matchedClass?.homeroomTeacherName || item.createdByName || currentUser.name,
      homeroomTeacherNip: homeroomUser?.nip || currentUser.nip,
    });
  };

  const activeOPMSection = OPM_TAB_TO_SECTION[activeTab];
  const currentMeta = TAB_META[activeTab] || { title: 'Dashboard', section: 'Aplikasi' };
  const visibleArchives = useMemo(() => {
    if (currentUser.role === 'opm') return archives;
    if (!currentUser.assignedClassId) return [];
    return archives.filter((a) => a.classId === currentUser.assignedClassId);
  }, [archives, currentUser]);

  const isAuthorizedStaff = Boolean(
    resolvedProfile && (resolvedProfile.isAdmin || resolvedProfile.isBoundStaff)
  );

  // === VIEW 1: ENTRY PORTAL (Menu Login + Menu Kamera Scan) ===
  if (portalView === 'portal' || (portalView === 'app' && !isAuthorizedStaff)) {
    return (
      <>
        <EntryPortal
          authUser={authUser}
          authLoading={authLoading}
          authError={authError}
          isAuthorizedStaff={isAuthorizedStaff}
          resolvedRoleLabel={
            resolvedProfile?.isAdmin
              ? 'Administrator / OPM'
              : resolvedProfile?.appUser?.role === 'wali_kelas'
              ? 'Wali Kelas'
              : undefined
          }
          onGoogleLogin={() => handleGoogleLogin(true)}
          onSignOut={handleSignOut}
          onEnterDashboard={() => setPortalView('app')}
          onOpenScanner={() => setPortalView('scanner')}
        />
        <OfflineIndicator />
      </>
    );
  }

  // === VIEW 2: CAMERA QR SCANNER (Guru Ngajar Check-in / Check-out) ===
  if (portalView === 'scanner') {
    return (
      <>
        <TeachingQRScanner
          authUser={authUser}
          onGoogleLogin={() => handleGoogleLogin(false)}
          onBackToPortal={() => setPortalView(isAuthorizedStaff ? 'app' : 'portal')}
        />
        <OfflineIndicator />
      </>
    );
  }

  // === VIEW 3: MAIN ADMIN / WALI KELAS APPLICATION WORKSPACE ===
  return (
    <div className="min-h-screen bg-[#F6F8FB] flex font-sans text-[#0B192C]">
      {/* Persistent Left Sidebar + Mobile Drawer */}
      <Sidebar
        currentUser={currentUser}
        madrasah={madrasah}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenScanner={() => setPortalView('scanner')}
        onBackToPortal={() => setPortalView('portal')}
        onSignOut={() => void handleSignOut()}
      />

      {/* Right Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Topbar
          pageTitle={currentMeta.title}
          breadcrumbSection={currentMeta.section}
          activeAcademicYear={activeAcademicYear}
          currentUser={currentUser}
          authEmail={authUser?.email || undefined}
          canSwitchRoles={Boolean(resolvedProfile?.isAdmin)}
          users={users}
          classes={classes}
          onSwitchUser={handleSwitchUser}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenScanner={() => setPortalView('scanner')}
          onBackToPortal={() => setPortalView('portal')}
          onSignOut={() => void handleSignOut()}
        />

        <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
          {actionError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-rose-700 hover:text-rose-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Wali Kelas Primary Dashboard */}
          {activeTab === 'dashboard' && currentUser.role === 'wali_kelas' && (
            <WaliKelasDashboard
              currentUser={currentUser}
              schoolClass={activeClass}
              madrasah={madrasah}
              recapSummary={classRecap}
              todayTeachingRecords={todayTeachingRecordsForActiveClass}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onChangeMonthYear={(m, y) => {
                setSelectedMonth(m);
                setSelectedYear(y);
              }}
              academicYear={activeAcademicYear?.year || '-'}
              semester={activeAcademicYear?.semester || '-'}
              onSelectStudentReport={(recap) => {
                if (!activeClass) return;
                setReportModalContext({
                  recap,
                  className: activeClass.name,
                  homeroomTeacherName: activeClass.homeroomTeacherName || currentUser.name,
                  homeroomTeacherNip: currentUser.nip,
                });
              }}
              onOpenBatchExport={() => setShowBatchExportModal(true)}
              onGoToMatrix={() => setActiveTab('attendance_matrix')}
              onGoToTeachingRecap={() => setActiveTab('teaching_recap')}
            />
          )}

          {/* OPM Sections */}
          {activeOPMSection && currentUser.role === 'opm' && (
            <OPMDashboard
              section={activeOPMSection}
              onNavigateSection={handleNavigateOPMSection}
              currentUser={currentUser}
              madrasah={madrasah}
              classes={classes}
              students={students}
              users={users}
              academicYears={academicYears}
              calendarEvents={calendarEvents}
              attendanceRecords={attendanceRecords}
              archives={archives}
              correctionLogs={correctionLogs}
              auditLogs={auditLogs}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onImportStudents={handleImportStudents}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onDeleteClass={handleDeleteClass}
              onRegenerateClassQr={handleRegenerateClassQr}
              onAddAcademicYear={handleAddAcademicYear}
              onSetActiveAcademicYear={handleSetActiveAcademicYear}
              onDeleteAcademicYear={handleDeleteAcademicYear}
              onAddCalendarEvent={handleAddCalendarEvent}
              onUpdateCalendarEvent={handleUpdateCalendarEvent}
              onDeleteCalendarEvent={handleDeleteCalendarEvent}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {/* Barcode QR Generator & Poster Printer per Class (Admin) */}
          {activeTab === 'opm_qr_classes' && currentUser.role === 'opm' && (
            <ClassQrManagerView
              classes={classes}
              madrasah={madrasah}
              onRegenerateQr={handleRegenerateClassQr}
              onNavigateToClasses={() => setActiveTab('opm_classes')}
            />
          )}

          {/* Rekap Guru Mengajar (Kedatangan & Selesai Ngajar) */}
          {activeTab === 'teaching_recap' && (
            <TeachingRecapView
              currentUser={currentUser}
              classes={classes}
              teachingRecords={teachingRecords}
              activeClass={activeClass}
              onOpenQrManager={
                currentUser.role === 'opm' ? () => setActiveTab('opm_qr_classes') : undefined
              }
            />
          )}

          {/* Dedicated Madrasah Profile & Logo Upload Settings */}
          {activeTab === 'opm_settings' && currentUser.role === 'opm' && (
            <MadrasahSettingsView
              profile={madrasah}
              onSave={handleSaveProfile}
              onResetAllData={() => void runCloudAction(() => firestoreService.resetAllCloudData())}
            />
          )}

          {/* Daily Attendance Input, Photo Evidence Upload & Monthly Matrix */}
          {activeTab === 'attendance_matrix' && (
            <AttendanceMatrix
              currentUser={currentUser}
              classes={classes}
              selectedClassId={effectiveMatrixClassId}
              onSelectClassId={setSelectedClassIdForMatrix}
              students={students}
              calendarEvents={calendarEvents}
              attendanceRecords={attendanceRecords}
              onUpdateAttendance={handleUpdateAttendance}
              onBulkSetHadir={handleBulkSetHadir}
              onNavigateToMaster={setActiveTab}
            />
          )}

          {/* Archives & Delivery History */}
          {activeTab === 'archives' && (
            <ReportArchiveView
              archives={visibleArchives}
              madrasah={madrasah}
              onPreviewArchive={handleOpenArchiveReport}
              onReshareWhatsApp={handleOpenArchiveReport}
            />
          )}

          {/* Hostinger Production Export Center */}
          {activeTab === 'hostinger' && <HostingerDeploymentView />}
        </main>

        <footer className="bg-white border-t border-slate-200/80 py-3.5 text-xs text-slate-500">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-[#0B192C]">
                {madrasah.name.trim() || 'Presensi Pintar Madrasah'}
              </span>
              {madrasah.nsm ? ` · NSM ${madrasah.nsm}` : ''}
            </div>
            <div className="text-[11px] text-slate-400">
              Platform Monitoring &amp; Laporan Presensi Siswa · Cloud Sync
            </div>
          </div>
        </footer>
      </div>

      {/* Report Preview Modal */}
      {reportModalContext && (
        <ReportPreviewModal
          recap={reportModalContext.recap}
          madrasah={madrasah}
          className={reportModalContext.className}
          homeroomTeacherName={reportModalContext.homeroomTeacherName}
          homeroomTeacherNip={reportModalContext.homeroomTeacherNip}
          academicYear={activeAcademicYear?.year || '-'}
          semester={activeAcademicYear?.semester || '-'}
          onClose={() => setReportModalContext(null)}
        />
      )}

      {/* Batch ZIP Export Modal */}
      {showBatchExportModal && activeClass && (
        <BatchExportModal
          recaps={classRecap.recaps}
          madrasah={madrasah}
          className={activeClass.name}
          homeroomTeacherName={activeClass.homeroomTeacherName || currentUser.name}
          homeroomTeacherNip={currentUser.nip}
          academicYear={activeAcademicYear?.year || '-'}
          semester={activeAcademicYear?.semester || '-'}
          month={selectedMonth}
          year={selectedYear}
          onClose={() => setShowBatchExportModal(false)}
        />
      )}

      {/* Optional Quick Modal Profile Editor */}
      {showProfileModal && (
        <MadrasahProfileModal
          profile={madrasah}
          onSave={handleSaveProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
