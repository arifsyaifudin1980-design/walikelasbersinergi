import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  QrCode,
  Search,
  Timer,
} from 'lucide-react';
import { formatDateYYYYMMDD } from '../../services/firestoreService';
import { SchoolClass, TeachingAttendanceRecord, User } from '../../types';

interface TeachingRecapViewProps {
  currentUser: User;
  classes: SchoolClass[];
  teachingRecords: TeachingAttendanceRecord[];
  activeClass?: SchoolClass;
  onOpenQrManager?: () => void;
}

export const TeachingRecapView: React.FC<TeachingRecapViewProps> = ({
  currentUser,
  classes,
  teachingRecords,
  activeClass,
  onOpenQrManager,
}) => {
  const todayStr = formatDateYYYYMMDD();
  const [periodMode, setPeriodMode] = useState<'today' | 'month' | 'all'>('month');
  const [selectedMonthValue, setSelectedMonthValue] = useState<string>(todayStr.slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<'all' | 'mengajar' | 'selesai'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const scopedRecords = useMemo(() => {
    let list = [...teachingRecords];

    if (currentUser.role === 'wali_kelas') {
      const myClassId = activeClass?.id || currentUser.assignedClassId || '';
      list = myClassId ? list.filter((r) => r.classId === myClassId) : [];
    } else if (classFilter !== 'all') {
      list = list.filter((r) => r.classId === classFilter);
    }

    if (periodMode === 'today') {
      list = list.filter((r) => r.date === todayStr);
    } else if (periodMode === 'month') {
      list = list.filter((r) => r.date.startsWith(selectedMonthValue));
    }

    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.teacherName.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          r.className.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.arrivalTimestampMs || 0) - (a.arrivalTimestampMs || 0));
  }, [
    teachingRecords,
    currentUser.role,
    currentUser.assignedClassId,
    activeClass?.id,
    classFilter,
    periodMode,
    todayStr,
    selectedMonthValue,
    statusFilter,
    searchQuery,
  ]);

  const stats = useMemo(() => {
    const total = scopedRecords.length;
    const activeCount = scopedRecords.filter((r) => r.status === 'mengajar').length;
    const completedCount = scopedRecords.filter((r) => r.status === 'selesai').length;
    const totalMinutes = scopedRecords.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
    return { total, activeCount, completedCount, totalMinutes };
  }, [scopedRecords]);

  const handleExportCsv = () => {
    const header =
      'tanggal,kelas,nama_guru,nip,mata_pelajaran,jam_ke,jam_datang,jam_selesai,durasi_menit,status,catatan_datang,catatan_selesai\n';
    const rows = scopedRecords
      .map(
        (r) =>
          `${r.date},"${r.className}","${r.teacherName}","${r.teacherNip || ''}","${r.subject}","${
            r.lessonPeriod || ''
          }",${r.arrivalTime},${r.completedTime || ''},${r.durationMinutes || 0},${r.status},"${
            r.arrivalNote || ''
          }","${r.closingNote || ''}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_guru_mengajar_${periodMode}_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-7 border border-[#142844] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-emerald-400">
            Monitoring Kehadiran Mengajar via Scan QR Kelas
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {currentUser.role === 'wali_kelas' && activeClass
              ? `Rekap Guru Mengajar · Kelas ${activeClass.name}`
              : 'Rekap Kedatangan & Selesai Mengajar Guru'}
          </h2>
          <p className="text-xs text-slate-300/90 max-w-2xl leading-relaxed">
            Memantau waktu kedatangan guru saat mulai mengajar serta waktu selesai mengajar berdasarkan pemindaian Barcode QR kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {currentUser.role === 'opm' && onOpenQrManager && (
            <button
              type="button"
              onClick={onOpenQrManager}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Kelola Barcode QR</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={scopedRecords.length === 0}
            className="inline-flex items-center gap-2 btn-emerald px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="surface-card p-4">
          <div className="text-xs font-medium text-slate-500">Total Sesi Mengajar</div>
          <div className="text-2xl font-bold text-[#0B192C] tabular-nums mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Rekap kedatangan tercatat</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs font-medium text-slate-500">Sedang Mengajar</div>
          <div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">
            {stats.activeCount}
          </div>
          <div className="text-[11px] text-amber-700 mt-1">Sudah scan masuk</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs font-medium text-slate-500">Selesai Ngajar</div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {stats.completedCount}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">Sudah scan selesai</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs font-medium text-slate-500">Total Jam Mengajar</div>
          <div className="text-2xl font-bold text-[#0B192C] tabular-nums mt-1">
            {Math.floor(stats.totalMinutes / 60)}j {stats.totalMinutes % 60}m
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Akumulasi durasi kelas</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="surface-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama guru atau mapel..."
              className="app-input pl-9"
            />
          </div>

          {currentUser.role === 'opm' && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="app-input w-auto font-semibold cursor-pointer"
            >
              <option value="all">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Kelas {c.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'mengajar' | 'selesai')}
            className="app-input w-auto font-semibold cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="mengajar">Sedang Mengajar (Kedatangan)</option>
            <option value="selesai">Selesai Ngajar</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setPeriodMode('today')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                periodMode === 'today' ? 'bg-white text-[#0B192C] shadow-xs' : 'text-slate-600'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                periodMode === 'month' ? 'bg-white text-[#0B192C] shadow-xs' : 'text-slate-600'
              }`}
            >
              Per Bulan
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                periodMode === 'all' ? 'bg-white text-[#0B192C] shadow-xs' : 'text-slate-600'
              }`}
            >
              Semua
            </button>
          </div>

          {periodMode === 'month' && (
            <input
              type="month"
              value={selectedMonthValue}
              onChange={(e) => setSelectedMonthValue(e.target.value)}
              className="app-input w-auto font-semibold tabular-nums cursor-pointer"
            />
          )}
        </div>
      </div>

      {/* Teaching Attendance List */}
      <div className="surface-card overflow-hidden">
        {scopedRecords.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-[#0B192C]">
              Belum Ada Rekap Guru Mengajar
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Ketika guru memindai Barcode QR kelas melalui menu <strong>Kamera Scan</strong> saat mulai dan selesai mengajar, data kedatangan dan kepulangan mengajar otomatis muncul di sini.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
              {scopedRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[#0B192C] truncate">
                        {rec.teacherName}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Kelas <strong>{rec.className}</strong> · {rec.subject}
                        {rec.lessonPeriod ? ` (Jam ke-${rec.lessonPeriod})` : ''}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                        rec.status === 'mengajar'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {rec.status === 'mengajar' ? 'Sedang Mengajar' : 'Selesai Ngajar'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-slate-500">Rekap Kedatangan</div>
                      <div className="font-mono font-bold text-emerald-700 mt-0.5 tabular-nums">
                        {rec.arrivalTime}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-slate-500">Rekap Selesai Ngajar</div>
                      <div className="font-mono font-bold text-[#0B192C] mt-0.5 tabular-nums">
                        {rec.completedTime
                          ? `${rec.completedTime} (${rec.durationMinutes || 0} mnt)`
                          : 'Belum scan keluar'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono tabular-nums">{rec.date}</span>
                    {rec.closingNote && <span className="truncate max-w-[180px]">{rec.closingNote}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Guru Mengajar</th>
                    <th className="py-3 px-4">Mata Pelajaran</th>
                    <th className="py-3 px-4">Rekap Kedatangan</th>
                    <th className="py-3 px-4">Rekap Selesai Ngajar</th>
                    <th className="py-3 px-4">Durasi</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {rec.date}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#0B192C] whitespace-nowrap">
                        Kelas {rec.className}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0B192C]">{rec.teacherName}</div>
                        {rec.teacherNip && (
                          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                            NIP {rec.teacherNip}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{rec.subject}</div>
                        {rec.lessonPeriod && (
                          <div className="text-[11px] text-slate-500">
                            Jam ke-{rec.lessonPeriod}
                          </div>
                        )}
                        {rec.arrivalNote && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {rec.arrivalNote}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {rec.arrivalTime}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {rec.completedTime ? (
                          <div>
                            <div className="font-mono font-bold text-[#0B192C] tabular-nums whitespace-nowrap">
                              {rec.completedTime}
                            </div>
                            {rec.closingNote && (
                              <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                {rec.closingNote}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Menunggu scan selesai</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {rec.status === 'selesai' ? (
                          <span className="inline-flex items-center gap-1">
                            <Timer className="w-3.5 h-3.5 text-slate-400" />
                            {rec.durationMinutes || 0} menit
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {rec.status === 'mengajar' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                            <Clock className="w-3 h-3" />
                            <span>Sedang Mengajar</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Selesai</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
