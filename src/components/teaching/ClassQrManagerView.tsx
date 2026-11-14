import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Eye,
  Printer,
  QrCode,
  RefreshCw,
  School,
  X,
} from 'lucide-react';
import {
  buildClassQrPayload,
  downloadClassQrPosterJPG,
  generateClassQrDataUrl,
  generateClassQrPosterDataUrl,
} from '../../services/qrPoster';
import { MadrasahProfile, SchoolClass } from '../../types';

interface ClassQrPosterModalProps {
  schoolClass: SchoolClass;
  madrasah: MadrasahProfile;
  onRegenerateQr?: (schoolClass: SchoolClass) => Promise<void> | void;
  onClose: () => void;
}

export const ClassQrPosterModal: React.FC<ClassQrPosterModalProps> = ({
  schoolClass,
  madrasah,
  onRegenerateQr,
  onClose,
}) => {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const renderPoster = async () => {
      try {
        const url = await generateClassQrPosterDataUrl(schoolClass, madrasah);
        if (!cancelled) setPosterUrl(url);
      } catch (err) {
        console.error('Failed to render class QR poster:', err);
      }
    };
    void renderPoster();
    return () => {
      cancelled = true;
    };
  }, [schoolClass, madrasah]);

  const rawPayload = buildClassQrPayload(schoolClass.id, schoolClass.qrToken || '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    if (!posterUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head><title>QR Kelas ${schoolClass.name}</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#fff;">
            <img src="${posterUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" onload="window.focus();window.print();" />
          </body>
        </html>
      `);
      doc.close();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B192C]/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0B192C] text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Poster Barcode QR Ruang Kelas</div>
              <h3 className="text-base font-bold text-[#0B192C] truncate">
                Kelas {schoolClass.name} · Wali: {schoolClass.homeroomTeacherName || '-'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#F6F8FB] grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="w-full max-w-[360px] aspect-[3/4] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex items-center justify-center">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={`Poster QR Kelas ${schoolClass.name}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-slate-400">Merender poster QR kelas...</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="surface-card p-5 space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-[#0B192C] text-sm">Siap Dipasang di Ruang Kelas</h4>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Unduh poster JPG atau cetak langsung untuk ditempel di dekat pintu/meja guru kelas <strong>{schoolClass.name}</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500">Kode Payload Barcode</div>
                <div className="font-mono text-[11px] text-[#0B192C] break-all select-all">
                  {rawPayload}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer pt-1"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Kode Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Kode QR</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed">
                Guru mengajar memindai kode ini lewat menu <strong>Kamera Scan</strong> saat masuk kelas dan saat selesai mengajar.
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void downloadClassQrPosterJPG(schoolClass, madrasah)}
                className="w-full flex items-center justify-center gap-2 btn-emerald py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Poster QR Kelas (JPG)</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={!posterUrl}
                className="w-full flex items-center justify-center gap-2 btn-navy py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Cetak Poster QR</span>
              </button>

              {onRegenerateQr && (
                <button
                  type="button"
                  disabled={isRegenerating}
                  onClick={async () => {
                    setIsRegenerating(true);
                    try {
                      await onRegenerateQr(schoolClass);
                    } finally {
                      setIsRegenerating(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                  <span>{isRegenerating ? 'Memperbarui Token...' : 'Generate Ulang Token QR'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ClassQrManagerViewProps {
  classes: SchoolClass[];
  madrasah: MadrasahProfile;
  onRegenerateQr: (schoolClass: SchoolClass) => Promise<void>;
  onNavigateToClasses: () => void;
}

export const ClassQrManagerView: React.FC<ClassQrManagerViewProps> = ({
  classes,
  madrasah,
  onRegenerateQr,
  onNavigateToClasses,
}) => {
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [previewClass, setPreviewClass] = useState<SchoolClass | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const buildAll = async () => {
      const next: Record<string, string> = {};
      for (const cls of classes) {
        if (cls.qrToken) {
          try {
            next[cls.id] = await generateClassQrDataUrl(cls.id, cls.qrToken, 240);
          } catch {
            // ignore
          }
        }
      }
      if (!cancelled) setQrImages(next);
    };
    void buildAll();
    return () => {
      cancelled = true;
    };
  }, [classes]);

  // Keep previewClass fresh if qrToken updates
  const activePreviewClass = previewClass
    ? classes.find((c) => c.id === previewClass.id) || previewClass
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-7 border border-[#142844] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-emerald-400">
            Absensi Guru Mengajar di Kelas
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            Generator Barcode QR Kelas
          </h2>
          <p className="text-xs text-slate-300/90 max-w-2xl leading-relaxed">
            Cetak atau unduh poster Barcode QR untuk masing-masing ruang kelas. Guru memindai QR saat mulai dan selesai mengajar melalui menu Kamera Scan.
          </p>
        </div>
        <div className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs shrink-0 tabular-nums">
          <span className="text-slate-300">Total Barcode Kelas: </span>
          <span className="font-bold text-white">{classes.length} Kelas</span>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="surface-card p-12 text-center space-y-3">
          <School className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-[#0B192C]">Belum Ada Data Kelas</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tambahkan kelas terlebih dahulu pada menu Kelas &amp; Wali Kelas agar sistem dapat membuat Barcode QR unik untuk setiap ruangan.
          </p>
          <button
            type="button"
            onClick={onNavigateToClasses}
            className="inline-flex items-center gap-2 btn-navy px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <span>Buka Menu Kelas &amp; Wali Kelas</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const payload = buildClassQrPayload(cls.id, cls.qrToken || '');
            return (
              <div
                key={cls.id}
                className="surface-card p-5 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-emerald-700">
                      Tingkat {cls.grade}
                    </div>
                    <h3 className="text-base font-bold text-[#0B192C] truncate">
                      Kelas {cls.name}
                    </h3>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      Wali: {cls.homeroomTeacherName || 'Belum ditetapkan'}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-slate-100 text-slate-600 shrink-0">
                    {cls.qrToken ? 'QR Aktif' : 'Menyiapkan'}
                  </span>
                </div>

                <div className="bg-[#F6F8FB] border border-slate-200/80 rounded-xl p-4 flex flex-col items-center gap-2.5">
                  {qrImages[cls.id] ? (
                    <div className="w-40 h-40 bg-white rounded-xl border border-slate-200 p-2 flex items-center justify-center">
                      <img
                        src={qrImages[cls.id]}
                        alt={`QR Kelas ${cls.name}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-xs text-slate-400">
                      Memuat QR...
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(payload);
                        setCopiedId(cls.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      } catch {
                        // ignore
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 hover:text-emerald-700 cursor-pointer"
                    title="Salin kode payload QR"
                  >
                    {copiedId === cls.id ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700 font-sans font-semibold">Kode disalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{cls.qrToken || '-'}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => void downloadClassQrPosterJPG(cls, madrasah)}
                    disabled={!cls.qrToken}
                    className="inline-flex items-center justify-center gap-1.5 btn-emerald py-2 px-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh JPG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewClass(cls)}
                    disabled={!cls.qrToken}
                    className="inline-flex items-center justify-center gap-1.5 btn-navy py-2 px-3 rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Poster &amp; Cetak</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activePreviewClass && (
        <ClassQrPosterModal
          schoolClass={activePreviewClass}
          madrasah={madrasah}
          onRegenerateQr={onRegenerateQr}
          onClose={() => setPreviewClass(null)}
        />
      )}
    </div>
  );
};
