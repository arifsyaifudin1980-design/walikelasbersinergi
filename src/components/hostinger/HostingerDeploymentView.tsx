import React, { useState } from 'react';
import {
  Check,
  Copy,
  Database,
  Download,
  FileCode,
  Server,
} from 'lucide-react';
import { generateMySQLSchema, generatePHPBackend } from '../../services/hostingerExporter';

export const HostingerDeploymentView: React.FC = () => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedPhp, setCopiedPhp] = useState(false);

  const sqlCode = generateMySQLSchema();
  const phpCode = generatePHPBackend();

  const handleDownloadSQL = () => {
    const blob = new Blob([sqlCode], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presensi_madrasah_hostinger.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPHP = () => {
    const blob = new Blob([phpCode], { type: 'text/x-php' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.php';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleCopyPhp = () => {
    navigator.clipboard.writeText(phpCode);
    setCopiedPhp(true);
    setTimeout(() => setCopiedPhp(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Deep Navy Architectural Header */}
      <div className="rounded-2xl bg-[#0B192C] text-white p-6 sm:p-7 border border-[#142844] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Server className="w-3.5 h-3.5" />
            <span>Paket Produksi Hostinger · Apache · PHP 8 · MySQL</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-balance">
            Ekspor Skema Database MySQL &amp; Backend PHP 8
          </h2>
          <p className="text-xs text-slate-300/90 max-w-3xl leading-relaxed">
            Unduh skema SQL 17 tabel dan endpoint REST API PHP untuk menjalankan sistem pada server hosting mandiri madrasah Anda.
          </p>
        </div>
      </div>

      {/* Deployment Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface-card p-5 space-y-2">
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#0B192C] text-emerald-400 text-xs font-bold tabular-nums">
            01
          </div>
          <h3 className="font-bold text-[#0B192C] text-sm pt-1">Buat Database di cPanel</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Buka <strong className="text-[#0B192C]">MySQL Databases</strong> di panel hosting, buat database baru beserta kredensial pengguna.
          </p>
        </div>

        <div className="surface-card p-5 space-y-2">
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#0B192C] text-emerald-400 text-xs font-bold tabular-nums">
            02
          </div>
          <h3 className="font-bold text-[#0B192C] text-sm pt-1">Impor Skema SQL (17 Tabel)</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Buka <strong className="text-[#0B192C]">phpMyAdmin</strong>, pilih database tujuan, lalu impor berkas{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[#0B192C]">.sql</code>.
          </p>
        </div>

        <div className="surface-card p-5 space-y-2">
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#0B192C] text-emerald-400 text-xs font-bold tabular-nums">
            03
          </div>
          <h3 className="font-bold text-[#0B192C] text-sm pt-1">Unggah PHP API &amp; Build</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Unggah <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[#0B192C]">api/index.php</code> beserta hasil build aplikasi ke{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[#0B192C]">public_html</code>.
          </p>
        </div>
      </div>

      {/* Code Viewer & Download Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="surface-card overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Database className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-bold text-xs text-[#0B192C] truncate">
                presensi_madrasah.sql (17 Tabel)
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySql}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[#0B192C] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Tersalin' : 'Salin'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSQL}
                className="px-3 py-1.5 text-xs rounded-xl btn-emerald font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh .SQL</span>
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 bg-[#0B192C] text-slate-200 font-mono text-[11px] overflow-y-auto max-h-80 leading-relaxed scrollbar-navy">
            <pre>{sqlCode.substring(0, 1500)}...</pre>
          </div>
        </div>

        <div className="surface-card overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode className="w-4 h-4 text-[#0B192C] shrink-0" />
              <span className="font-bold text-xs text-[#0B192C] truncate">
                api/index.php (REST API PHP 8)
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyPhp}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[#0B192C] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedPhp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPhp ? 'Tersalin' : 'Salin'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPHP}
                className="px-3 py-1.5 text-xs rounded-xl btn-navy font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unduh .PHP</span>
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 bg-[#0B192C] text-slate-200 font-mono text-[11px] overflow-y-auto max-h-80 leading-relaxed scrollbar-navy">
            <pre>{phpCode}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
