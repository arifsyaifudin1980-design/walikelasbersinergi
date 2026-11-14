import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Save, School, Trash2, Upload, X } from 'lucide-react';
import { MadrasahProfile } from '../../types';
import { readAndCompressImage } from '../../utils/imageUpload';

interface MadrasahProfileModalProps {
  profile: MadrasahProfile;
  onSave: (profile: MadrasahProfile) => Promise<boolean> | void;
  onClose: () => void;
}

export const MadrasahProfileModal: React.FC<MadrasahProfileModalProps> = ({
  profile,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<MadrasahProfile>({ ...profile });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Format file harus berupa gambar.');
      return;
    }
    try {
      const { dataUrl } = await readAndCompressImage(file, 480, 480, 0.9);
      setFormData((prev) => ({ ...prev, logoUrl: dataUrl }));
    } catch {
      setUploadError('Gagal memproses file logo.');
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSave(formData);
    if (ok !== false) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0B192C] text-emerald-400 flex items-center justify-center">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0B192C]">Pengaturan Identitas &amp; Logo Madrasah</h3>
              <p className="text-xs text-slate-500">Digunakan pada Kop Laporan Presensi JPG resmi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
            {/* Wadah Logo preview and upload */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 flex items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center shrink-0 overflow-hidden cursor-pointer transition-colors ${
                  formData.logoUrl
                    ? 'bg-white border border-slate-200 p-1.5'
                    : 'bg-white border-2 border-dashed border-slate-300 hover:border-[#0B192C] text-slate-400 hover:text-[#0B192C]'
                }`}
              >
                {formData.logoUrl ? (
                  <img src={formData.logoUrl} alt="Logo Madrasah" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 mb-1 stroke-[1.5]" />
                    <span className="text-[10px] font-semibold">Wadah Logo</span>
                  </>
                )}
              </div>

              <div className="space-y-1.5 flex-1">
                <span className="font-semibold text-[#0B192C] block">Logo Resmi Madrasah</span>
                <p className="text-[11px] text-slate-500">
                  Format PNG/JPG/SVG disarankan rasio 1:1.
                </p>
                {uploadError && <p className="text-[11px] text-rose-600 font-medium">{uploadError}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-semibold text-[#0B192C] cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{formData.logoUrl ? 'Ganti Logo' : 'Unggah Logo'}</span>
                  </button>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, logoUrl: '' }))}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 px-2 py-1.5 font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Resmi Madrasah *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="app-input font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kota / Kabupaten</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="app-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NSM</label>
                <input
                  type="text"
                  value={formData.nsm}
                  onChange={(e) => setFormData({ ...formData, nsm: e.target.value })}
                  className="app-input font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NPSN</label>
                <input
                  type="text"
                  value={formData.npsn}
                  onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                  className="app-input font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="app-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="app-input"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Resmi</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="app-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Madrasah</label>
                <input
                  type="text"
                  value={formData.headmasterName}
                  onChange={(e) => setFormData({ ...formData, headmasterName: e.target.value })}
                  className="app-input"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">NIP Kepala Madrasah</label>
                <input
                  type="text"
                  value={formData.headmasterNip}
                  onChange={(e) => setFormData({ ...formData, headmasterNip: e.target.value })}
                  className="app-input font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5 text-xs shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl btn-navy font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simpan Profil</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
