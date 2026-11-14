import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  LogIn,
  LogOut,
  QrCode,
  ScanLine,
  School,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { User as FirebaseAuthUser } from 'firebase/auth';
import { AuthErrorInfo } from '../../firebase';
import { AuthErrorBanner } from './AuthErrorBanner';

interface EntryPortalProps {
  authUser: FirebaseAuthUser | null;
  authLoading: boolean;
  authError: AuthErrorInfo | null;
  onDismissAuthError: () => void;
  isAuthorizedStaff: boolean;
  resolvedRoleLabel?: string;
  onGoogleLogin: () => Promise<void>;
  onGoogleRedirectLogin?: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onEnterDashboard: () => void;
  onOpenScanner: () => void;
}

export const EntryPortal: React.FC<EntryPortalProps> = ({
  authUser,
  authLoading,
  authError,
  onDismissAuthError,
  isAuthorizedStaff,
  resolvedRoleLabel,
  onGoogleLogin,
  onGoogleRedirectLogin,
  onSignOut,
  onEnterDashboard,
  onOpenScanner,
}) => {
  const [schoolHint, setSchoolHint] = useState<{ name: string; logoUrl: string }>({
    name: '',
    logoUrl: '',
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('presensi_public_hint');
      if (raw) {
        const parsed = JSON.parse(raw) as { name?: string; logoUrl?: string };
        setSchoolHint({
          name: parsed.name || '',
          logoUrl: parsed.logoUrl || '',
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLoginClick = async () => {
    setIsLoggingIn(true);
    try {
      await onGoogleLogin();
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col justify-between text-[#0B192C]">
      {/* Top Minimal Institutional Strip */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {schoolHint.logoUrl ? (
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={schoolHint.logoUrl}
                  alt="Logo Madrasah"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#0B192C] text-emerald-400 flex items-center justify-center shrink-0">
                <School className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#0B192C] truncate">
                {schoolHint.name.trim() || 'Presensi Pintar Madrasah'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Sistem Monitoring Presensi Siswa &amp; Kehadiran Guru Mengajar
              </div>
            </div>
          </div>

          {authUser && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-xs text-slate-600 truncate max-w-[200px]">
                {authUser.email}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Dual-Menu Portal */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-4xl space-y-6">
          {/* Deep Navy Hero Intro */}
          <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-8 border border-[#142844] shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Penyimpanan Cloud Aktif &amp; Real-Time</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                  Portal Akses {schoolHint.name.trim() || 'Presensi Pintar Madrasah'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                  Pilih menu akses di bawah ini: masuk ke panel administrasi &amp; wali kelas atau langsung buka kamera scan untuk mencatat kedatangan dan selesai mengajar guru di kelas.
                </p>
              </div>
            </div>
          </div>

          {authError && (
            <AuthErrorBanner
              error={authError}
              onDismiss={onDismissAuthError}
              onTryRedirectLogin={onGoogleRedirectLogin}
            />
          )}

          {/* Two Primary Entry Menus: Login & Kamera Scan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Menu 1: Login (Admin/OPM & Wali Kelas) */}
            <div className="surface-card p-6 sm:p-7 flex flex-col justify-between gap-6 hover:border-[#0B192C]/40 transition-colors">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0B192C] text-emerald-400 flex items-center justify-center shrink-0">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-[#0B192C] border border-slate-200">
                    Panel Pengelola
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#0B192C]">
                    Menu Login (Admin &amp; Wali Kelas)
                  </h2>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Untuk Administrator/OPM dan Wali Kelas: kelola data siswa, buat barcode QR kelas, input presensi &amp; bukti foto, pantau rekap guru mengajar, serta ekspor laporan JPG.
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-slate-600 pt-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Generate &amp; unduh poster Barcode QR per kelas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Rekap kedatangan &amp; selesai mengajar di Wali Kelas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Data tersimpan aman di cloud lintas hari &amp; perangkat</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                {authLoading ? (
                  <div className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold text-center">
                    Memeriksa sesi akun...
                  </div>
                ) : authUser && isAuthorizedStaff ? (
                  <>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex items-center gap-2.5">
                      <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-emerald-950 truncate">
                          {authUser.displayName || authUser.email}
                        </div>
                        <div className="text-[11px] text-emerald-800 truncate">
                          Terverifikasi sebagai {resolvedRoleLabel || 'Staf Madrasah'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onEnterDashboard}
                      className="w-full flex items-center justify-center gap-2 btn-navy py-3 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      <span>Masuk ke Dashboard</span>
                      <ArrowRight className="w-4 h-4 text-emerald-400" />
                    </button>
                  </>
                ) : authUser && !isAuthorizedStaff ? (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                      Email <strong className="font-mono">{authUser.email}</strong> belum terdaftar pada menu <em>Akun Pengguna</em>. Jika Anda guru mata pelajaran, gunakan menu <strong>Kamera Scan</strong> di samping, atau minta Admin mendaftarkan email Anda sebagai Wali Kelas.
                    </div>
                    <button
                      type="button"
                      onClick={handleLoginClick}
                      disabled={isLoggingIn}
                      className="w-full flex items-center justify-center gap-2 btn-navy py-3 px-4 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      <LogIn className="w-4 h-4 text-emerald-400" />
                      <span>Ganti Akun Google</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleLoginClick}
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-2 btn-navy py-3 px-4 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    <LogIn className="w-4 h-4 text-emerald-400" />
                    <span>{isLoggingIn ? 'Menghubungkan Google...' : 'Login dengan Akun Google'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Menu 2: Kamera Scan (Absen Guru Ngajar di Kelas) */}
            <div className="surface-card p-6 sm:p-7 flex flex-col justify-between gap-6 border-emerald-200/80 hover:border-emerald-500/70 transition-colors">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <ScanLine className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Khusus Guru Mengajar
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#0B192C]">
                    Menu Kamera Scan (Absen Guru)
                  </h2>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Arahkan kamera ke Barcode QR yang tertempel di ruang kelas untuk mencatat waktu kedatangan saat mulai mengajar serta waktu selesai mengajar.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F6F8FB] border border-slate-200/80 space-y-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-semibold text-[#0B192C]">
                    <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Alur Scan 2 Langkah di Kelas</span>
                  </div>
                  <div className="text-[11px] text-slate-600 leading-relaxed">
                    1. Scan QR saat masuk kelas ➔ Rekap <strong>Kedatangan</strong> masuk ke Wali Kelas.<br />
                    2. Scan QR kembali usai mengajar ➔ Rekap <strong>Selesai Ngajar</strong> &amp; durasi tercatat otomatis.
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="w-full flex items-center justify-center gap-2 btn-emerald py-3 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Buka Kamera Scan QR Kelas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200/80 py-3.5 text-center text-[11px] text-slate-400">
        {schoolHint.name.trim() || 'Presensi Pintar Madrasah'} · Platform Presensi Siswa &amp; Kehadiran Mengajar
      </footer>
    </div>
  );
};
