import React, { useMemo, useState } from 'react';
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
  User,
} from './types';
import { storageService } from './services/storage';
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

const TAB_META: Record<string, { title: string; section: string }> = {
  opm_overview: { title: 'Ringkasan Sistem', section: 'Utama' },
  dashboard: { title: 'Dashboard Kelas', section: 'Utama' },
  attendance_matrix: { title: 'Input Presensi & Foto', section: 'Utama' },
  opm_students: { title: 'Data Siswa', section: 'Master Data' },
  opm_classes: { title: 'Kelas & Wali Kelas', section: 'Master Data' },
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
  // Global Application State (Zero dummy data)
  const [currentUser, setCurrentUser] = useState<User>(() => storageService.getCurrentUser());
  const [users, setUsers] = useState<User[]>(() => storageService.getUsers());
  const [madrasah, setMadrasah] = useState<MadrasahProfile>(() => storageService.getMadrasahProfile());
  const [classes, setClasses] = useState<SchoolClass[]>(() => storageService.getClasses());
  const [students, setStudents] = useState<Student[]>(() => storageService.getStudents());
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(() =>
    storageService.getAcademicYears()
  );
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>(() =>
    storageService.getCalendarEvents()
  );
  const [attendanceRecords, setAttendanceRecords] = useState<DailyAttendanceRecord[]>(() =>
    storageService.getAttendance()
  );
  const [correctionLogs, setCorrectionLogs] = useState<AttendanceCorrectionLog[]>(() =>
    storageService.getCorrectionLogs()
  );
  const [archives, setArchives] = useState<ReportArchiveItem[]>(() => storageService.getArchives());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => storageService.getAuditLogs());

  // Navigation & Period State
  const now = new Date();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const initialUser = storageService.getCurrentUser();
    return initialUser.role === 'opm' ? 'opm_overview' : 'dashboard';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedClassIdForMatrix, setSelectedClassIdForMatrix] = useState<string>(() => {
    const initialClasses = storageService.getClasses();
    return initialClasses[0]?.id || '';
  });

  // Modal States
  const [reportModalContext, setReportModalContext] = useState<ReportModalContext | null>(null);
  const [showBatchExportModal, setShowBatchExportModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  const refreshAuditAndLogs = () => {
    setCorrectionLogs(storageService.getCorrectionLogs());
    setAuditLogs(storageService.getAuditLogs());
  };

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
    return storageService.calculateClassRecap(
      activeClass?.id || '',
      selectedMonth,
      selectedYear
    );
  }, [activeClass?.id, selectedMonth, selectedYear, attendanceRecords, calendarEvents, students, classes]);

  // Attendance update handler (supports status, reason, note, and photo attachments)
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
    storageService.setStudentAttendance(studentId, classId, date, status, currentUser, options);
    setAttendanceRecords(storageService.getAttendance());
    refreshAuditAndLogs();
  };

  // Bulk set Hadir
  const handleBulkSetHadir = (classId: string, date: string) => {
    storageService.bulkSetClassAttendance(classId, date, 'H', currentUser);
    setAttendanceRecords(storageService.getAttendance());
    refreshAuditAndLogs();
  };

  // Switch User
  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    storageService.setCurrentUser(user);
    setActiveTab(user.role === 'opm' ? 'opm_overview' : 'dashboard');
  };

  // Madrasah Profile
  const handleSaveProfile = (newProfile: MadrasahProfile) => {
    setMadrasah(newProfile);
    storageService.saveMadrasahProfile(newProfile);
    setAuditLogs(storageService.getAuditLogs());
  };

  // Students CRUD
  const handleAddStudent = (newStudent: Omit<Student, 'id'>) => {
    const updated = storageService.addStudent(newStudent);
    setStudents(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleUpdateStudent = (student: Student) => {
    const updated = storageService.updateStudent(student);
    setStudents(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleDeleteStudent = (id: string) => {
    const updated = storageService.deleteStudent(id);
    setStudents(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleImportStudents = (newStudents: Omit<Student, 'id'>[]) => {
    const res = storageService.importStudentsBatch(newStudents);
    setStudents(res.students);
    setAuditLogs(storageService.getAuditLogs());
    return { added: res.added, skipped: res.skipped };
  };

  // Classes CRUD
  const handleAddClass = (newClass: Omit<SchoolClass, 'id'>) => {
    const updated = storageService.addClass(newClass);
    setClasses(updated);
    setUsers(storageService.getUsers());
    setCurrentUser(storageService.getCurrentUser());
    if (!selectedClassIdForMatrix && updated[0]) {
      setSelectedClassIdForMatrix(updated[0].id);
    }
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleUpdateClass = (updatedClass: SchoolClass) => {
    const updated = storageService.updateClass(updatedClass);
    setClasses(updated);
    setUsers(storageService.getUsers());
    setCurrentUser(storageService.getCurrentUser());
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleDeleteClass = (id: string) => {
    const updated = storageService.deleteClass(id);
    setClasses(updated);
    if (selectedClassIdForMatrix === id) {
      setSelectedClassIdForMatrix(updated[0]?.id || '');
    }
    setAuditLogs(storageService.getAuditLogs());
  };

  // Academic Years CRUD
  const handleAddAcademicYear = (year: Omit<AcademicYear, 'id'>) => {
    const updated = storageService.addAcademicYear(year);
    setAcademicYears(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleSetActiveAcademicYear = (id: string) => {
    const updated = storageService.setActiveAcademicYear(id);
    setAcademicYears(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleDeleteAcademicYear = (id: string) => {
    const updated = storageService.deleteAcademicYear(id);
    setAcademicYears(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  // Calendar Events CRUD
  const handleAddCalendarEvent = (event: Omit<AcademicCalendarEvent, 'id'>) => {
    const updated = storageService.addCalendarEvent(event);
    setCalendarEvents(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleUpdateCalendarEvent = (event: AcademicCalendarEvent) => {
    const updated = storageService.updateCalendarEvent(event);
    setCalendarEvents(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleDeleteCalendarEvent = (id: string) => {
    const updated = storageService.deleteCalendarEvent(id);
    setCalendarEvents(updated);
    setAuditLogs(storageService.getAuditLogs());
  };

  // Users CRUD
  const handleAddUser = (user: Omit<User, 'id'>) => {
    storageService.addUser(user);
    setUsers(storageService.getUsers());
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleUpdateUser = (user: User) => {
    storageService.updateUser(user);
    setUsers(storageService.getUsers());
    setCurrentUser(storageService.getCurrentUser());
    setAuditLogs(storageService.getAuditLogs());
  };

  const handleDeleteUser = (id: string) => {
    storageService.deleteUser(id);
    setUsers(storageService.getUsers());
    setAuditLogs(storageService.getAuditLogs());
  };

  // Navigate from OPMDashboard cards/checklist
  const handleNavigateOPMSection = (target: OPMSection | string) => {
    if (target === 'opm_settings' || target === 'attendance_matrix' || target === 'archives') {
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

  // Open Archive Item (works across any month/class)
  const handleOpenArchiveReport = (item: ReportArchiveItem) => {
    const targetRecapSummary = storageService.calculateClassRecap(
      item.classId,
      item.month,
      item.year
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
      />

      {/* Right Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Topbar
          pageTitle={currentMeta.title}
          breadcrumbSection={currentMeta.section}
          activeAcademicYear={activeAcademicYear}
          currentUser={currentUser}
          users={users}
          classes={classes}
          onSwitchUser={handleSwitchUser}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
          {/* Wali Kelas Primary Dashboard */}
          {activeTab === 'dashboard' && currentUser.role === 'wali_kelas' && (
            <WaliKelasDashboard
              currentUser={currentUser}
              schoolClass={activeClass}
              madrasah={madrasah}
              recapSummary={classRecap}
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

          {/* Dedicated Madrasah Profile & Logo Upload Settings */}
          {activeTab === 'opm_settings' && currentUser.role === 'opm' && (
            <MadrasahSettingsView
              profile={madrasah}
              onSave={handleSaveProfile}
              onResetAllData={() => storageService.resetAllData()}
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
              Platform Monitoring &amp; Laporan Presensi Siswa
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
          onDelivered={() => setArchives(storageService.getArchives())}
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
          onClose={() => {
            setShowBatchExportModal(false);
            setArchives(storageService.getArchives());
          }}
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
