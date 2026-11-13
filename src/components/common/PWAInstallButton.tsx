import React, { useState } from 'react';
import { CheckCircle2, Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Aplikasi Terpasang</span>
      </span>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded-xl btn-navy px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap cursor-pointer"
        title="Pasang aplikasi ke layar beranda"
      >
        <Download className="w-3.5 h-3.5 text-emerald-400" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-[#0B192C] transition whitespace-nowrap cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
          <span>Pasang di iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B192C]/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#0B192C] flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0B192C]">Pasang di iPhone / iPad</h3>
                  <p className="text-xs text-slate-500">Aplikasi Presensi Madrasah</p>
                </div>
              </div>
              <ol className="mt-3 text-xs text-slate-600 space-y-2 leading-relaxed list-decimal list-inside">
                <li>
                  Ketuk tombol <strong className="text-[#0B192C]">Share</strong> di toolbar Safari.
                </li>
                <li>
                  Pilih <strong className="text-[#0B192C]">Add to Home Screen</strong>.
                </li>
                <li>
                  Ketuk <strong className="text-[#0B192C]">Add</strong> di pojok kanan atas.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl btn-navy py-2.5 text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
