import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Menu, Shield, UserCheck } from 'lucide-react';
import { AcademicYear, SchoolClass, User } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface TopbarProps {
  pageTitle: string;
  breadcrumbSection: string;
  activeAcademicYear?: AcademicYear;
  currentUser: User;
  users: User[];
  classes: SchoolClass[];
  onSwitchUser: (user: User) => void;
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  pageTitle,
  breadcrumbSection,
  activeAcademicYear,
  currentUser,
  users,
  classes,
  onSwitchUser,
  onOpenMobileMenu,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentClass = classes.find((c) => c.id === currentUser.assignedClassId);
  const activeUsers = users.filter((u) => u.isActive);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 shrink-0">
      {/* Left: Mobile menu toggle + Breadcrumb title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-xl text-[#0B192C] hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex items-center gap-2 text-xs sm:text-sm">
          <span className="hidden sm:inline text-slate-400 font-medium whitespace-nowrap">
            {breadcrumbSection}
          </span>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <h1 className="font-bold text-[#0B192C] truncate tracking-tight">{pageTitle}</h1>
          {activeAcademicYear && (
            <>
              <span className="hidden md:inline text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="hidden md:inline text-xs font-medium text-slate-500 whitespace-nowrap tabular-nums">
                TA {activeAcademicYear.year} ({activeAcademicYear.semester})
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: PWA Install + User Account Switcher */}
      <div className="flex items-center gap-2.5 shrink-0">
        <PWAInstallButton />

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-expanded={dropdownOpen}
            className="flex items-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 sm:px-3 py-1.5 text-left transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 ${
                currentUser.role === 'opm' ? 'bg-[#0B192C]' : 'bg-emerald-700'
              }`}
            >
              {currentUser.role === 'opm' ? (
                <Shield className="w-3.5 h-3.5" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="hidden md:block leading-tight">
              <div className="text-xs font-semibold text-[#0B192C] whitespace-nowrap">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-slate-500 whitespace-nowrap">
                {currentUser.role === 'opm'
                  ? 'Administrator / OPM'
                  : currentClass
                  ? `Wali Kelas ${currentClass.name}`
                  : 'Wali Kelas'}
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50">
              <div className="px-4 py-2.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                Ganti Sesi Pengguna Aktif
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 scrollbar-thin">
                {activeUsers.map((u) => {
                  const uClass = classes.find((c) => c.id === u.assignedClassId);
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onSwitchUser(u);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-50/70 text-emerald-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{u.name}</div>
                        <div className="text-[11px] text-slate-500 font-normal truncate mt-0.5">
                          {u.role === 'opm'
                            ? 'Administrator / OPM'
                            : uClass
                            ? `Wali Kelas ${uClass.name}`
                            : 'Wali Kelas (Belum ada kelas)'}
                        </div>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 text-emerald-700 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
