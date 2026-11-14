import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  FileImage,
  MessageCircle,
  X,
} from 'lucide-react';
import {
  downloadStudentReportJPG,
  generateStudentReportJPG,
} from '../../services/canvasReport';
import { storageService } from '../../services/storage';
import { shareReportToWhatsApp } from '../../services/whatsapp';
import { MadrasahProfile, StudentMonthlyRecap } from '../../types';

interface ReportPreviewModalProps {
  recap: StudentMonthlyRecap;
  madrasah: MadrasahProfile;
  className: string;
  homeroomTeacherName: string;
  homeroomTeacherNip?: string;
  academicYear: string;
  semester: string;
  onClose: () => void;
  onDelivered?: () => void;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  recap,
  madrasah,
  className,
  homeroomTeacherName,
  homeroomTeacherNip,
  academicYear,
  semester,
  onClose,
  onDelivered,
}) => {
  const [customNote, setCustomNote] = useState<string>('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);

  useEffect(() => {
    const defaultNote =
      recap.attendancePercentage >= 95
        ? 'Alhamdulillah, kehadiran ananda sangat luar biasa! Terus pertahankan kedisiplinan dan semangat belajar.'
        : recap.attendancePercentage >= 85
        ? 'Kehadiran ananda cukup baik. Diharapkan terus ditingkatkan agar pemahaman materi pembelajaran semakin optimal.'
        : 'Kehadiran ananda memerlukan perhatian khusus dan kerjasama aktif orang tua untuk memotivasi ananda hadir di madrasah.';
    setCustomNote(defaultNote);
  }, [recap]);

  useEffect(() => {
    let isCancelled = false;
    const generatePreview = async () => {
      setIsGenerating(true);
      try {
        const dataUrl = await generateStudentReportJPG({
          recap,
          madrasah,
          className,
          homeroomTeacherName,
          homeroomTeacherNip,
          academicYear,
          semester,
          customNote,
        });
        if (!isCancelled) {
          setPreviewDataUrl(dataUrl);
        }
      } catch (err) {
        console.error('Failed to generate preview:', err);
      } finally {
        if (!isCancelled) setIsGenerating(false);
      }
    };

    generatePreview();
    return () => {
      isCancelled = true;
    };
  }, [recap, madrasah, className, homeroomTeacherName, homeroomTeacherNip, academicYear, semester, customNote]);

  const handleDownload = async () => {
    await downloadStudentReportJPG({
      recap,
      madrasah,
      className,
      homeroomTeacherName,
      homeroomTeacherNip,
      academicYear,
      semester,
      customNote,
    });

    await storageService.saveArchiveItem({
      id: `rep_${recap.student.id}_${recap.month}_${recap.year}`,
      studentId: recap.student.id,
      studentName: recap.student.name,
      classId: recap.student.classId,
      className,
      month: recap.month,
      year: recap.year,
      academicYear,
      effectiveDays: recap.effectiveDays,
      hadir: recap.hadir,
      sakit: recap.sakit,
      izin: recap.izin,
      alpa: recap.alpa,
      percentage: recap.attendancePercentage,
      createdAt: new Date().toISOString(),
      createdByName: homeroomTeacherName,
      version: 1,
      customNote,
      deliveryStatus: 'belum_dikirim',
      parentWhatsapp: recap.student.parentWhatsapp,
    });
    if (onDelivered) onDelivered();
  };

  const handleShareWhatsApp = async () => {
    const payload = {
      recap,
      madrasahName: madrasah.name,
      className,
      homeroomTeacherName,
      customNote,
    };

    const renderOpts = {
      recap,
      madrasah,
      className,
      homeroomTeacherName,
      homeroomTeacherNip,
      academicYear,
      semester,
      customNote,
    };

    await storageService.saveArchiveItem({
      id: `rep_${recap.student.id}_${recap.month}_${recap.year}`,
      studentId: recap.student.id,
      studentName: recap.student.name,
      classId: recap.student.classId,
      className,
      month: recap.month,
      year: recap.year,
      academicYear,
      effectiveDays: recap.effectiveDays,
      hadir: recap.hadir,
      sakit: recap.sakit,
      izin: recap.izin,
      alpa: recap.alpa,
      percentage: recap.attendancePercentage,
      createdAt: new Date().toISOString(),
      createdByName: homeroomTeacherName,
      version: 1,
      customNote,
      deliveryStatus: 'terkirim',
      lastDeliveredAt: new Date().toISOString(),
      parentWhatsapp: recap.student.parentWhatsapp,
    });

    const res = await shareReportToWhatsApp(payload, renderOpts);
    if (res.success) {
      setShareSuccess(
        res.method === 'web_share'
          ? 'Berhasil dibagikan langsung via fitur berbagi perangkat.'
          : 'Membuka WhatsApp ke kontak orang tua...'
      );
      if (onDelivered) onDelivered();
      setTimeout(() => setShareSuccess(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B192C]/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Deep Navy Modal Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0B192C] flex items-center justify-center text-emerald-400 shrink-0">
              <FileImage className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500">
                Pratinjau Laporan JPG · Kelas {className} · 1080 × 1350 px
              </div>
              <h2 className="text-base font-bold text-[#0B192C] truncate">
                {recap.student.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Tutup pratinjau"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#F6F8FB]">
          {/* Left: High Definition Visual JPG Preview */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="w-full max-w-[420px] flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-bold text-[#0B192C]">Output Infografis</span>
              <span className="tabular-nums">Rasio 4:5 (Siap Kirim)</span>
            </div>

            <div className="relative w-full max-w-[420px] aspect-[4/5] bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs flex items-center justify-center">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt={`Laporan Presensi ${recap.student.name}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Merender infografis presensi...</span>
                </div>
              )}

              {isGenerating && (
                <div className="absolute inset-0 bg-white/75 backdrop-blur-xs flex items-center justify-center">
                  <div className="flex items-center gap-2 bg-[#0B192C] text-white px-3.5 py-2 rounded-xl text-xs font-semibold">
                    <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Memperbarui desain...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Controls, Details & WhatsApp Share */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Metrics Summary */}
              <div className="surface-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0B192C]">
                    Ringkasan Kehadiran
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md tabular-nums ${
                      recap.attendancePercentage >= 90
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : recap.attendancePercentage >= 75
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {recap.attendancePercentage}% Kehadiran
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center pt-1">
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                    <div className="text-[11px] font-medium text-emerald-700">Hadir</div>
                    <div className="text-lg font-bold text-[#0B192C] tabular-nums mt-0.5">{recap.hadir}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                    <div className="text-[11px] font-medium text-amber-700">Sakit</div>
                    <div className="text-lg font-bold text-[#0B192C] tabular-nums mt-0.5">{recap.sakit}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                    <div className="text-[11px] font-medium text-blue-700">Izin</div>
                    <div className="text-lg font-bold text-[#0B192C] tabular-nums mt-0.5">{recap.izin}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
                    <div className="text-[11px] font-medium text-rose-700">Alpa</div>
                    <div className="text-lg font-bold text-[#0B192C] tabular-nums mt-0.5">{recap.alpa}</div>
                  </div>
                </div>

                {!recap.isDataComplete && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="tabular-nums">
                      Masih ada <strong>{recap.unrecordedDays} hari</strong> presensi belum tercatat.
                    </span>
                  </div>
                )}
              </div>

              {/* Editable Teacher Note */}
              <div className="surface-card p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0B192C] flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Catatan Wali Kelas</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsEditingNote(!isEditingNote)}
                    className="text-xs text-emerald-700 font-semibold hover:underline cursor-pointer"
                  >
                    {isEditingNote ? 'Selesai' : 'Ubah'}
                  </button>
                </div>

                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  rows={3}
                  className="app-input leading-relaxed resize-none"
                  placeholder="Tuliskan catatan khusus untuk orang tua..."
                />

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomNote(
                        'Alhamdulillah, kehadiran ananda sangat luar biasa! Terus pertahankan kedisiplinan dan semangat belajar.'
                      )
                    }
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer border border-slate-200"
                  >
                    Sangat Baik
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomNote(
                        'Kehadiran ananda cukup baik. Diharapkan terus ditingkatkan agar prestasi belajar kian optimal.'
                      )
                    }
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer border border-slate-200"
                  >
                    Cukup Baik
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomNote(
                        'Kehadiran ananda memerlukan perhatian khusus dan kerjasama aktif orang tua untuk memotivasi ananda hadir di madrasah.'
                      )
                    }
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-800 transition-colors cursor-pointer border border-slate-200"
                  >
                    Perlu Perhatian
                  </button>
                </div>
              </div>

              {/* Parental WhatsApp Contact */}
              <div className="surface-card p-4 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Kontak Orang Tua / Wali</span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    {recap.student.parentWhatsapp ? 'WhatsApp Siap' : 'Belum diisi'}
                  </span>
                </div>
                <div className="text-xs font-bold text-[#0B192C]">
                  {recap.student.parentName || '-'}
                </div>
                <div className="text-xs font-mono text-slate-600 tabular-nums">
                  {recap.student.parentWhatsapp ? `+${recap.student.parentWhatsapp}` : 'Nomor WhatsApp belum terdaftar'}
                </div>
              </div>

              {shareSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{shareSuccess}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full flex items-center justify-center gap-2 btn-emerald font-semibold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Bagikan ke WhatsApp Orang Tua</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 btn-navy font-semibold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Unduh Gambar JPG Individual</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="tabular-nums">Format JPEG 1080 × 1350 px</div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-[#0B192C] hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
