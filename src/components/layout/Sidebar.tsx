import React from 'react';
import {
  BookOpenCheck,
  Calendar,
  FileSpreadsheet,
  GraduationCap,
  History,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  QrCode,
  ScanLine,
  School,
  Server,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { MadrasahProfile, User } from '../../types';

export interface NavItem {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  group?: string;
}

interface SidebarProps {
  currentUser: User;
  madrasah: MadrasahProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenScanner: () => void;
  onBackToPortal: () => void;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  madrasah,
  activeTab,
  setActiveTab,
  isOpenMobile,
  onCloseMobile,
  onOpenScanner,
  onBackToPortal,
  onSignOut,
}) => {
  const opmItems: NavItem[] = [
    { id: 'opm_overview', label: 'Ringkasan Sistem', icon: LayoutDashboard, group: 'Utama' },
    { id: 'attendance_matrix', label: 'Input Presensi & Foto', icon: FileSpreadsheet, group: 'Utama' },
    { id: 'teaching_recap', label: 'Rekap Guru Ngajar', icon: BookOpenCheck, group: 'Utama' },
    { id: 'opm_students', label: 'Data Siswa', icon: Users, group: 'Master Data' },
    { id: 'opm_classes', label: 'Kelas & Wali Kelas', icon: School, group: 'Master Data' },
    { id: 'opm_qr_classes', label: 'Barcode QR Kelas', icon: QrCode, group: 'Master Data' },
    { id: 'opm_academic_years', label: 'Tahun Pelajaran', icon: GraduationCap, group: 'Master Data' },
    { id: 'opm_calendar', label: 'Kalender Akademik', icon: Calendar, group: 'Master Data' },
    { id: 'archives', label: 'Arsip Laporan JPG', icon: History, group: 'Laporan' },
    { id: 'hostinger', label: 'Ekspor Hostinger', icon: Server, group: 'Laporan' },
    { id: 'opm_users', label: 'Akun Pengguna', icon: UserCog, group: 'Administrasi' },
    { id: 'opm_audit', label: 'Audit & Log Aktivitas', icon: ShieldCheck, group: 'Administrasi' },
    { id: 'opm_settings', label: 'Profil & Logo Madrasah', icon: Settings, group: 'Administrasi' },
  ];

  const waliItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard Kelas', icon: LayoutDashboard, group: 'Utama' },
    { id: 'attendance_matrix', label: 'Input Presensi & Foto', icon: FileSpreadsheet, group: 'Utama' },
    { id: 'teaching_recap', label: 'Rekap Guru Ngajar', icon: BookOpenCheck, group: 'Utama' },
    { id: 'archives', label: 'Arsip & Riwayat WA', icon: History, group: 'Laporan' },
  ];

  const navItems = currentUser.role === 'opm' ? opmItems : waliItems;
  const groups = Array.from(new Set(navItems.map((i) => i.group || 'Menu')));

  const handleSelect = (id: string) => {
    setActiveTab(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B192C] text-slate-300 w-[268px] select-none border-r border-white/10">
      {/* Brand Header with Institutional Identity & Logo Container */}
      <div className="px-4 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              currentUser.role === 'opm' ? handleSelect('opm_settings') : handleSelect('dashboard')
            }
            className="flex items-center gap-3 text-left min-w-0 flex-1 group cursor-pointer focus:outline-hidden"
          >
            {madrasah.logoUrl ? (
              <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                <img
                  src={madrasah.logoUrl}
                  alt="Logo Madrasah"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div
                className="w-10 h-10 rounded-xl border border-dashed border-white/25 bg-white/5 flex items-center justify-center shrink-0 text-slate-300 group-hover:border-emerald-400 group-hover:text-emerald-300 transition-colors"
                title="Wadah Logo Madrasah (Belum diunggah)"
              >
                <ImageIcon className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-white truncate tracking-[0.01em] group-hover:text-emerald-300 transition-colors">
                {madrasah.name.trim() || 'Presensi Pintar'}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5 tabular-nums">
                {madrasah.nsm ? `NSM ${madrasah.nsm}` : 'Platform Presensi Madrasah'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6 scrollbar-navy">
        {groups.map((group) => (
          <div key={group}>
            <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400/80 tracking-wide">
              {group}
            </div>
            <div className="space-y-1">
              {navItems
                .filter((i) => (i.group || 'Menu') === group)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-[#162D4C] text-white font-semibold ring-1 ring-inset ring-emerald-400/25 shadow-xs'
                          : 'text-slate-300/90 font-medium hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Institutional Context + Quick Scanner & Portal Switch */}
      <div className="p-3 border-t border-white/10 bg-[#081322] space-y-2.5">
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenScanner();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>Buka Kamera Scan QR</span>
        </button>

        <div className="flex items-center gap-3 px-2.5 py-2 rounded-xl bg-white/[0.04] border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate tracking-[0.01em]">
              {currentUser.name}
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              {currentUser.role === 'opm' ? 'Administrator / OPM' : 'Wali Kelas'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onBackToPortal();
            }}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-slate-300 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Portal</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseMobile();
              onSignOut();
            }}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-200 text-[11px] font-medium text-slate-300 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block shrink-0">{sidebarContent}</aside>

      {/* Mobile Slide-Over Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0B192C]/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 flex h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
