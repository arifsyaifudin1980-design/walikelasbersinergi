import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  History,
  MessageCircle,
  Search,
} from 'lucide-react';
import { MadrasahProfile, ReportArchiveItem } from '../../types';

interface ReportArchiveViewProps {
  archives: ReportArchiveItem[];
  madrasah: MadrasahProfile;
  onPreviewArchive: (archive: ReportArchiveItem) => void;
  onReshareWhatsApp: (archive: ReportArchiveItem) => void;
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

export const ReportArchiveView: React.FC<ReportArchiveViewProps> = ({
  archives,
  onPreviewArchive,
  onReshareWhatsApp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'terkirim' | 'belum_dikirim'>('all');

  const deliveredCount = archives.filter((a) => a.deliveryStatus === 'terkirim').length;
  const pendingCount = archives.length - deliveredCount;
  const avgPercentage =
    archives.length > 0
      ? Math.round(archives.reduce((acc, a) => acc + a.percentage, 0) / archives.length)
      : 0;

  const filteredArchives = archives.filter((item) => {
    const matchesSearch =
      item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.className.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.deliveryStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      {/* Deep Navy Header Banner */}
      <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-7 border border-[#142844] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-emerald-400">
            Arsip Dokumen &amp; Distribusi Orang Tua
          </div>
          <h2 className="text-xl font-bold tracking-tight text-balance">
            Arsip &amp; Riwayat Laporan JPG
          </h2>
          <p className="text-xs text-slate-300/90 max-w-2xl leading-relaxed">
            Seluruh infografis presensi individual yang dihasilkan tersimpan rapi beserta status pengirimannya via WhatsApp.
          </p>
        </div>
        <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs shrink-0 tabular-nums">
          <span className="text-slate-300">Total Tersimpan: </span>
          <span className="font-bold text-white">{archives.length} Laporan</span>
        </div>
      </div>

      {/* 4-Column Archive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="surface-card p-4">
          <div className="text-xs font-medium text-slate-500">Total Arsip JPG</div>
          <div className="text-2xl font-bold text-[#0B192C] tabular-nums mt-1">{archives.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Laporan individual</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs font-medium text-slate-500">Terkirim WhatsApp</div>
          <div className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">{deliveredCount}</div>
          <div className="text-[11px] text-emerald-600 mt-1">Sudah diterima wali</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs font-medium text-slate-500">Menunggu Kirim</div>
          <div className="text-2xl font-bold text-amber-600 tabular-nums mt-1">{pendingCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Baru diunduh / draf</div>
        </div>
        <div className="surface-card p-4">
          <div className="text-xs font-medium text-slate-500">Rata-rata Kehadiran</div>
          <div className="text-2xl font-bold text-[#0B192C] tabular-nums mt-1">
            {archives.length > 0 ? `${avgPercentage}%` : '-'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Dari seluruh arsip</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="surface-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama siswa atau kelas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="app-input pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
              statusFilter === 'all'
                ? 'bg-[#0B192C] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0B192C]'
            }`}
          >
            Semua ({archives.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('terkirim')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
              statusFilter === 'terkirim'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0B192C]'
            }`}
          >
            Terkirim ({deliveredCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('belum_dikirim')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
              statusFilter === 'belum_dikirim'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0B192C]'
            }`}
          >
            Belum Dikirim ({pendingCount})
          </button>
        </div>
      </div>

      {/* Archive Content */}
      {filteredArchives.length > 0 ? (
        <>
          {/* Mobile Card Stack (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredArchives.map((item) => {
              const monthName = MONTH_NAMES[item.month - 1] || 'Bulan';
              return (
                <div
                  key={item.id}
                  className="surface-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-[#0B192C] truncate">
                        {item.studentName}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Kelas {item.className} · {monthName} {item.year} · Ver. {item.version}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-xs tabular-nums shrink-0 ${
                        item.percentage >= 90
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.percentage >= 75
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {item.percentage}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    {item.deliveryStatus === 'terkirim' ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Terkirim</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Belum Dikirim</span>
                      </div>
                    )}
                    <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                      {item.parentWhatsapp ? `+${item.parentWhatsapp}` : '-'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onPreviewArchive(item)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B192C] text-xs font-semibold cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Pratinjau</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReshareWhatsApp(item)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl btn-emerald text-xs font-semibold cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Kirim WA</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (md+) */}
          <div className="hidden md:block surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[#0B192C] font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Periode</th>
                    <th className="py-3 px-4 text-center">Kehadiran</th>
                    <th className="py-3 px-4">Dibuat Oleh</th>
                    <th className="py-3 px-4">Status WhatsApp</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredArchives.map((item) => {
                    const monthName = MONTH_NAMES[item.month - 1] || 'Bulan';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#0B192C]">{item.studentName}</div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {item.parentWhatsapp ? `+${item.parentWhatsapp}` : '-'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          Kelas {item.className}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#0B192C]">
                            {monthName} {item.year}
                          </div>
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            Versi {item.version}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-bold text-xs tabular-nums ${
                              item.percentage >= 90
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : item.percentage >= 75
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>{item.createdByName}</div>
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            {new Date(item.createdAt).toLocaleDateString('id-ID')}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {item.deliveryStatus === 'terkirim' ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Terkirim</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Belum Dikirim</span>
                            </div>
                          )}
                          {item.lastDeliveredAt && (
                            <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                              {new Date(item.lastDeliveredAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onPreviewArchive(item)}
                              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B192C] transition-colors cursor-pointer"
                              title="Buka Pratinjau Laporan"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onReshareWhatsApp(item)}
                              className="p-2 rounded-xl btn-emerald transition-colors cursor-pointer"
                              title="Kirim ke WhatsApp Orang Tua"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="surface-card p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto mb-3">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B192C]">
            {archives.length === 0 ? 'Belum ada arsip laporan' : 'Arsip tidak ditemukan'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {archives.length === 0
              ? 'Laporan JPG yang Anda unduh atau bagikan ke WhatsApp akan otomatis tercatat di sini.'
              : 'Ubah kata kunci pencarian atau pilih filter status lainnya.'}
          </p>
        </div>
      )}
    </div>
  );
};
