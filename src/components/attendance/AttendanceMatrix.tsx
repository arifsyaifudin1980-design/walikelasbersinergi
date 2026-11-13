import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCheck,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  Image as ImageIcon,
  Paperclip,
  School,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { isDateEffective } from '../../services/storage';
import { readAndCompressImage } from '../../utils/imageUpload';
import {
  AcademicCalendarEvent,
  AttendanceStatus,
  DailyAttendanceRecord,
  SchoolClass,
  Student,
  User,
} from '../../types';

interface AttendanceMatrixProps {
  currentUser: User;
  classes: SchoolClass[];
  selectedClassId: string;
  onSelectClassId: (classId: string) => void;
  students: Student[];
  calendarEvents: AcademicCalendarEvent[];
  attendanceRecords: DailyAttendanceRecord[];
  onUpdateAttendance: (
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
  ) => void;
  onBulkSetHadir: (classId: string, date: string) => void;
  onNavigateToMaster?: (tab: string) => void;
}

export const AttendanceMatrix: React.FC<AttendanceMatrixProps> = ({
  currentUser,
  classes,
  selectedClassId,
  onSelectClassId,
  students,
  calendarEvents,
  attendanceRecords,
  onUpdateAttendance,
  onBulkSetHadir,
  onNavigateToMaster,
}) => {
  const now = new Date();
  const defaultMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const [viewMode, setViewMode] = useState<'daily' | 'matrix'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(defaultDateStr);
  const [selectedMonthValue, setSelectedMonthValue] = useState<string>(defaultMonthStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  // Lightbox / Photo Preview & Upload Modal for a specific student + date
  const [photoModalTarget, setPhotoModalTarget] = useState<{
    student: Student;
    date: string;
    record?: DailyAttendanceRecord;
  } | null>(null);

  // Cell edit modal for Matrix mode (status + reason + photo)
  const [cellEditTarget, setCellEditTarget] = useState<{
    student: Student;
    date: string;
    currentRecord?: DailyAttendanceRecord;
    nextStatus: AttendanceStatus;
    reason: string;
    note: string;
    attachmentUrl?: string;
    attachmentName?: string;
    removeAttachment?: boolean;
  } | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);

  const activeClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || classes[0],
    [classes, selectedClassId]
  );

  const classStudents = useMemo(
    () => (activeClass ? students.filter((s) => s.classId === activeClass.id && s.isActive) : []),
    [students, activeClass]
  );

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nis.includes(q) || s.nisn.includes(q)
    );
  }, [classStudents, searchQuery]);

  // Parse month & year for Matrix mode
  const [selectedYear, selectedMonth] = useMemo(() => {
    const [y, m] = selectedMonthValue.split('-').map(Number);
    return [y || now.getFullYear(), m || now.getMonth() + 1];
  }, [selectedMonthValue, now]);

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dateList = useMemo(() => {
    const list: { day: number; dateStr: string; isEffective: boolean; eventTitle?: string }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = d < 10 ? `0${d}` : `${d}`;
      const monthStr = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
      const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;

      const effective = isDateEffective(dateStr, calendarEvents);
      const ev = calendarEvents.find((e) => e.date === dateStr);

      list.push({
        day: d,
        dateStr,
        isEffective: effective,
        eventTitle: ev?.title,
      });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInMonth, calendarEvents]);

  // Map studentId_date -> DailyAttendanceRecord
  const attendanceMap = useMemo(() => {
    const map = new Map<string, DailyAttendanceRecord>();
    attendanceRecords.forEach((r) => {
      map.set(`${r.studentId}_${r.date}`, r);
    });
    return map;
  }, [attendanceRecords]);

  const isSelectedDateEffective = useMemo(
    () => isDateEffective(selectedDate, calendarEvents),
    [selectedDate, calendarEvents]
  );
  const selectedDateEvent = useMemo(
    () => calendarEvents.find((e) => e.date === selectedDate),
    [selectedDate, calendarEvents]
  );

  const showNotice = (msg: string) => {
    setUploadFeedback(msg);
    setTimeout(() => setUploadFeedback(null), 4000);
  };

  // Handle direct photo upload for a student on selectedDate
  const handleDirectPhotoUpload = async (
    student: Student,
    dateStr: string,
    file: File
  ) => {
    if (!activeClass) return;
    if (!file.type.startsWith('image/')) {
      showNotice('File bukti harus berupa foto/gambar (JPG, PNG, WebP).');
      return;
    }
    try {
      const { dataUrl, fileName } = await readAndCompressImage(file, 1024, 1024, 0.8);
      const existing = attendanceMap.get(`${student.id}_${dateStr}`);
      const statusToSave: AttendanceStatus = existing?.status || 'S'; // Default to Sakit/Izin if uploading evidence without status

      onUpdateAttendance(student.id, activeClass.id, dateStr, statusToSave, {
        attachmentUrl: dataUrl,
        attachmentName: fileName,
        reason: existing ? 'Unggah foto bukti presensi' : undefined,
      });

      // Update modal if open
      if (photoModalTarget && photoModalTarget.student.id === student.id) {
        setPhotoModalTarget({
          student,
          date: dateStr,
          record: {
            ...(existing || {
              id: `att_${student.id}_${dateStr}`,
              studentId: student.id,
              classId: activeClass.id,
              date: dateStr,
              status: statusToSave,
              recordedBy: currentUser.id,
              createdAt: new Date().toISOString(),
            }),
            attachmentUrl: dataUrl,
            attachmentName: fileName,
          },
        });
      }

      showNotice(`Foto bukti untuk ${student.name} berhasil diunggah.`);
    } catch {
      showNotice('Gagal memproses foto yang diunggah.');
    }
  };

  // Handle CSV attendance upload for selectedDate
  const handleCsvAttendanceImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeClass) return;
    e.target.value = '';

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let updatedCount = 0;
    lines.forEach((line, idx) => {
      const cols = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (idx === 0 && cols[0].toLowerCase() === 'nis') return; // Skip header
      const [nis, rawStatus, note] = cols;
      const statusUpper = (rawStatus || '').toUpperCase();
      if (!['H', 'S', 'I', 'A'].includes(statusUpper)) return;

      const student = classStudents.find((s) => s.nis === nis);
      if (student) {
        onUpdateAttendance(
          student.id,
          activeClass.id,
          selectedDate,
          statusUpper as AttendanceStatus,
          { note: note || undefined, reason: 'Impor presensi dari berkas CSV' }
        );
        updatedCount++;
      }
    });

    showNotice(
      updatedCount > 0
        ? `Berhasil mengimpor presensi ${updatedCount} siswa untuk tanggal ${selectedDate}.`
        : 'Tidak ada data NIS yang cocok ditemukan pada berkas CSV.'
    );
  };

  const handleDownloadCsvTemplate = () => {
    const header = 'nis,nama_siswa,status(H/S/I/A),catatan\n';
    const rows = classStudents
      .map((s) => {
        const rec = attendanceMap.get(`${s.id}_${selectedDate}`);
        return `${s.nis},"${s.name}",${rec?.status || 'H'},"${rec?.note || ''}"`;
      })
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_presensi_${activeClass?.name || 'kelas'}_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMonthlyCsv = () => {
    if (!activeClass) return;
    const header = [
      'No',
      'NIS',
      'Nama Siswa',
      ...dateList.map((d) => String(d.day)),
      'H',
      'S',
      'I',
      'A',
    ].join(',');

    const rows = classStudents.map((s, idx) => {
      let h = 0;
      let sa = 0;
      let i = 0;
      let a = 0;
      const cells = dateList.map((d) => {
        if (!d.isEffective) return 'LIBUR';
        const st = attendanceMap.get(`${s.id}_${d.dateStr}`)?.status || '';
        if (st === 'H') h++;
        else if (st === 'S') sa++;
        else if (st === 'I') i++;
        else if (st === 'A') a++;
        return st || '-';
      });
      return [idx + 1, s.nis, `"${s.name}"`, ...cells, h, sa, i, a].join(',');
    });

    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_presensi_${activeClass.name}_${selectedMonthValue}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Empty State: No Classes Created Yet
  if (classes.length === 0 || !activeClass) {
    return (
      <div className="surface-card p-12 text-center max-w-2xl mx-auto mt-6">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto mb-4">
          <School className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-[#0B192C]">Belum Ada Data Kelas</h2>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
          Untuk mulai mencatat presensi harian dan mengunggah foto bukti kehadiran, silakan buat kelas dan tambahkan siswa terlebih dahulu pada menu Master Data.
        </p>
        {currentUser.role === 'opm' && onNavigateToMaster && (
          <button
            type="button"
            onClick={() => onNavigateToMaster('opm_classes')}
            className="mt-5 px-4 py-2.5 rounded-xl btn-navy text-xs font-semibold cursor-pointer"
          >
            Buat Kelas Sekarang
          </button>
        )}
      </div>
    );
  }

  // Empty State: Class has no students
  if (classStudents.length === 0) {
    return (
      <div className="space-y-4">
        {currentUser.role === 'opm' && classes.length > 1 && (
          <div className="surface-card p-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#0B192C]">Pilih Kelas:</span>
            <select
              value={activeClass.id}
              onChange={(e) => onSelectClassId(e.target.value)}
              className="app-input w-auto font-semibold cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="surface-card p-12 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#0B192C]">
            Kelas {activeClass.name} Belum Memiliki Siswa
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            Tambahkan atau impor data siswa ke Kelas {activeClass.name} agar daftar presensi harian dan fitur unggah foto bukti dapat digunakan.
          </p>
          {currentUser.role === 'opm' && onNavigateToMaster && (
            <button
              type="button"
              onClick={() => onNavigateToMaster('opm_students')}
              className="mt-5 px-4 py-2.5 rounded-xl btn-navy text-xs font-semibold cursor-pointer"
            >
              Kelola Data Siswa
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Deep Navy Header Banner */}
      <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-7 border border-[#142844] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-emerald-400">Kelas {activeClass.name}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{classStudents.length} Siswa Aktif</span>
            <span aria-hidden="true">·</span>
            <span>Wali: {activeClass.homeroomTeacherName || 'Belum ditetapkan'}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-balance">
            Input Presensi Harian &amp; Unggah Foto Bukti
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* OPM Class Picker */}
          {currentUser.role === 'opm' && (
            <select
              value={activeClass.id}
              onChange={(e) => onSelectClassId(e.target.value)}
              className="text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-3.5 py-2.5 text-white cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id} className="text-[#0B192C]">
                  Kelas {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Segmented Mode Switcher */}
          <div className="flex items-center bg-[#142844] p-1 rounded-xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'daily'
                  ? 'bg-white text-[#0B192C] shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Input Harian &amp; Foto
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'matrix'
                  ? 'bg-white text-[#0B192C] shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Matriks Bulanan
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {uploadFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between">
          <span>{uploadFeedback}</span>
          <button
            type="button"
            onClick={() => setUploadFeedback(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODE 1: DAILY INPUT + PHOTO UPLOAD */}
      {viewMode === 'daily' && (
        <div className="space-y-4">
          {/* Date Controls, Search, and CSV Upload */}
          <div className="surface-card p-4 sm:p-5 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Tanggal Presensi
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="app-input w-auto font-semibold tabular-nums"
                />
              </div>

              <div className="pb-0.5">
                {!isSelectedDateEffective ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      {selectedDateEvent
                        ? `Libur: ${selectedDateEvent.title}`
                        : 'Hari Minggu / Non-Efektif'}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                    Hari Efektif Belajar
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="app-input pl-8"
                />
              </div>

              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvAttendanceImport}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B192C] text-xs font-semibold cursor-pointer whitespace-nowrap"
                title="Unduh template CSV untuk presensi tanggal ini"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template CSV</span>
              </button>
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B192C] text-xs font-semibold cursor-pointer whitespace-nowrap"
                title="Unggah file CSV hasil presensi"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-700" />
                <span>Upload CSV</span>
              </button>

              <button
                type="button"
                onClick={() => onBulkSetHadir(activeClass.id, selectedDate)}
                disabled={!isSelectedDateEffective}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl btn-emerald disabled:opacity-50 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tandai Semua Hadir</span>
              </button>
            </div>
          </div>

          {/* Daily Progress Summary Strip with Proportional Distribution Bar */}
          {(() => {
            let h = 0;
            let s = 0;
            let i = 0;
            let a = 0;
            let photos = 0;
            classStudents.forEach((st) => {
              const rec = attendanceMap.get(`${st.id}_${selectedDate}`);
              if (rec?.status === 'H') h++;
              else if (rec?.status === 'S') s++;
              else if (rec?.status === 'I') i++;
              else if (rec?.status === 'A') a++;
              if (rec?.attachmentUrl) photos++;
            });
            const recorded = h + s + i + a;
            const total = Math.max(classStudents.length, 1);
            return (
              <div className="surface-card px-5 py-3.5 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium text-slate-600 tabular-nums">
                    Tercatat pada <span className="font-bold text-[#0B192C]">{selectedDate}</span>:{' '}
                    <span className="font-bold text-[#0B192C]">
                      {recorded} / {classStudents.length}
                    </span>{' '}
                    siswa
                  </div>
                  <div className="flex flex-wrap items-center gap-4 tabular-nums">
                    <span className="text-emerald-700 font-semibold">Hadir: {h}</span>
                    <span className="text-amber-700 font-semibold">Sakit: {s}</span>
                    <span className="text-blue-700 font-semibold">Izin: {i}</span>
                    <span className="text-rose-700 font-semibold">Alpa: {a}</span>
                    <span className="text-slate-500 font-medium">Foto bukti: {photos}</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  {h > 0 && (
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${(h / total) * 100}%` }}
                    />
                  )}
                  {s > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${(s / total) * 100}%` }}
                    />
                  )}
                  {i > 0 && (
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${(i / total) * 100}%` }}
                    />
                  )}
                  {a > 0 && (
                    <div
                      className="h-full bg-rose-600 transition-all duration-300"
                      style={{ width: `${(a / total) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Mobile Daily Checklist Cards (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredStudents.map((student, idx) => {
              const record = attendanceMap.get(`${student.id}_${selectedDate}`);
              const status = record?.status;
              const note = record?.note || '';

              return (
                <div
                  key={student.id}
                  className="surface-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#0B192C] truncate">
                        {idx + 1}. {student.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                        NIS {student.nis} · {student.gender}
                      </div>
                    </div>
                  </div>

                  {/* Touch-friendly 44px status buttons */}
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl">
                    {(
                      [
                        { code: 'H', label: 'Hadir', active: 'bg-emerald-600 text-white' },
                        { code: 'S', label: 'Sakit', active: 'bg-amber-500 text-white' },
                        { code: 'I', label: 'Izin', active: 'bg-blue-600 text-white' },
                        { code: 'A', label: 'Alpa', active: 'bg-rose-600 text-white' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() =>
                          onUpdateAttendance(
                            student.id,
                            activeClass.id,
                            selectedDate,
                            opt.code,
                            {
                              reason: status
                                ? `Perubahan status dari ${status} menjadi ${opt.code}`
                                : undefined,
                            }
                          )
                        }
                        className={`min-h-[42px] rounded-lg font-semibold text-xs transition-colors cursor-pointer flex flex-col items-center justify-center ${
                          status === opt.code
                            ? opt.active
                            : 'text-slate-600 hover:bg-white hover:text-[#0B192C]'
                        }`}
                      >
                        <span className="font-bold">{opt.code}</span>
                        <span className="text-[10px] opacity-90">{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    defaultValue={note}
                    key={`m_${student.id}_${selectedDate}_${note}`}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== note && status) {
                        onUpdateAttendance(student.id, activeClass.id, selectedDate, status, {
                          note: val,
                        });
                      }
                    }}
                    placeholder={status ? 'Catatan singkat (opsional)...' : 'Pilih status dahulu...'}
                    disabled={!status}
                    className="app-input"
                  />

                  <div className="flex items-center justify-between pt-1">
                    {record?.attachmentUrl ? (
                      <div className="flex items-center justify-between w-full gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoModalTarget({
                              student,
                              date: selectedDate,
                              record,
                            })
                          }
                          className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
                        >
                          <img
                            src={record.attachmentUrl}
                            alt={`Bukti ${student.name}`}
                            className="w-10 h-10 rounded-lg border border-slate-200 object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-emerald-700 truncate">
                              {record.attachmentName || 'Lihat Foto Bukti'}
                            </div>
                            <div className="text-[11px] text-slate-400">Ketuk untuk pratinjau</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAttendance(
                              student.id,
                              activeClass.id,
                              selectedDate,
                              record.status,
                              { removeAttachment: true }
                            )
                          }
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Hapus foto bukti"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-[#0B192C] bg-slate-50/70 text-[#0B192C] text-xs font-semibold cursor-pointer transition-colors">
                        <Camera className="w-4 h-4 text-emerald-700" />
                        <span>Unggah Foto Bukti (Kamera / Galeri)</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleDirectPhotoUpload(student, selectedDate, file);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Daily Checklist Table (md+) */}
          <div className="hidden md:block surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[#0B192C] font-semibold">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4 min-w-[200px]">Nama Siswa &amp; NIS</th>
                    <th className="py-3 px-4 min-w-[210px]">Status Kehadiran</th>
                    <th className="py-3 px-4 min-w-[180px]">Keterangan Singkat</th>
                    <th className="py-3 px-4 min-w-[210px]">Foto Bukti (Surat / Kehadiran)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student, idx) => {
                    const record = attendanceMap.get(`${student.id}_${selectedDate}`);
                    const status = record?.status;
                    const note = record?.note || '';

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{student.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                            NIS {student.nis} · {student.gender}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                            {(
                              [
                                { code: 'H', label: 'Hadir', active: 'bg-emerald-600 text-white' },
                                { code: 'S', label: 'Sakit', active: 'bg-amber-500 text-white' },
                                { code: 'I', label: 'Izin', active: 'bg-blue-600 text-white' },
                                { code: 'A', label: 'Alpa', active: 'bg-rose-600 text-white' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.code}
                                type="button"
                                onClick={() =>
                                  onUpdateAttendance(
                                    student.id,
                                    activeClass.id,
                                    selectedDate,
                                    opt.code,
                                    {
                                      reason: status
                                        ? `Perubahan status dari ${status} menjadi ${opt.code}`
                                        : undefined,
                                    }
                                  )
                                }
                                title={opt.label}
                                className={`px-2.5 py-1.5 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                                  status === opt.code
                                    ? opt.active
                                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                                }`}
                              >
                                {opt.code}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            defaultValue={note}
                            key={`${student.id}_${selectedDate}_${note}`}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== note && status) {
                                onUpdateAttendance(student.id, activeClass.id, selectedDate, status, {
                                  note: val,
                                });
                              }
                            }}
                            placeholder={
                              status ? 'Catatan (opsional)...' : 'Pilih status dahulu...'
                            }
                            disabled={!status}
                            className="app-input"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {record?.attachmentUrl ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPhotoModalTarget({
                                      student,
                                      date: selectedDate,
                                      record,
                                    })
                                  }
                                  className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden shrink-0 hover:ring-2 hover:ring-emerald-600 transition cursor-pointer"
                                  title="Klik untuk melihat foto bukti"
                                >
                                  <img
                                    src={record.attachmentUrl}
                                    alt={`Bukti ${student.name}`}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                                <div className="min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPhotoModalTarget({
                                        student,
                                        date: selectedDate,
                                        record,
                                      })
                                    }
                                    className="text-xs font-semibold text-emerald-700 hover:underline truncate block max-w-[120px] cursor-pointer"
                                  >
                                    {record.attachmentName || 'Lihat Foto'}
                                  </button>
                                  <span className="text-[11px] text-slate-400">Terunggah</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateAttendance(
                                      student.id,
                                      activeClass.id,
                                      selectedDate,
                                      record.status,
                                      { removeAttachment: true }
                                    )
                                  }
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                                  title="Hapus foto bukti"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/50 text-slate-600 hover:text-emerald-800 text-xs font-medium cursor-pointer transition-colors">
                                <Camera className="w-3.5 h-3.5" />
                                <span>Upload Foto</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleDirectPhotoUpload(student, selectedDate, file);
                                    e.target.value = '';
                                  }}
                                  className="hidden"
                                />
                              </label>
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
        </div>
      )}

      {/* MODE 2: MONTHLY MATRIX */}
      {viewMode === 'matrix' && (
        <div className="space-y-4">
          {/* Month Picker & Legend */}
          <div className="surface-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Bulan &amp; Tahun
                </label>
                <input
                  type="month"
                  value={selectedMonthValue}
                  onChange={(e) => setSelectedMonthValue(e.target.value)}
                  className="app-input w-auto font-semibold tabular-nums"
                />
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="app-input pl-8"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-3 font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-xs bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                    H
                  </span>
                  Hadir
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-xs bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    S
                  </span>
                  Sakit
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-xs bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    I
                  </span>
                  Izin
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-xs bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    A
                  </span>
                  Alpa
                </span>
              </div>

              <button
                type="button"
                onClick={handleExportMonthlyCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B192C] font-semibold cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[#0B192C] text-[11px] sticky top-0 z-20 border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center font-semibold border-r border-slate-200">
                      No
                    </th>
                    <th className="py-2.5 px-3 w-48 font-semibold border-r border-slate-200 min-w-[180px] sticky left-0 bg-slate-50 z-30">
                      Nama Siswa
                    </th>
                    {dateList.map((item) => (
                      <th
                        key={item.day}
                        title={
                          item.eventTitle ||
                          (item.isEffective ? 'Hari Efektif Belajar' : 'Hari Libur')
                        }
                        className={`py-2 px-1 text-center font-semibold border-r border-slate-200 min-w-[32px] tabular-nums ${
                          !item.isEffective ? 'bg-slate-100 text-slate-400' : ''
                        }`}
                      >
                        <div className="text-slate-800">{item.day}</div>
                        <div className="text-[9px] text-slate-400 font-medium">
                          {['M', 'S', 'S', 'R', 'K', 'J', 'S'][
                            new Date(item.dateStr + 'T00:00:00').getDay()
                          ]}
                        </div>
                      </th>
                    ))}
                    <th className="py-2.5 px-2 text-center font-bold text-emerald-700 bg-emerald-50/50 border-r border-slate-200 w-10">
                      H
                    </th>
                    <th className="py-2.5 px-2 text-center font-bold text-amber-700 bg-amber-50/50 border-r border-slate-200 w-10">
                      S
                    </th>
                    <th className="py-2.5 px-2 text-center font-bold text-blue-700 bg-blue-50/50 border-r border-slate-200 w-10">
                      I
                    </th>
                    <th className="py-2.5 px-2 text-center font-bold text-rose-700 bg-rose-50/50 w-10">
                      A
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStudents.map((student, idx) => {
                    let hCount = 0;
                    let sCount = 0;
                    let iCount = 0;
                    let aCount = 0;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-400 tabular-nums border-r border-slate-100">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 sticky left-0 bg-white z-10">
                          <div className="font-semibold text-slate-900 truncate max-w-[170px]">
                            {student.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                            {student.nis}
                          </div>
                        </td>

                        {dateList.map((item) => {
                          const rec = attendanceMap.get(`${student.id}_${item.dateStr}`);
                          const status = rec?.status;
                          if (status === 'H') hCount++;
                          else if (status === 'S') sCount++;
                          else if (status === 'I') iCount++;
                          else if (status === 'A') aCount++;

                          if (!item.isEffective) {
                            return (
                              <td
                                key={item.day}
                                title={item.eventTitle || 'Hari Libur'}
                                className="p-0.5 text-center bg-slate-100 border-r border-slate-100 cursor-not-allowed"
                              >
                                <span className="text-[10px] text-slate-400">·</span>
                              </td>
                            );
                          }

                          let bgClass = 'bg-slate-50 hover:bg-slate-200 text-slate-400';
                          if (status === 'H') bgClass = 'bg-emerald-600 text-white font-bold';
                          else if (status === 'S') bgClass = 'bg-amber-500 text-white font-bold';
                          else if (status === 'I') bgClass = 'bg-blue-600 text-white font-bold';
                          else if (status === 'A') bgClass = 'bg-rose-600 text-white font-bold';

                          return (
                            <td
                              key={item.day}
                              onClick={() =>
                                setCellEditTarget({
                                  student,
                                  date: item.dateStr,
                                  currentRecord: rec,
                                  nextStatus: status || 'H',
                                  reason: status
                                    ? `Koreksi presensi tanggal ${item.dateStr}`
                                    : 'Input presensi harian',
                                  note: rec?.note || '',
                                  attachmentUrl: rec?.attachmentUrl,
                                  attachmentName: rec?.attachmentName,
                                })
                              }
                              title={`${student.name} (${item.dateStr}) - Klik untuk edit / upload foto`}
                              className="p-0.5 text-center border-r border-slate-100 cursor-pointer relative"
                            >
                              <div
                                className={`w-6 h-6 mx-auto rounded flex items-center justify-center text-[10px] select-none transition ${bgClass}`}
                              >
                                {status || ''}
                              </div>
                              {rec?.attachmentUrl && (
                                <span
                                  className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-xs bg-slate-900 ring-1 ring-white"
                                  title="Memiliki foto bukti"
                                />
                              )}
                            </td>
                          );
                        })}

                        <td className="py-2 px-2 text-center font-bold text-emerald-700 bg-emerald-50/40 tabular-nums border-r border-slate-100">
                          {hCount}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-amber-600 bg-amber-50/40 tabular-nums border-r border-slate-100">
                          {sCount}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-blue-600 bg-blue-50/40 tabular-nums border-r border-slate-100">
                          {iCount}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-rose-600 bg-rose-50/40 tabular-nums">
                          {aCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Lightbox Modal */}
      {photoModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/65 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-xl border border-slate-200/80">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0B192C]">
                  Foto Bukti Presensi — {photoModalTarget.student.name}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                  Tanggal {photoModalTarget.date} · Status {photoModalTarget.record?.status || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoModalTarget(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-[#0B192C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 bg-slate-50 flex items-center justify-center max-h-[60vh] overflow-hidden">
              {photoModalTarget.record?.attachmentUrl ? (
                <img
                  src={photoModalTarget.record.attachmentUrl}
                  alt="Foto Bukti Presensi"
                  className="max-h-[54vh] w-auto object-contain rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <div className="text-xs text-slate-400 py-12">Belum ada foto bukti</div>
              )}
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-[#0B192C] cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-emerald-700" />
                <span>Ganti Foto</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleDirectPhotoUpload(photoModalTarget.student, photoModalTarget.date, f);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>

              <div className="flex items-center gap-2">
                {photoModalTarget.record?.attachmentUrl && (
                  <a
                    href={photoModalTarget.record.attachmentUrl}
                    download={photoModalTarget.record.attachmentName || 'bukti_presensi.jpg'}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl btn-emerald font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Foto</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPhotoModalTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matrix Cell Edit + Photo Upload + Audit Modal */}
      {cellEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0B192C]">Detail &amp; Koreksi Presensi</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cellEditTarget.student.name} · <span className="tabular-nums">{cellEditTarget.date}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCellEditTarget(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-[#0B192C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Status Kehadiran</label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {(
                    [
                      { code: 'H', label: 'Hadir', active: 'bg-emerald-600 text-white border-emerald-600' },
                      { code: 'S', label: 'Sakit', active: 'bg-amber-500 text-white border-amber-500' },
                      { code: 'I', label: 'Izin', active: 'bg-blue-600 text-white border-blue-600' },
                      { code: 'A', label: 'Alpa', active: 'bg-rose-600 text-white border-rose-600' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.code}
                      type="button"
                      onClick={() => setCellEditTarget({ ...cellEditTarget, nextStatus: st.code })}
                      className={`py-2 rounded-lg border font-semibold transition-colors cursor-pointer ${
                        cellEditTarget.nextStatus === st.code
                          ? st.active
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {st.code} · {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">Catatan</label>
                <input
                  type="text"
                  value={cellEditTarget.note}
                  onChange={(e) => setCellEditTarget({ ...cellEditTarget, note: e.target.value })}
                  placeholder="Keterangan tambahan (opsional)"
                  className="app-input"
                />
              </div>

              {/* Photo Proof Upload inside Cell Modal */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Foto Bukti (Surat Dokter / Izin / Kehadiran)
                </label>
                {cellEditTarget.attachmentUrl ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <img
                      src={cellEditTarget.attachmentUrl}
                      alt="Preview"
                      className="w-12 h-12 rounded-md object-cover border border-slate-200"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-semibold text-slate-800 truncate">
                        {cellEditTarget.attachmentName || 'Foto Bukti'}
                      </div>
                      <div className="text-[11px] text-slate-500">Siap disimpan</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCellEditTarget({
                          ...cellEditTarget,
                          attachmentUrl: undefined,
                          attachmentName: undefined,
                          removeAttachment: true,
                        })
                      }
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-600 bg-slate-50 text-slate-600 text-xs font-medium cursor-pointer transition-colors">
                    <Camera className="w-4 h-4 text-emerald-700" />
                    <span>Pilih atau Ambil Foto Bukti</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const { dataUrl, fileName } = await readAndCompressImage(f, 1024, 1024, 0.8);
                          setCellEditTarget({
                            ...cellEditTarget,
                            attachmentUrl: dataUrl,
                            attachmentName: fileName,
                            removeAttachment: false,
                          });
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Correction Reason if changing existing status */}
              {cellEditTarget.currentRecord &&
                cellEditTarget.currentRecord.status !== cellEditTarget.nextStatus && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-amber-800 block">
                      Alasan Koreksi Status ({cellEditTarget.currentRecord.status} ➔{' '}
                      {cellEditTarget.nextStatus}) *
                    </label>
                    <input
                      type="text"
                      required
                      value={cellEditTarget.reason}
                      onChange={(e) =>
                        setCellEditTarget({ ...cellEditTarget, reason: e.target.value })
                      }
                      className="app-input border-amber-300 bg-amber-50/40"
                      placeholder="Wajib isi alasan koreksi..."
                    />
                  </div>
                )}
            </div>

            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCellEditTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  Boolean(
                    cellEditTarget.currentRecord &&
                      cellEditTarget.currentRecord.status !== cellEditTarget.nextStatus &&
                      !cellEditTarget.reason.trim()
                  )
                }
                onClick={() => {
                  onUpdateAttendance(
                    cellEditTarget.student.id,
                    activeClass.id,
                    cellEditTarget.date,
                    cellEditTarget.nextStatus,
                    {
                      reason: cellEditTarget.reason.trim(),
                      note: cellEditTarget.note.trim(),
                      attachmentUrl: cellEditTarget.attachmentUrl,
                      attachmentName: cellEditTarget.attachmentName,
                      removeAttachment: cellEditTarget.removeAttachment,
                    }
                  );
                  setCellEditTarget(null);
                }}
                className="px-4 py-2 rounded-xl btn-emerald disabled:opacity-50 text-xs font-semibold cursor-pointer"
              >
                Simpan Presensi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
