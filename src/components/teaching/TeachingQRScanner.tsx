import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { User as FirebaseAuthUser } from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  KeyRound,
  QrCode,
  RefreshCw,
  ScanLine,
  School,
  StopCircle,
  Upload,
} from 'lucide-react';
import {
  firestoreService,
  formatDateYYYYMMDD,
} from '../../services/firestoreService';
import { parseClassQrPayload } from '../../services/qrPoster';
import { ClassQrCodeRegistry, TeachingAttendanceRecord } from '../../types';

interface TeachingQRScannerProps {
  authUser: FirebaseAuthUser | null;
  onBackToPortal: () => void;
}

const SCANNER_ELEMENT_ID = 'ppm-qr-camera-region';
const DEVICE_TEACHER_ID_KEY = 'ppm_guru_device_id';
const TEACHER_PROFILE_KEY = 'ppm_guru_profile';
const LOCAL_SESSIONS_KEY = 'ppm_guru_sessions';

function getOrCreateDeviceTeacherId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_TEACHER_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{6,100}$/.test(existing)) {
      return existing;
    }
    const created = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_TEACHER_ID_KEY, created);
    return created;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

function loadLocalTeacherProfile(): { name: string; nip: string } {
  try {
    const raw = localStorage.getItem(TEACHER_PROFILE_KEY);
    if (!raw) return { name: '', nip: '' };
    const parsed = JSON.parse(raw) as { name?: string; nip?: string };
    return { name: parsed.name || '', nip: parsed.nip || '' };
  } catch {
    return { name: '', nip: '' };
  }
}

function saveLocalTeacherProfile(name: string, nip: string): void {
  try {
    localStorage.setItem(TEACHER_PROFILE_KEY, JSON.stringify({ name, nip }));
  } catch {
    // ignore storage errors
  }
}

function loadLocalSessions(): TeachingAttendanceRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TeachingAttendanceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalSessions(records: TeachingAttendanceRecord[]): void {
  try {
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(records.slice(0, 30)));
  } catch {
    // ignore storage errors
  }
}

const QUICK_SUBJECTS = [
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Arab',
  'Bahasa Inggris',
  'IPA',
  'IPS',
  'Fiqih',
  'Akidah Akhlak',
  'Al-Quran Hadits',
  'SKI',
  'PKn',
  'PJOK',
];

export const TeachingQRScanner: React.FC<TeachingQRScannerProps> = ({
  authUser,
  onBackToPortal,
}) => {
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isVerifyingQr, setIsVerifyingQr] = useState(false);

  // Scanned Class & Active Session State
  const [verifiedClassQr, setVerifiedClassQr] = useState<ClassQrCodeRegistry | null>(null);
  const [activeClassSessions, setActiveClassSessions] = useState<TeachingAttendanceRecord[]>([]);
  const [recentHistory, setRecentHistory] = useState<TeachingAttendanceRecord[]>([]);
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);

  // Check-in / Check-out Form State
  const initialProfile = loadLocalTeacherProfile();
  const [teacherName, setTeacherName] = useState(initialProfile.name || authUser?.displayName || '');
  const [teacherNip, setTeacherNip] = useState(initialProfile.nip || '');
  const [subject, setSubject] = useState('');
  const [lessonPeriod, setLessonPeriod] = useState('');
  const [arrivalNote, setArrivalNote] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt after action
  const [receipt, setReceipt] = useState<{
    mode: 'checkin' | 'checkout';
    record: TeachingAttendanceRecord;
  } | null>(null);

  // Manual code entry fallback
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');

  useEffect(() => {
    if (authUser?.displayName && !teacherName) {
      setTeacherName(authUser.displayName);
    }
  }, [authUser?.displayName, teacherName]);

  const loadRecentHistory = useCallback(async () => {
    const local = loadLocalSessions();
    if (!authUser) {
      setRecentHistory(local);
      return;
    }
    try {
      const remote = await firestoreService.getMyRecentTeachingHistory(authUser.uid);
      const map = new Map<string, TeachingAttendanceRecord>();
      local.forEach((item) => map.set(item.id, item));
      remote.forEach((item) => map.set(item.id, item));
      const merged = Array.from(map.values())
        .sort((a, b) => (b.arrivalTimestampMs || 0) - (a.arrivalTimestampMs || 0))
        .slice(0, 20);
      setRecentHistory(merged);
    } catch {
      setRecentHistory(local);
    }
  }, [authUser]);

  useEffect(() => {
    void loadRecentHistory();
  }, [loadRecentHistory]);

  const stopCamera = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        if (html5QrRef.current.isScanning) {
          await html5QrRef.current.stop();
        }
        await html5QrRef.current.clear();
      } catch {
        // ignore stop errors
      }
      html5QrRef.current = null;
    }
    setIsScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const handleDecodedPayload = useCallback(
    async (decodedText: string) => {
      setScanError(null);
      const parsed = parseClassQrPayload(decodedText);
      if (!parsed) {
        setScanError(
          'Format QR tidak dikenali. Pastikan Anda memindai Barcode QR Kelas resmi dari Administrator Madrasah.'
        );
        return;
      }

      setIsVerifyingQr(true);
      try {
        const registry = await firestoreService.verifyClassQrCode(
          parsed.classId,
          parsed.qrToken
        );
        if (!registry) {
          setScanError(
            'Barcode QR kelas tidak valid, sudah dinonaktifkan, atau telah diperbarui oleh Admin.'
          );
          return;
        }

        await stopCamera();
        setVerifiedClassQr(registry);
        setReceipt(null);

        const today = formatDateYYYYMMDD();
        const localActive = loadLocalSessions().filter(
          (r) => r.classId === registry.classId && r.date === today && r.status === 'mengajar'
        );

        let remoteActive: TeachingAttendanceRecord[] = [];
        if (authUser) {
          try {
            remoteActive = await firestoreService.getMyActiveTeachingSessionsForClass(
              authUser.uid,
              registry.classId,
              today
            );
          } catch {
            remoteActive = [];
          }
        }

        const mergedMap = new Map<string, TeachingAttendanceRecord>();
        localActive.forEach((s) => mergedMap.set(s.id, s));
        remoteActive.forEach((s) => mergedMap.set(s.id, s));
        const activeSessions = Array.from(mergedMap.values()).sort(
          (a, b) => (b.arrivalTimestampMs || 0) - (a.arrivalTimestampMs || 0)
        );

        setActiveClassSessions(activeSessions);
        setShowNewSessionForm(activeSessions.length === 0);
      } catch (err) {
        console.error(err);
        setScanError('Gagal memverifikasi QR kelas ke server. Periksa koneksi internet Anda.');
      } finally {
        setIsVerifyingQr(false);
      }
    },
    [authUser, stopCamera]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanError(null);

    await stopCamera();

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      html5QrRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          void handleDecodedPayload(decodedText);
        },
        () => {
          // frame decode miss is expected while aiming
        }
      );
      setIsScanning(true);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError(
        'Kamera tidak dapat diakses pada perangkat/browser ini. Anda tetap dapat mengunggah foto QR atau memasukkan kode kelas secara manual.'
      );
      setIsScanning(false);
    }
  }, [handleDecodedPayload, stopCamera]);

  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanError(null);

    try {
      await stopCamera();
      const tempScanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      const result = await tempScanner.scanFile(file, true);
      await tempScanner.clear();
      await handleDecodedPayload(result);
    } catch {
      setScanError(
        'QR Code tidak terdeteksi pada gambar tersebut. Pastikan gambar QR kelas jelas dan tidak terpotong.'
      );
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    await handleDecodedPayload(manualCodeInput.trim());
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedClassQr) return;
    if (!teacherName.trim() || !subject.trim()) return;

    setIsSubmitting(true);
    setScanError(null);
    try {
      const actorUid = authUser?.uid || getOrCreateDeviceTeacherId();
      const actorEmail = authUser?.email || '';
      const created = await firestoreService.checkInTeacher({
        qrRegistry: verifiedClassQr,
        teacherName: teacherName.trim(),
        teacherNip: teacherNip.trim(),
        subject: subject.trim(),
        lessonPeriod: lessonPeriod.trim(),
        arrivalNote: arrivalNote.trim(),
        actorUid,
        actorEmail,
      });
      saveLocalTeacherProfile(teacherName.trim(), teacherNip.trim());
      const prevLocal = loadLocalSessions().filter((s) => s.id !== created.id);
      saveLocalSessions([created, ...prevLocal]);

      setReceipt({ mode: 'checkin', record: created });
      setVerifiedClassQr(null);
      setSubject('');
      setLessonPeriod('');
      setArrivalNote('');
      await loadRecentHistory();
    } catch (err) {
      console.error(err);
      setScanError('Gagal mencatat kedatangan mengajar. Pastikan koneksi aktif lalu coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async (session: TeachingAttendanceRecord) => {
    setIsSubmitting(true);
    setScanError(null);
    try {
      const updated = await firestoreService.checkOutTeacher(session, closingNote);
      const nextLocal = loadLocalSessions().map((s) => (s.id === updated.id ? updated : s));
      if (!nextLocal.some((s) => s.id === updated.id)) {
        nextLocal.unshift(updated);
      }
      saveLocalSessions(nextLocal);

      setReceipt({ mode: 'checkout', record: updated });
      setVerifiedClassQr(null);
      setActiveClassSessions([]);
      setClosingNote('');
      await loadRecentHistory();
    } catch (err) {
      console.error(err);
      setScanError('Gagal mencatat selesai mengajar. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToScan = () => {
    setVerifiedClassQr(null);
    setReceipt(null);
    setScanError(null);
    setActiveClassSessions([]);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col text-[#0B192C]">
      {/* Top Bar */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-8 py-3.5 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={async () => {
              await stopCamera();
              onBackToPortal();
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#0B192C] hover:text-emerald-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Menu Utama</span>
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#0B192C] hidden sm:inline">Kamera Scan Guru</span>
            {authUser ? (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium truncate max-w-[180px]">
                {authUser.email}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                Scan Langsung · Tanpa Login
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Deep Navy Banner */}
        <div className="rounded-2xl bg-[#0B192C] text-white p-5 sm:p-6 border border-[#142844] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <ScanLine className="w-4 h-4" />
              <span>Absensi Guru Mengajar di Kelas (Langsung Tanpa Login Google)</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              Scan Barcode QR Kelas
            </h1>
            <p className="text-xs text-slate-300/90 leading-relaxed">
              Pindai QR kelas saat <strong>Mulai Ngajar</strong> dan pindai kembali saat <strong>Selesai Ngajar</strong>. Rekap otomatis masuk ke Admin &amp; Wali Kelas.
            </p>
          </div>
        </div>

        <>
          {scanError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{scanError}</span>
            </div>
          )}

            {/* Confirmation Receipt after Check-In / Check-Out */}
            {receipt && (
              <div className="surface-card p-6 border-emerald-300 space-y-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                      {receipt.mode === 'checkin'
                        ? 'Rekap Kedatangan Guru Tercatat'
                        : 'Rekap Selesai Ngajar Tercatat'}
                    </div>
                    <h2 className="text-lg font-bold text-[#0B192C]">
                      Kelas {receipt.record.className} · {receipt.record.subject}
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {receipt.mode === 'checkin'
                        ? 'Data kedatangan mengajar Anda sudah tersimpan dan langsung terlihat di dashboard Wali Kelas.'
                        : 'Sesi mengajar telah ditutup. Rekap selesai mengajar dan durasi mengajar sudah masuk ke Wali Kelas.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F6F8FB] p-4 rounded-xl border border-slate-200/80 text-xs">
                  <div>
                    <div className="text-slate-500">Guru</div>
                    <div className="font-bold text-[#0B192C] mt-0.5 truncate">
                      {receipt.record.teacherName}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Tanggal</div>
                    <div className="font-mono font-semibold text-[#0B192C] mt-0.5 tabular-nums">
                      {receipt.record.date}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Jam Masuk</div>
                    <div className="font-mono font-bold text-emerald-700 mt-0.5 tabular-nums">
                      {receipt.record.arrivalTime}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">
                      {receipt.mode === 'checkout' ? 'Jam Selesai' : 'Status'}
                    </div>
                    <div className="font-mono font-bold text-[#0B192C] mt-0.5 tabular-nums">
                      {receipt.mode === 'checkout'
                        ? `${receipt.record.completedTime} (${receipt.record.durationMinutes} mnt)`
                        : 'Sedang Mengajar'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleResetToScan}
                    className="inline-flex items-center gap-2 btn-navy px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    <ScanLine className="w-4 h-4 text-emerald-400" />
                    <span>Scan QR Kelas Lain</span>
                  </button>
                  <button
                    type="button"
                    onClick={onBackToPortal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <span>Selesai &amp; Kembali</span>
                  </button>
                </div>
              </div>
            )}

            {/* Verified Class Action Panel (Check-in OR Check-out) */}
            {verifiedClassQr && !receipt && (
              <div className="surface-card p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#0B192C] text-emerald-400 flex items-center justify-center shrink-0">
                      <School className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-700">
                        Barcode QR Kelas Terverifikasi
                      </div>
                      <h2 className="text-lg font-bold text-[#0B192C]">
                        Kelas {verifiedClassQr.className} (Tingkat {verifiedClassQr.grade})
                      </h2>
                      <div className="text-xs text-slate-500">
                        Wali Kelas: {verifiedClassQr.homeroomTeacherName || 'Belum ditetapkan'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetToScan}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer self-start"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan Ulang</span>
                  </button>
                </div>

                {/* Active sessions waiting for Selesai Ngajar */}
                {activeClassSessions.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-[#0B192C] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-700" />
                      <span>Sesi Mengajar Aktif di Kelas {verifiedClassQr.className} Hari Ini</span>
                    </div>

                    {activeClassSessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-[#0B192C]">
                              {session.subject}
                              {session.lessonPeriod ? ` · Jam ke-${session.lessonPeriod}` : ''}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              Guru: <strong>{session.teacherName}</strong> · Masuk pukul{' '}
                              <span className="font-mono font-bold text-emerald-800">
                                {session.arrivalTime}
                              </span>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 self-start sm:self-center">
                            Sedang Mengajar
                          </span>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Catatan Selesai Mengajar (Opsional)
                          </label>
                          <input
                            type="text"
                            value={closingNote}
                            onChange={(e) => setClosingNote(e.target.value)}
                            placeholder="Contoh: Materi Bab 3 selesai, tugas halaman 45"
                            className="app-input bg-white"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleCheckOut(session)}
                          className="w-full flex items-center justify-center gap-2 btn-navy py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>
                            {isSubmitting ? 'Menyimpan...' : 'Catat Selesai Ngajar'}
                          </span>
                        </button>
                      </div>
                    ))}

                    {!showNewSessionForm && (
                      <button
                        type="button"
                        onClick={() => setShowNewSessionForm(true)}
                        className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        + Atau catat sesi kedatangan mata pelajaran baru di kelas ini
                      </button>
                    )}
                  </div>
                )}

                {/* Check-in Form: Mulai Ngajar */}
                {showNewSessionForm && (
                  <form onSubmit={handleCheckIn} className="space-y-4">
                    <div className="text-xs font-bold text-[#0B192C] flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-700" />
                      <span>Formulir Kedatangan Guru (Mulai Ngajar)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Nama Guru Mengajar <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={teacherName}
                          onChange={(e) => setTeacherName(e.target.value)}
                          placeholder="Nama lengkap guru"
                          className="app-input"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          NIP / NUPTK (Opsional)
                        </label>
                        <input
                          type="text"
                          value={teacherNip}
                          onChange={(e) => setTeacherNip(e.target.value)}
                          placeholder="Nomor induk pegawai"
                          className="app-input font-mono tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Mata Pelajaran <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Contoh: Matematika / Fiqih"
                          className="app-input"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Jam Pelajaran Ke (Opsional)
                        </label>
                        <input
                          type="text"
                          value={lessonPeriod}
                          onChange={(e) => setLessonPeriod(e.target.value)}
                          placeholder="Contoh: 1-2"
                          className="app-input"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <div className="text-[11px] text-slate-500 mb-1.5">
                          Pilih cepat mata pelajaran:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_SUBJECTS.map((subj) => (
                            <button
                              key={subj}
                              type="button"
                              onClick={() => setSubject(subj)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                                subject === subj
                                  ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                  : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              {subj}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Catatan Kedatangan (Opsional)
                        </label>
                        <input
                          type="text"
                          value={arrivalNote}
                          onChange={(e) => setArrivalNote(e.target.value)}
                          placeholder="Catatan singkat materi / kondisi kelas"
                          className="app-input"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 btn-emerald py-3 px-4 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? 'Mencatat Kedatangan...'
                          : 'Catat Kedatangan (Mulai Ngajar)'}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Camera Scanner & Upload Card */}
            {!verifiedClassQr && !receipt && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <div className="lg:col-span-7 surface-card p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-[#0B192C]">
                        Pemindai Kamera QR Kelas
                      </h2>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Arahkan kamera ke poster Barcode QR di kelas.
                      </p>
                    </div>
                    {isVerifyingQr && (
                      <span className="text-xs font-semibold text-emerald-700">
                        Memverifikasi...
                      </span>
                    )}
                  </div>

                  {/* Camera Region */}
                  <div className="rounded-2xl overflow-hidden bg-[#0B192C] border border-slate-200 min-h-[260px] flex flex-col items-center justify-center relative">
                    <div id={SCANNER_ELEMENT_ID} className="w-full" />
                    {!isScanning && (
                      <div className="p-6 text-center text-slate-300 space-y-3">
                        <QrCode className="w-12 h-12 text-emerald-400 mx-auto" />
                        <div className="text-xs text-slate-300 max-w-xs mx-auto">
                          Tekan tombol di bawah untuk mengaktifkan kamera perangkat Anda.
                        </div>
                      </div>
                    )}
                  </div>

                  {cameraError && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <CameraOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2.5">
                    {!isScanning ? (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="flex-1 inline-flex items-center justify-center gap-2 btn-emerald py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Aktifkan Kamera Scan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        <StopCircle className="w-4 h-4" />
                        <span>Hentikan Kamera</span>
                      </button>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUploadQrImage}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0B192C] cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-emerald-700" />
                      <span>Pindai dari Galeri / Foto QR</span>
                    </button>
                  </div>

                  {/* Manual Fallback */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowManualInput((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0B192C] cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>
                        {showManualInput
                          ? 'Tutup Input Kode Manual'
                          : 'Masukkan Kode Barcode Secara Manual'}
                      </span>
                    </button>

                    {showManualInput && (
                      <form onSubmit={handleManualSubmit} className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={manualCodeInput}
                          onChange={(e) => setManualCodeInput(e.target.value)}
                          placeholder="Tempel kode PPM-KELAS:..."
                          className="app-input font-mono flex-1"
                        />
                        <button
                          type="submit"
                          className="btn-navy px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Verifikasi
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Right 5 Cols: Active Sessions & Recent History for This Teacher */}
                <div className="lg:col-span-5 surface-card p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B192C]">
                      Sesi Mengajar Anda
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Riwayat scan masuk &amp; selesai mengajar dari akun Anda.
                    </p>
                  </div>

                  {recentHistory.length === 0 ? (
                    <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-xs text-slate-500">
                      Belum ada riwayat scan mengajar dari akun Anda.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
                      {recentHistory.map((item) => (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                            item.status === 'mengajar'
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : 'bg-slate-50/70 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-[#0B192C] truncate">
                                Kelas {item.className} · {item.subject}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                                {item.date} · Masuk {item.arrivalTime}
                                {item.completedTime ? ` ➔ Selesai ${item.completedTime}` : ''}
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                                item.status === 'mengajar'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {item.status === 'mengajar' ? 'Sedang Mengajar' : 'Selesai'}
                            </span>
                          </div>

                          {item.status === 'mengajar' && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleCheckOut(item)}
                              className="w-full py-2 rounded-lg btn-navy text-[11px] font-semibold cursor-pointer"
                            >
                              Catat Selesai Ngajar Sekarang
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
      </main>
    </div>
  );
};
