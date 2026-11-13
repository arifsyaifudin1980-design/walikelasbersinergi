import React, { useState } from 'react';
import { Archive, CheckCircle2, Download, FileArchive, X } from 'lucide-react';
import { downloadAllStudentReportsZIP } from '../../services/canvasReport';
import { MadrasahProfile, StudentMonthlyRecap } from '../../types';

interface BatchExportModalProps {
  recaps: StudentMonthlyRecap[];
  madrasah: MadrasahProfile;
  className: string;
  homeroomTeacherName: string;
  homeroomTeacherNip?: string;
  academicYear: string;
  semester: string;
  month: number;
  year: number;
  onClose: () => void;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  recaps,
  madrasah,
  className,
  homeroomTeacherName,
  homeroomTeacherNip,
  academicYear,
  semester,
  month,
  year,
  onClose,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: recaps.length,
  });
  const [isCompleted, setIsCompleted] = useState(false);

  const handleStartBatchDownload = async () => {
    setIsExporting(true);
    setIsCompleted(false);

    try {
      await downloadAllStudentReportsZIP(
        recaps,
        {
          madrasah,
          className,
          homeroomTeacherName,
          homeroomTeacherNip,
          academicYear,
          semester,
          month,
          year,
        },
        (current, total) => {
          setProgress({ current, total });
        }
      );
      setIsCompleted(true);
    } catch (err) {
      console.error('Batch export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const percentage = Math.round((progress.current / Math.max(progress.total, 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B192C]/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Clean Modern Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0B192C] flex items-center justify-center text-emerald-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0B192C] leading-tight">
                Unduh Seluruh Laporan (ZIP)
              </h3>
              <p className="text-xs text-slate-500 tabular-nums">
                Kelas {className} · {recaps.length} Siswa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-1.5">
            <div className="font-bold text-[#0B192C] flex items-center gap-1.5">
              <FileArchive className="w-4 h-4 text-emerald-700" />
              <span>Paket Arsip Laporan Kelas</span>
            </div>
            <p className="leading-relaxed text-slate-600">
              Sistem akan merender infografis JPG 1080 × 1350 individual untuk setiap siswa dan mengemasnya ke dalam satu berkas ZIP.
            </p>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#0B192C]">
                <span>Merender gambar JPG...</span>
                <span className="tabular-nums">
                  {progress.current} / {progress.total} ({percentage}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                Memproses diagram lingkaran, kop surat, dan rekap siswa...
              </p>
            </div>
          )}

          {isCompleted && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-sm">Pengunduhan ZIP Berhasil</div>
                <div className="text-emerald-800">Berkas ZIP telah tersimpan di perangkat Anda.</div>
              </div>
            </div>
          )}

          <div className="pt-1">
            {!isCompleted ? (
              <button
                type="button"
                onClick={handleStartBatchDownload}
                disabled={isExporting || recaps.length === 0}
                className="w-full flex items-center justify-center gap-2 btn-emerald font-semibold py-2.5 px-4 rounded-xl text-xs disabled:opacity-60 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sedang Membuat ZIP...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span className="tabular-nums">
                      Generate &amp; Unduh ZIP ({recaps.length} Siswa)
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl btn-navy font-semibold text-xs cursor-pointer"
              >
                Selesai &amp; Tutup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
