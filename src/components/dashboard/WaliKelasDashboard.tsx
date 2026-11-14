import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowDownUp,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  PieChart,
  School,
  Search,
  TrendingUp,
} from 'lucide-react';
import {
  ClassMonthlySummary,
  MadrasahProfile,
  SchoolClass,
  StudentMonthlyRecap,
  TeachingAttendanceRecord,
  User,
} from '../../types';
import { DonutChart } from '../common/DonutChart';

interface WaliKelasDashboardProps {
  currentUser: User;
  schoolClass?: SchoolClass;
  madrasah: MadrasahProfile;
  recapSummary: ClassMonthlySummary;
  todayTeachingRecords?: TeachingAttendanceRecord[];
  selectedMonth: number;
  selectedYear: number;
  onChangeMonthYear: (month: number, year: number) => void;
  academicYear: string;
  semester: string;
  onSelectStudentReport: (recap: StudentMonthlyRecap) => void;
  onOpenBatchExport: () => void;
  onGoToMatrix: () => void;
  onGoToTeachingRecap?: () => void;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const WaliKelasDashboard: React.FC<WaliKelasDashboardProps> = ({
  currentUser,
  schoolClass,
  recapSummary,
  todayTeachingRecords = [],
  selectedMonth,
  selectedYear,
  onChangeMonthYear,
  academicYear,
  semester,
  onSelectStudentReport,
  onOpenBatchExport,
  onGoToMatrix,
  onGoToTeachingRecap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'incomplete' | 'attention' | 'perfect'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'percentage_asc' | 'percentage_desc'>('percentage_desc');

  const monthInputValue = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const monthLabel = `${MONTH_NAMES[selectedMonth - 1] || 'Bulan'} ${selectedYear}`;

  // Filter and sort students
  const filteredRecaps = useMemo(() => {
    let list = [...recapSummary.recaps];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.student.name.toLowerCase().includes(q) ||
          r.student.nis.toLowerCase().includes(q) ||
          (r.student.nisn || '').toLowerCase().includes(q)
      );
    }

    if (filterType === 'incomplete') {
      list = list.filter((r) => !r.isDataComplete);
    } else if (filterType === 'attention') {
      list = list.filter((r) => r.attendancePercentage < 85);
    } else if (filterType === 'perfect') {
      list = list.filter((r) => r.attendancePercentage >= 98);
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.student.name.localeCompare(b.student.name));
    } else if (sortBy === 'percentage_desc') {
      list.sort((a, b) => b.attendancePercentage - a.attendancePercentage);
    } else if (sortBy === 'percentage_asc') {
      list.sort((a, b) => a.attendancePercentage - b.attendancePercentage);
    }

    return list;
  }, [recapSummary.recaps, searchQuery, filterType, sortBy]);

  // Empty state: Wali Kelas has not been assigned a class yet
  if (!schoolClass) {
    return (
      <div className="surface-card p-10 text-center max-w-2xl mx-auto mt-6">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto mb-4">
          <School className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-[#0B192C]">Belum Ada Kelas yang Ditugaskan</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
          Akun <span className="font-semibold text-[#0B192C]">{currentUser.name}</span> belum ditugaskan sebagai wali kelas. Hubungi Administrator / OPM untuk menetapkan kelas pada menu{' '}
          <span className="font-semibold text-[#0B192C]">Kelas &amp; Wali Kelas</span>.
        </p>
      </div>
    );
  }

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
  const totalClassEntries =
    recapSummary.totalHadir +
    recapSummary.totalSakit +
    recapSummary.totalIzin +
    recapSummary.totalAlpa;

  return (
    <div className="space-y-6">
      {/* Deep Navy Class Welcome & Period Header */}
      <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-7 shadow-xs border border-[#142844]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-300">
              <span className="font-semibold text-emerald-400">Kelas {schoolClass.name}</span>
              <span aria-hidden="true">·</span>
              <span>TA {academicYear || '-'}</span>
              <span aria-hidden="true">·</span>
              <span>Semester {semester || '-'}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {recapSummary.effectiveDays} Hari Efektif ({monthLabel})
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-balance">
              {greeting}, {schoolClass.homeroomTeacherName || currentUser.name}
            </h2>

            <p className="text-xs text-slate-300/90 tabular-nums">
              Monitoring presensi {recapSummary.totalStudents} siswa aktif serta distribusi laporan individual JPG.
            </p>
          </div>

          {/* Month Picker & Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="w-full sm:w-auto">
              <label htmlFor="wali-month-picker" className="sr-only">
                Pilih Bulan Laporan
              </label>
              <input
                id="wali-month-picker"
                type="month"
                value={monthInputValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const [yStr, mStr] = val.split('-');
                  const y = Number(yStr);
                  const m = Number(mStr);
                  if (y && m) onChangeMonthYear(m, y);
                }}
                className="w-full sm:w-auto bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white [color-scheme:dark] focus:outline-hidden focus:ring-2 focus:ring-emerald-400 cursor-pointer tabular-nums"
              />
            </div>

            <button
              type="button"
              onClick={onOpenBatchExport}
              disabled={recapSummary.totalStudents === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 btn-emerald disabled:bg-white/10 disabled:text-slate-400 font-semibold text-xs px-4 py-2.5 rounded-xl whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
              title="Unduh seluruh laporan JPG siswa kelas ini dalam format ZIP"
            >
              <Archive className="w-4 h-4" />
              <span className="tabular-nums">Unduh ZIP ({recapSummary.totalStudents})</span>
            </button>

            <button
              type="button"
              onClick={onGoToMatrix}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-[#0B192C] hover:bg-slate-100 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Input Presensi &amp; Foto</span>
            </button>
          </div>
        </div>
      </div>

      {/* 12-Column Class Analytics Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 4 Cols: Overall Class Attendance Donut */}
        <div className="lg:col-span-4 surface-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-[#0B192C]">Ringkasan Kehadiran Kelas</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Akumulasi bulan {monthLabel}
            </div>
          </div>
          <div className="py-3 flex justify-center">
            <DonutChart
              hadir={recapSummary.totalHadir}
              sakit={recapSummary.totalSakit}
              izin={recapSummary.totalIzin}
              alpa={recapSummary.totalAlpa}
              effectiveDays={Math.max(
                recapSummary.effectiveDays * Math.max(recapSummary.totalStudents, 1),
                1
              )}
              percentage={recapSummary.averagePercentage}
              size={172}
              strokeWidth={22}
              showLegend={true}
            />
          </div>
        </div>

        {/* Right 8 Cols: 6-Card Metric Grid + Proportional Distribution Bar */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 flex-1">
            <div className="surface-card p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-2 h-2 rounded-xs bg-emerald-600" />
                <span>Total Hadir (H)</span>
              </div>
              <div className="text-2xl font-bold text-[#0B192C] mt-2 tabular-nums">
                {recapSummary.totalHadir}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Akumulasi hari hadir</div>
            </div>

            <div className="surface-card p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-2 h-2 rounded-xs bg-amber-500" />
                <span>Total Sakit (S)</span>
              </div>
              <div className="text-2xl font-bold text-[#0B192C] mt-2 tabular-nums">
                {recapSummary.totalSakit}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Keterangan sakit</div>
            </div>

            <div className="surface-card p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-2 h-2 rounded-xs bg-blue-600" />
                <span>Total Izin (I)</span>
              </div>
              <div className="text-2xl font-bold text-[#0B192C] mt-2 tabular-nums">
                {recapSummary.totalIzin}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Izin tertulis wali</div>
            </div>

            <div className="surface-card p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-2 h-2 rounded-xs bg-rose-600" />
                <span>Total Alpa (A)</span>
              </div>
              <div className="text-2xl font-bold text-[#0B192C] mt-2 tabular-nums">
                {recapSummary.totalAlpa}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Tanpa keterangan</div>
            </div>

            <div className="surface-card p-4 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Rata-rata Kelas</span>
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-2 tabular-nums">
                {recapSummary.averagePercentage}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Tingkat kehadiran</div>
            </div>

            <div
              className={`rounded-2xl p-4 border flex flex-col justify-between shadow-[0_1px_2px_rgba(11,25,44,0.04)] ${
                recapSummary.totalStudents === 0
                  ? 'bg-white border-slate-200/90'
                  : recapSummary.incompleteStudentCount > 0
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-emerald-50/70 border-emerald-200'
              }`}
            >
              <div
                className={`text-xs font-semibold flex items-center gap-1.5 ${
                  recapSummary.totalStudents === 0
                    ? 'text-slate-600'
                    : recapSummary.incompleteStudentCount > 0
                    ? 'text-amber-800'
                    : 'text-emerald-800'
                }`}
              >
                {recapSummary.incompleteStudentCount > 0 && recapSummary.totalStudents > 0 ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Kelengkapan Data</span>
              </div>
              <div
                className={`text-xl font-bold mt-2 tabular-nums ${
                  recapSummary.totalStudents === 0
                    ? 'text-slate-500'
                    : recapSummary.incompleteStudentCount > 0
                    ? 'text-amber-900'
                    : 'text-emerald-900'
                }`}
              >
                {recapSummary.totalStudents === 0
                  ? 'Kosong'
                  : recapSummary.incompleteStudentCount > 0
                  ? `${recapSummary.incompleteStudentCount} Siswa`
                  : '100% Lengkap'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {recapSummary.totalStudents === 0
                  ? 'Belum ada siswa'
                  : recapSummary.incompleteStudentCount > 0
                  ? 'Ada presensi belum diisi'
                  : 'Siap cetak laporan'}
              </div>
            </div>
          </div>

          {/* Horizontal Proportional Bar */}
          <div className="surface-card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#0B192C]">
                Proporsi Kehadiran Bulan {monthLabel}
              </span>
              <span className="text-slate-500 tabular-nums">
                {totalClassEntries} Total Presensi Tercatat
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              {totalClassEntries > 0 && (
                <>
                  <div
                    className="bg-emerald-600 h-full"
                    style={{ width: `${(recapSummary.totalHadir / totalClassEntries) * 100}%` }}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${(recapSummary.totalSakit / totalClassEntries) * 100}%` }}
                  />
                  <div
                    className="bg-blue-600 h-full"
                    style={{ width: `${(recapSummary.totalIzin / totalClassEntries) * 100}%` }}
                  />
                  <div
                    className="bg-rose-600 h-full"
                    style={{ width: `${(recapSummary.totalAlpa / totalClassEntries) * 100}%` }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rekap Kedatangan & Selesai Guru Mengajar Hari Ini */}
      <div className="surface-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0B192C]">
                Rekap Guru Mengajar Hari Ini (Kelas {schoolClass.name})
              </h3>
              <p className="text-xs text-slate-500">
                Pantauan otomatis scan QR kedatangan &amp; selesai mengajar guru di kelas Anda.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold tabular-nums">
              Sedang Ngajar: {todayTeachingRecords.filter((r) => r.status === 'mengajar').length}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold tabular-nums">
              Selesai: {todayTeachingRecords.filter((r) => r.status === 'selesai').length}
            </span>
            {onGoToTeachingRecap && (
              <button
                type="button"
                onClick={onGoToTeachingRecap}
                className="px-3 py-1.5 rounded-lg btn-navy text-[11px] font-semibold cursor-pointer"
              >
                Lihat Rekap Lengkap
              </button>
            )}
          </div>
        </div>

        {todayTeachingRecords.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#F6F8FB] border border-dashed border-slate-200 text-xs text-slate-500 text-center">
            Belum ada guru mengajar yang melakukan scan QR Barcode kelas hari ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {todayTeachingRecords.slice(0, 4).map((rec) => (
              <div
                key={rec.id}
                className="rounded-xl border border-slate-200/90 bg-[#F6F8FB] p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[#0B192C] truncate">{rec.teacherName}</div>
                    <div className="text-[11px] text-slate-600 truncate">
                      {rec.subject}
                      {rec.lessonPeriod ? ` · Jam ke-${rec.lessonPeriod}` : ''}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      rec.status === 'mengajar'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {rec.status === 'mengajar' ? 'Mengajar' : 'Selesai'}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600">
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <Clock className="w-3 h-3" />
                    {rec.arrivalTime}
                  </span>
                  <span>
                    {rec.completedTime ? `s.d. ${rec.completedTime}` : 'Belum selesai'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty State when class has 0 students */}
      {recapSummary.totalStudents === 0 ? (
        <div className="surface-card p-12 text-center">
          <PieChart className="w-11 h-11 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#0B192C]">
            Belum ada siswa terdaftar di Kelas {schoolClass.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            Minta Administrator / OPM untuk menambahkan atau mengimpor daftar siswa ke kelas ini agar statistik kehadiran dan laporan JPG dapat dibuat.
          </p>
          <button
            type="button"
            onClick={onGoToMatrix}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-navy text-xs font-semibold cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Buka Halaman Input Presensi</span>
          </button>
        </div>
      ) : (
        <>
          {/* Filter, Search and Sorting Bar */}
          <div className="surface-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari siswa berdasarkan nama atau NIS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="app-input pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-white text-[#0B192C] shadow-xs'
                      : 'text-slate-600 hover:text-[#0B192C]'
                  }`}
                >
                  Semua ({recapSummary.recaps.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('perfect')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    filterType === 'perfect'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-[#0B192C]'
                  }`}
                >
                  Rajin (&ge;98%)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('attention')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    filterType === 'attention'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-[#0B192C]'
                  }`}
                >
                  Perlu Perhatian (&lt;85%)
                </button>
                {recapSummary.incompleteStudentCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterType('incomplete')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      filterType === 'incomplete'
                        ? 'bg-white text-amber-800 shadow-xs'
                        : 'text-amber-700 hover:text-amber-900'
                    }`}
                  >
                    Belum Lengkap ({recapSummary.incompleteStudentCount})
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <ArrowDownUp className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'percentage_asc' | 'percentage_desc')}
                  className="app-input w-auto font-semibold cursor-pointer"
                >
                  <option value="percentage_desc">Persentase Tertinggi</option>
                  <option value="percentage_asc">Persentase Terendah</option>
                  <option value="name">Nama Siswa (A - Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Donut Cards Grid */}
          {filteredRecaps.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRecaps.map((recap) => (
                <div
                  key={recap.student.id}
                  className="surface-card p-5 hover:border-emerald-400/80 transition-colors flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-mono font-semibold text-slate-500 tabular-nums">
                          NIS {recap.student.nis}
                        </div>
                        <h3
                          className="font-bold text-[#0B192C] text-sm sm:text-base leading-snug mt-0.5 truncate group-hover:text-emerald-700 transition-colors"
                          title={recap.student.name}
                        >
                          {recap.student.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          Wali: {recap.student.parentName || '-'}
                        </p>
                      </div>

                      {!recap.isDataComplete ? (
                        <span
                          className="text-[11px] font-semibold text-amber-700 shrink-0 flex items-center gap-1 tabular-nums"
                          title={`${recap.unrecordedDays} hari efektif belum diisi status presensinya`}
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          -{recap.unrecordedDays} hari
                        </span>
                      ) : (
                        <span
                          className="text-[11px] font-semibold text-emerald-700 shrink-0 flex items-center gap-1"
                          title="Seluruh hari efektif telah terisi"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Lengkap
                        </span>
                      )}
                    </div>

                    <div className="my-2 py-2 flex justify-center">
                      <DonutChart
                        hadir={recap.hadir}
                        sakit={recap.sakit}
                        izin={recap.izin}
                        alpa={recap.alpa}
                        effectiveDays={recap.effectiveDays}
                        percentage={recap.attendancePercentage}
                        unrecordedDays={recap.unrecordedDays}
                        size={170}
                        strokeWidth={22}
                        showLegend={true}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectStudentReport(recap)}
                      className="w-full flex items-center justify-center gap-1.5 btn-navy font-semibold py-2.5 px-3 rounded-xl text-xs cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-emerald-400" />
                      <span>Lihat &amp; Buat Laporan JPG</span>
                    </button>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5 tabular-nums">
                      <span>Efektif: {recap.effectiveDays} Hari</span>
                      <span className="font-mono text-slate-600">
                        {recap.student.parentWhatsapp
                          ? `+${recap.student.parentWhatsapp}`
                          : 'No. WA belum diisi'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="surface-card p-12 text-center">
              <PieChart className="w-11 h-11 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#0B192C]">Tidak ada siswa yang cocok</h3>
              <p className="text-xs text-slate-500 mt-1">
                Ubah kata kunci pencarian atau sesuaikan filter kehadiran di atas.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
