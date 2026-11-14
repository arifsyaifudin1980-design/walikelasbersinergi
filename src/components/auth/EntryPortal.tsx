import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ScanLine,
  School,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { User as FirebaseAuthUser } from 'firebase/auth';
import { AuthErrorInfo } from '../../firebase';
import { WaliSession } from '../../types';
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
  waliSession: WaliSession | null;
  waliLoginError: string | null;
  onDismissWaliError: () => void;
  onWaliLogin: (username: string, accessPin: string) => Promise<void>;
  onWaliSignOut: () => void;
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
  waliSession,
  waliLoginError,
  onDismissWaliError,
  onWaliLogin,
  onWaliSignOut,
}) => {
  const [schoolHint, setSchoolHint] = useState<{ name: string; logoUrl: string }>({
    name: '',
    logoUrl: '',
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [showWaliForm, setShowWaliForm] = useState(false);
  const [waliUsername, setWaliUsername] = useState('');
  const [waliPin, setWaliPin] = useState('');
  const [showWaliPin, setShowWaliPin] = useState(false);
  const [isWaliLoggingIn, setIsWaliLoggingIn] = useState(false);
  const waliInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (waliLoginError) {
      setShowWaliForm(true);
    }
  }, [waliLoginError]);

  useEffect(() => {
    if (showWaliForm && !waliSession) {
      waliInputRef.current?.focus();
    }
  }, [showWaliForm, waliSession]);

  const handleLoginClick = async () => {
    setIsLoggingIn(true);
    try {
      await onGoogleLogin();
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleWaliSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waliUsername.trim() || !waliPin.trim()) return;
    setIsWaliLoggingIn(true);
    try {
      await onWaliLogin(waliUsername, waliPin);
    } finally {
      setIsWaliLoggingIn(false);
    }
  };

  const madrasahTitle = schoolHint.name.trim() || 'Presensi Pintar Madrasah';

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col justify-between text-[#0B192C]">
      {/* Minimal Single-Row Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            {schoolHint.logoUrl ? (
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={schoolHint.logoUrl}
                  alt={madrasahTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#0B192C] text-emerald-400 flex items-center justify-center shrink-0">
                <School className="w-4 h-4" />
              </div>
            )}
            <span className="text-sm sm:text-base font-bold text-[#0B192C] truncate">
              {madrasahTitle}
            </span>
          </div>

          {(authUser || waliSession) && (
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline text-xs text-slate-500 truncate max-w-[200px]">
                {authUser ? authUser.email : waliSession?.name}
              </span>
              <button
                type="button"
                onClick={authUser ? onSignOut : onWaliSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C]"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Clean Icon-Centric Portal */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-14">
        <div className="w-full max-w-4xl space-y-8">
          {/* Concise Heading */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B192C] text-balance">
              Pilih Akses Masuk
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {madrasahTitle}
            </p>
          </div>

          {authError && (
            <AuthErrorBanner
              error={authError}
              onDismiss={onDismissAuthError}
              onTryRedirectLogin={onGoogleRedirectLogin}
            />
          )}

          {/* Three Symmetrical Icon Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {/* 1. Admin Icon Card */}
            <div className="surface-card p-6 sm:p-7 flex flex-col items-center justify-between text-center gap-6 hover:border-[#0B192C]/35 transition-colors">
              <div className="flex flex-col items-center gap-4 pt-2">
                <div className="w-20 h-20 rounded-2xl bg-[#0B192C] text-emerald-400 flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-9 h-9 stroke-[1.75]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#0B192C]">Admin</h2>
                  <p className="text-xs text-slate-500">Akun Google Madrasah</p>
                </div>
              </div>

              <div className="w-full space-y-2.5 pt-2">
                {authLoading ? (
                  <div className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold">
                    Memeriksa sesi...
                  </div>
                ) : authUser && isAuthorizedStaff ? (
                  <>
                    <div className="text-xs text-emerald-800 font-medium truncate px-1">
                      {resolvedRoleLabel || authUser.email}
                    </div>
                    <button
                      type="button"
                      onClick={onEnterDashboard}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 btn-navy py-2.5 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C]"
                    >
                      <span>Buka Dashboard</span>
                      <ArrowRight className="w-4 h-4 text-emerald-400" />
                    </button>
                  </>
                ) : authUser && !isAuthorizedStaff ? (
                  <>
                    <div className="text-[11px] text-rose-700 font-medium truncate px-1">
                      Bukan akun Admin ({authUser.email})
                    </div>
                    <button
                      type="button"
                      onClick={handleLoginClick}
                      disabled={isLoggingIn}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 btn-navy py-2.5 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      <span>{isLoggingIn ? 'Menghubungkan...' : 'Ganti Akun Google'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleLoginClick}
                    disabled={isLoggingIn}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 btn-navy py-2.5 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C]"
                  >
                    <span>{isLoggingIn ? 'Menghubungkan...' : 'Masuk Admin'}</span>
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Wali Kelas Icon Card */}
            <div className="surface-card p-6 sm:p-7 flex flex-col items-center justify-between text-center gap-5 hover:border-[#0B192C]/35 transition-colors relative">
              {waliSession ? (
                <>
                  <div className="flex flex-col items-center gap-4 pt-2">
                    <div className="w-20 h-20 rounded-2xl bg-[#162D4C] text-emerald-400 flex items-center justify-center shadow-xs">
                      <UserCheck className="w-9 h-9 stroke-[1.75]" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-[#0B192C] truncate max-w-[210px]">
                        {waliSession.name}
                      </h2>
                      <p className="text-xs text-emerald-700 font-medium">
                        Kelas {waliSession.className || 'Aktif'} · @{waliSession.username}
                      </p>
                    </div>
                  </div>

                  <div className="w-full flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onEnterDashboard}
                      className="flex-1 min-h-[44px] flex items-center justify-center gap-2 btn-navy py-2.5 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C]"
                    >
                      <span>Buka Kelas</span>
                      <ArrowRight className="w-4 h-4 text-emerald-400" />
                    </button>
                    <button
                      type="button"
                      onClick={onWaliSignOut}
                      className="min-h-[44px] px-3 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 cursor-pointer"
                      aria-label="Keluar Sesi Wali Kelas"
                      title="Keluar Sesi Wali Kelas"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : showWaliForm ? (
                <div className="w-full flex flex-col justify-between h-full gap-4 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#162D4C] text-emerald-400 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-[#0B192C]">Wali Kelas</h2>
                        <p className="text-[11px] text-slate-500">Username &amp; PIN</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowWaliForm(false);
                        if (waliLoginError) onDismissWaliError();
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
                      aria-label="Kembali"
                      title="Kembali"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>

                  <form id="wali-login-form" onSubmit={handleWaliSubmit} className="space-y-2.5 text-xs">
                    {waliLoginError && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{waliLoginError}</span>
                      </div>
                    )}

                    <input
                      ref={waliInputRef}
                      type="text"
                      required
                      autoComplete="username"
                      value={waliUsername}
                      onChange={(e) => {
                        if (waliLoginError) onDismissWaliError();
                        setWaliUsername(e.target.value);
                      }}
                      placeholder="Username"
                      aria-label="Username Wali Kelas"
                      className="app-input font-mono min-h-[40px]"
                    />

                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                      <input
                        type={showWaliPin ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={waliPin}
                        onChange={(e) => {
                          if (waliLoginError) onDismissWaliError();
                          setWaliPin(e.target.value);
                        }}
                        placeholder="PIN / Password"
                        aria-label="PIN Wali Kelas"
                        className="app-input font-mono pl-8 pr-9 min-h-[40px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWaliPin((s) => !s)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-[#0B192C] cursor-pointer"
                        aria-label={showWaliPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                      >
                        {showWaliPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </form>

                  <button
                    type="submit"
                    form="wali-login-form"
                    disabled={isWaliLoggingIn || !waliUsername.trim() || !waliPin.trim()}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 btn-navy py-2.5 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <span>{isWaliLoggingIn ? 'Memeriksa...' : 'Masuk'}</span>
                    <ArrowRight className="w-4 h-4 text-emerald-400" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-4 pt-2">
                    <div className="w-20 h-20 rounded-2xl bg-[#162D4C] text-emerald-400 flex items-center justify-center shadow-xs">
                      <Users className="w-9 h-9 stroke-[1.75]" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-bold text-[#0B192C]">Wali Kelas</h2>
                      <p className="text-xs text-slate-500">Username &amp; PIN</p>
                    </div>
                  </div>

                  <div className="w-full pt-2">
                    <button
                      type="button"
                      onClick={() => setShowWaliForm(true)}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 btn-navy py-2.5 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B192C]"
                    >
                      <span>Masuk Wali Kelas</span>
                      <ArrowRight className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 3. Kamera Scan Guru Icon Card */}
            <div className="surface-card p-6 sm:p-7 flex flex-col items-center justify-between text-center gap-6 hover:border-emerald-500/60 transition-colors">
              <div className="flex flex-col items-center gap-4 pt-2">
                <div className="w-20 h-20 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <ScanLine className="w-9 h-9 stroke-[1.75]" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#0B192C]">Absen Guru</h2>
                  <p className="text-xs text-slate-500">Kamera Scan QR Kelas</p>
                </div>
              </div>

              <div className="w-full pt-2">
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 btn-emerald py-2.5 px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Buka Kamera</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200/80 py-3.5 text-center text-[11px] text-slate-400">
        {madrasahTitle} · Sistem Presensi Siswa &amp; Guru Mengajar
      </footer>
    </div>
  );
};
