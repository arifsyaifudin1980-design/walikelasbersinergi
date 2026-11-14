import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { MadrasahProfile } from '../../types';
import { readAndCompressImage } from '../../utils/imageUpload';

interface MadrasahSettingsViewProps {
  profile: MadrasahProfile;
  onSave: (profile: MadrasahProfile) => Promise<boolean> | void;
  onResetAllData: () => void;
}

export const MadrasahSettingsView: React.FC<MadrasahSettingsViewProps> = ({
  profile,
  onSave,
  onResetAllData,
}) => {
  const [formData, setFormData] = useState<MadrasahProfile>({ ...profile });
  const [isDragging, setIsDragging] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormData({ ...profile });
  }, [profile]);

  const processLogoFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Format file harus berupa gambar (PNG, JPG, WebP, atau SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran file logo maksimal 5 MB.');
      return;
    }
    try {
      const { dataUrl } = await readAndCompressImage(file, 480, 480, 0.9);
      const updated = { ...formData, logoUrl: dataUrl };
      setFormData(updated);
      const ok = await onSave(updated);
      if (ok !== false) {
        setSavedBanner(true);
        setTimeout(() => setSavedBanner(false), 3000);
      }
    } catch {
      setUploadError('Gagal membaca berkas gambar. Silakan pilih file lain.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processLogoFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processLogoFile(file);
  };

  const handleRemoveLogo = async () => {
    const updated = { ...formData, logoUrl: '' };
    setFormData(updated);
    const ok = await onSave(updated);
    if (ok !== false) {
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSave(formData);
    if (ok !== false) {
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Deep Navy Header Banner */}
      <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-7 border border-[#142844] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-emerald-400">
            Konfigurasi Identitas &amp; Kop Laporan
          </div>
          <h2 className="text-xl font-bold tracking-tight text-balance">
            Profil &amp; Wadah Logo Madrasah
          </h2>
          <p className="text-xs text-slate-300/90 max-w-2xl leading-relaxed">
            Unggah logo resmi dan lengkapi identitas lembaga agar otomatis tampil di sidebar navigasi serta kop laporan JPG.
          </p>
        </div>

        {savedBanner && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-200 text-xs font-semibold shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Pengaturan tersimpan</span>
          </div>
        )}
      </div>

      {/* 12-Column Split Workspace */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 4 Columns: Wadah Logo + Live Kop Preview */}
        <div className="lg:col-span-4 space-y-5">
          {/* Wadah Logo Card */}
          <div className="surface-card p-5 space-y-4">
            <div>
              <div className="text-sm font-bold text-[#0B192C]">Wadah Logo Madrasah</div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Belum ada logo bawaan. Unggah logo resmi lembaga Anda (PNG, JPG, WebP, SVG maks. 5 MB).
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full aspect-square max-w-[200px] mx-auto rounded-2xl flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-colors ${
                formData.logoUrl
                  ? 'border border-slate-200 bg-white p-4 hover:border-emerald-500'
                  : isDragging
                  ? 'border-2 border-dashed border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-2 border-dashed border-slate-300 bg-slate-50/70 text-slate-400 hover:border-[#0B192C] hover:text-[#0B192C]'
              }`}
            >
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt="Logo Madrasah"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-center px-4">
                  <ImageIcon className="w-9 h-9 mb-2 stroke-[1.5]" />
                  <span className="text-xs font-bold text-[#0B192C]">Wadah Logo</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Klik atau seret berkas</span>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="text-xs text-rose-600 font-medium text-center">{uploadError}</div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl btn-navy text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>{formData.logoUrl ? 'Ganti Logo' : 'Unggah Logo'}</span>
              </button>

              {formData.logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Kop Laporan Preview Card */}
          <div className="surface-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0B192C]">Pratinjau Kop Laporan JPG</span>
              <span className="text-[11px] font-medium text-emerald-700">Otomatis</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex items-center gap-3 pb-2.5 border-b-2 border-[#0B192C]">
                <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden p-1">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Preview Kop"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#0B192C] truncate">
                    {formData.name || 'Nama Madrasah Belum Diisi'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono tabular-nums truncate mt-0.5">
                    NSM {formData.nsm || '-'} · NPSN {formData.npsn || '-'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {formData.address || 'Alamat lengkap madrasah'}
                    {formData.city ? `, ${formData.city}` : ''}
                  </div>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between text-[10px] text-slate-500">
                <span>Penandatangan:</span>
                <span className="font-semibold text-[#0B192C] truncate max-w-[160px]">
                  {formData.headmasterName || 'Kepala Madrasah'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 8 Columns: Structured Identity Form */}
        <div className="lg:col-span-8 surface-card overflow-hidden">
          <div className="p-6 space-y-6">
            {/* Group 1: Identitas Lembaga */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0B192C]">Identitas Resmi Lembaga</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Nama dan nomor registrasi resmi madrasah sesuai data Kemenag/Kemendikdasmen.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Nama Madrasah / Sekolah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: MTs Negeri 1 ..."
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Kota / Kabupaten (Titimangsa Laporan)
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Contoh: Bandung"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    NSM (Nomor Statistik Madrasah)
                  </label>
                  <input
                    type="text"
                    value={formData.nsm}
                    onChange={(e) => setFormData({ ...formData, nsm: e.target.value })}
                    placeholder="12 digit NSM"
                    className="app-input font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">NPSN</label>
                  <input
                    type="text"
                    value={formData.npsn}
                    onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                    placeholder="8 digit NPSN"
                    className="app-input font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Group 2: Kontak & Lokasi */}
            <div className="pt-5 border-t border-slate-100 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0B192C]">Alamat &amp; Kontak Resmi</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1.5">Alamat Lengkap</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Jl. ..."
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Nomor Telepon</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(022) ..."
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Email Resmi</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="info@madrasah.sch.id"
                    className="app-input"
                  />
                </div>
              </div>
            </div>

            {/* Group 3: Penandatangan */}
            <div className="pt-5 border-t border-slate-100 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0B192C]">Kepala Madrasah</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ditampilkan pada bagian pengesahan laporan presensi bulanan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Nama Kepala Madrasah</label>
                  <input
                    type="text"
                    value={formData.headmasterName}
                    onChange={(e) => setFormData({ ...formData, headmasterName: e.target.value })}
                    placeholder="Nama lengkap & gelar"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">NIP Kepala Madrasah</label>
                  <input
                    type="text"
                    value={formData.headmasterNip}
                    onChange={(e) => setFormData({ ...formData, headmasterNip: e.target.value })}
                    placeholder="18 digit NIP"
                    className="app-input font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save & Reset Bar */}
          <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset &amp; Kosongkan Semua Data</span>
            </button>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-emerald text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Pengaturan</span>
            </button>
          </div>
        </div>
      </form>

      {/* Confirm Reset Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="p-6 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0B192C]">Kosongkan Seluruh Data Aplikasi?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Tindakan ini akan menghapus seluruh data siswa, kelas, barcode QR, presensi siswa, rekap guru mengajar, foto bukti, logo, dan arsip laporan yang tersimpan di database cloud madrasah.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResetOpen(false);
                  onResetAllData();
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Ya, Kosongkan Semua Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
