import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { User as FirebaseAuthUser } from 'firebase/auth';
import { BOOTSTRAPPED_ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AcademicCalendarEvent,
  AcademicYear,
  AttendanceCorrectionLog,
  AttendanceStatus,
  AuditLog,
  ClassQrCodeRegistry,
  DailyAttendanceRecord,
  MadrasahProfile,
  ReportArchiveItem,
  SchoolClass,
  Student,
  TeachingAttendanceRecord,
  User,
} from '../types';

export const EMPTY_MADRASAH: MadrasahProfile = {
  name: '',
  nsm: '',
  npsn: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  headmasterName: '',
  headmasterNip: '',
  city: '',
  logoUrl: '',
  signatureNoteDefault: '',
};

export function clampStr(val: string | undefined | null, maxLen: number): string {
  const s = typeof val === 'string' ? val : '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const raw = `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return raw.slice(0, 120);
}

export function generateQrToken(): string {
  const part1 = Math.random().toString(36).slice(2, 8).toUpperCase();
  const part2 = Date.now().toString(36).slice(-5).toUpperCase();
  return `QR_${part1}_${part2}`;
}

export function formatTimeHHMM(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDateYYYYMMDD(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface ResolvedAuthProfile {
  isAdmin: boolean;
  isBoundStaff: boolean;
  appUser: User | null;
  authUser: FirebaseAuthUser;
}

export const firestoreService = {
  /**
   * Resolve verified Google user to either Admin/OPM or Bound Wali Kelas
   */
  async resolveUserSession(authUser: FirebaseAuthUser): Promise<ResolvedAuthProfile> {
    const email = authUser.email || '';
    const isBootstrapped =
      authUser.emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL;

    // Check admins allowlist doc if not bootstrapped email
    let isAllowlistedAdmin = false;
    if (!isBootstrapped) {
      try {
        const adminSnap = await getDoc(doc(db, 'admins', authUser.uid));
        isAllowlistedAdmin = adminSnap.exists();
      } catch {
        isAllowlistedAdmin = false;
      }
    }

    const isAdmin = isBootstrapped || isAllowlistedAdmin;

    if (isAdmin) {
      // Ensure Admin user record exists in users collection
      const adminDocRef = doc(db, 'users', 'user_admin');
      let adminUser: User = {
        id: 'user_admin',
        username: 'admin',
        name: authUser.displayName || 'Administrator (OPM)',
        role: 'opm',
        nip: '',
        email,
        authUid: authUser.uid,
        isActive: true,
      };
      try {
        const snap = await getDoc(adminDocRef);
        if (!snap.exists()) {
          await setDoc(adminDocRef, {
            id: 'user_admin',
            username: 'admin',
            name: clampStr(authUser.displayName || 'Administrator (OPM)', 160),
            role: 'opm',
            nip: '',
            email: clampStr(email, 200),
            authUid: authUser.uid,
            assignedClassId: '',
            isActive: true,
            createdByUid: authUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const data = snap.data() as User;
          adminUser = {
            ...adminUser,
            ...data,
            id: 'user_admin',
            authUid: authUser.uid,
          };
          if (data.authUid !== authUser.uid || data.email !== email) {
            await updateDoc(adminDocRef, {
              authUid: authUser.uid,
              email: clampStr(email, 200),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'users/user_admin');
      }

      return {
        isAdmin: true,
        isBoundStaff: true,
        appUser: adminUser,
        authUser,
      };
    }

    // Non-admin: lookup staff user by Google email
    if (!email || !authUser.emailVerified) {
      return { isAdmin: false, isBoundStaff: false, appUser: null, authUser };
    }

    try {
      const q = query(collection(db, 'users'), where('email', '==', email));
      const snap = await getDocs(q);
      const activeDoc = snap.docs.find((d) => d.data()?.isActive === true);
      if (!activeDoc) {
        return { isAdmin: false, isBoundStaff: false, appUser: null, authUser };
      }

      const staffData = activeDoc.data() as User & { assignedClassId?: string };
      const assignedClassId = staffData.assignedClassId || '';

      // Bind staff UID cleanly (verified against users/{userId} in Firestore rules)
      await setDoc(doc(db, 'staff_bindings', authUser.uid), {
        uid: authUser.uid,
        userId: activeDoc.id,
        email: clampStr(email, 200),
        role: staffData.role,
        assignedClassId: clampStr(assignedClassId, 128),
        updatedAt: serverTimestamp(),
      });

      // Sync authUid onto users/{userId}
      if (staffData.authUid !== authUser.uid) {
        await updateDoc(doc(db, 'users', activeDoc.id), {
          authUid: authUser.uid,
          updatedAt: serverTimestamp(),
        });
      }

      // Sync homeroomTeacherUid onto assigned class & class_qr_codes so teacher QR scans reach this Wali Kelas
      if (staffData.role === 'wali_kelas' && assignedClassId) {
        try {
          const clsRef = doc(db, 'classes', assignedClassId);
          const clsSnap = await getDoc(clsRef);
          if (clsSnap.exists() && clsSnap.data()?.homeroomTeacherUid !== authUser.uid) {
            await updateDoc(clsRef, {
              homeroomTeacherUid: authUser.uid,
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // non-blocking if class not assigned yet
        }
        try {
          const qrRef = doc(db, 'class_qr_codes', assignedClassId);
          const qrSnap = await getDoc(qrRef);
          if (qrSnap.exists() && qrSnap.data()?.homeroomTeacherUid !== authUser.uid) {
            await updateDoc(qrRef, {
              homeroomTeacherUid: authUser.uid,
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // non-blocking
        }
      }

      return {
        isAdmin: staffData.role === 'opm',
        isBoundStaff: true,
        appUser: {
          ...staffData,
          id: activeDoc.id,
          authUid: authUser.uid,
        },
        authUser,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'users');
    }
  },

  /**
   * Real-time subscriptions for Admin/OPM (all collections) and Wali Kelas (scoped class collections)
   */
  subscribePortalData(
    resolved: ResolvedAuthProfile,
    handlers: {
      onMadrasah: (profile: MadrasahProfile) => void;
      onUsers: (users: User[]) => void;
      onAcademicYears: (years: AcademicYear[]) => void;
      onCalendarEvents: (events: AcademicCalendarEvent[]) => void;
      onClasses: (classes: SchoolClass[]) => void;
      onStudents: (students: Student[]) => void;
      onAttendance: (records: DailyAttendanceRecord[]) => void;
      onTeachingAttendance: (records: TeachingAttendanceRecord[]) => void;
      onCorrections: (logs: AttendanceCorrectionLog[]) => void;
      onArchives: (items: ReportArchiveItem[]) => void;
      onAuditLogs: (logs: AuditLog[]) => void;
      onError: (err: Error) => void;
    }
  ): Unsubscribe {
    const unsubs: Unsubscribe[] = [];
    const email = resolved.authUser.email || '';
    const uid = resolved.authUser.uid;

    // 1. Madrasah Profile
    unsubs.push(
      onSnapshot(
        doc(db, 'madrasah_config', 'main'),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data() as Partial<MadrasahProfile>;
            handlers.onMadrasah({ ...EMPTY_MADRASAH, ...d });
            try {
              localStorage.setItem(
                'presensi_public_hint',
                JSON.stringify({ name: d.name || '', logoUrl: d.logoUrl || '' })
              );
            } catch {
              // ignore storage quota
            }
          } else {
            handlers.onMadrasah(EMPTY_MADRASAH);
          }
        },
        (error) => {
          handlers.onError(error);
        }
      )
    );

    if (resolved.isAdmin) {
      // Admin subscriptions (full operational view)
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as User), id: d.id }));
            handlers.onUsers(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'users')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'academic_years'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as AcademicYear), id: d.id }));
            handlers.onAcademicYears(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'academic_years')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'calendar_events'),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as AcademicCalendarEvent), id: d.id }))
              .sort((a, b) => a.date.localeCompare(b.date));
            handlers.onCalendarEvents(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'calendar_events')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'classes'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as SchoolClass), id: d.id }));
            handlers.onClasses(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'classes')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'students'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as Student), id: d.id }));
            handlers.onStudents(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'students')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'daily_attendance'),
          (snap) => {
            const list = snap.docs.map((d) => ({
              ...(d.data() as DailyAttendanceRecord),
              id: d.id,
            }));
            handlers.onAttendance(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'daily_attendance')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'teaching_attendance'),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as TeachingAttendanceRecord), id: d.id }))
              .sort((a, b) => (b.arrivalTimestampMs || 0) - (a.arrivalTimestampMs || 0));
            handlers.onTeachingAttendance(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'teaching_attendance')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'correction_logs'),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as AttendanceCorrectionLog), id: d.id }))
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            handlers.onCorrections(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'correction_logs')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'report_archives'),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as ReportArchiveItem), id: d.id }))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            handlers.onArchives(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'report_archives')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'audit_logs'),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as AuditLog), id: d.id }))
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
              .slice(0, 300);
            handlers.onAuditLogs(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'audit_logs')
        )
      );
    } else if (resolved.isBoundStaff && resolved.appUser) {
      // Wali Kelas scoped subscriptions (Zero-Trust rule-enforced)
      handlers.onUsers([resolved.appUser]);

      unsubs.push(
        onSnapshot(
          doc(db, 'madrasah_config', 'academic_snapshot'),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as {
                yearsMap?: Record<string, AcademicYear>;
                eventsMap?: Record<string, AcademicCalendarEvent>;
              };
              const years = Object.values(data.yearsMap || {});
              const events = Object.values(data.eventsMap || {}).sort((a, b) =>
                a.date.localeCompare(b.date)
              );
              handlers.onAcademicYears(years);
              handlers.onCalendarEvents(events);
            } else {
              handlers.onAcademicYears([]);
              handlers.onCalendarEvents([]);
            }
          },
          (e) => handleFirestoreError(e, OperationType.GET, 'madrasah_config/academic_snapshot')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'classes'), where('homeroomTeacherEmail', '==', email)),
          (snap) => {
            handlers.onClasses(snap.docs.map((d) => ({ ...(d.data() as SchoolClass), id: d.id })));
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'classes')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'students'), where('homeroomTeacherEmail', '==', email)),
          (snap) => {
            handlers.onStudents(snap.docs.map((d) => ({ ...(d.data() as Student), id: d.id })));
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'students')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'daily_attendance'), where('homeroomTeacherEmail', '==', email)),
          (snap) => {
            handlers.onAttendance(
              snap.docs.map((d) => ({ ...(d.data() as DailyAttendanceRecord), id: d.id }))
            );
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'daily_attendance')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'teaching_attendance'), where('homeroomTeacherUid', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as TeachingAttendanceRecord), id: d.id }))
              .sort((a, b) => (b.arrivalTimestampMs || 0) - (a.arrivalTimestampMs || 0));
            handlers.onTeachingAttendance(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'teaching_attendance')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'correction_logs'), where('homeroomTeacherEmail', '==', email)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as AttendanceCorrectionLog), id: d.id }))
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            handlers.onCorrections(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'correction_logs')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'report_archives'), where('homeroomTeacherEmail', '==', email)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as ReportArchiveItem), id: d.id }))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            handlers.onArchives(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'report_archives')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'audit_logs'), where('actorUid', '==', uid)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ ...(d.data() as AuditLog), id: d.id }))
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            handlers.onAuditLogs(list);
          },
          (e) => handleFirestoreError(e, OperationType.LIST, 'audit_logs')
        )
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  },

  // === AUDIT LOG ===
  async addAuditLog(action: string, details: string, actor: User, actorUid: string): Promise<void> {
    const id = makeSafeId('aud');
    const path = `audit_logs/${id}`;
    try {
      await setDoc(doc(db, 'audit_logs', id), {
        id,
        action: clampStr(action, 160),
        details: clampStr(details, 600),
        userId: clampStr(actor.id, 128),
        userName: clampStr(actor.name, 160),
        actorUid: clampStr(actorUid, 128),
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  },

  // === MADRASAH PROFILE ===
  async saveMadrasahProfile(profile: MadrasahProfile, actor: User, actorUid: string): Promise<void> {
    const path = 'madrasah_config/main';
    try {
      await setDoc(doc(db, 'madrasah_config', 'main'), {
        name: clampStr(profile.name, 200),
        nsm: clampStr(profile.nsm, 40),
        npsn: clampStr(profile.npsn, 40),
        address: clampStr(profile.address, 400),
        phone: clampStr(profile.phone, 40),
        email: clampStr(profile.email, 160),
        website: clampStr(profile.website, 200),
        headmasterName: clampStr(profile.headmasterName, 160),
        headmasterNip: clampStr(profile.headmasterNip, 60),
        city: clampStr(profile.city, 120),
        logoUrl: clampStr(profile.logoUrl, 750000),
        signatureNoteDefault: clampStr(profile.signatureNoteDefault, 500),
        updatedByUid: actorUid,
        updatedAt: serverTimestamp(),
      });
      try {
        localStorage.setItem(
          'presensi_public_hint',
          JSON.stringify({ name: profile.name || '', logoUrl: profile.logoUrl || '' })
        );
      } catch {
        // ignore
      }
      await this.addAuditLog(
        'Pembaruan Profil Madrasah',
        `Profil identitas madrasah ${profile.name ? `'${profile.name}'` : ''} diperbarui`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  // === ACADEMIC SNAPSHOT SYNC FOR WALI KELAS ===
  async syncAcademicSnapshot(
    years: AcademicYear[],
    events: AcademicCalendarEvent[],
    actorUid: string
  ): Promise<void> {
    const yearsMap: Record<string, AcademicYear> = {};
    years.forEach((y) => {
      yearsMap[y.id] = y;
    });
    const eventsMap: Record<string, AcademicCalendarEvent> = {};
    events.forEach((e) => {
      eventsMap[e.id] = e;
    });
    try {
      await setDoc(doc(db, 'madrasah_config', 'academic_snapshot'), {
        yearsMap,
        eventsMap,
        updatedByUid: actorUid,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'madrasah_config/academic_snapshot');
    }
  },

  // === USERS CRUD ===
  async addUser(user: Omit<User, 'id'>, actor: User, actorUid: string): Promise<User> {
    const id = makeSafeId('usr');
    const created: User = { ...user, id };
    try {
      await setDoc(doc(db, 'users', id), {
        id,
        username: clampStr(created.username, 80),
        name: clampStr(created.name, 160),
        role: created.role,
        nip: clampStr(created.nip, 60),
        email: clampStr(created.email, 200),
        authUid: clampStr(created.authUid, 128),
        assignedClassId: clampStr(created.assignedClassId, 128),
        isActive: created.isActive,
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await this.addAuditLog(
        'Tambah Akun Pengguna',
        `Akun "${created.name}" (${created.username}) ditambahkan`,
        actor,
        actorUid
      );
      return created;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${id}`);
    }
  },

  async updateUser(updatedUser: User, actor: User, actorUid: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', updatedUser.id), {
        username: clampStr(updatedUser.username, 80),
        name: clampStr(updatedUser.name, 160),
        role: updatedUser.role,
        nip: clampStr(updatedUser.nip, 60),
        email: clampStr(updatedUser.email, 200),
        authUid: clampStr(updatedUser.authUid, 128),
        assignedClassId: clampStr(updatedUser.assignedClassId, 128),
        isActive: updatedUser.isActive,
        updatedAt: serverTimestamp(),
      });
      await this.addAuditLog(
        'Edit Akun Pengguna',
        `Akun "${updatedUser.name}" diperbarui`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${updatedUser.id}`);
    }
  },

  async deleteUser(target: User, actor: User, actorUid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', target.id));
      await this.addAuditLog(
        'Hapus Akun Pengguna',
        `Akun "${target.name}" dihapus`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${target.id}`);
    }
  },

  // === ACADEMIC YEARS CRUD ===
  async addAcademicYear(
    yearData: Omit<AcademicYear, 'id'>,
    currentYears: AcademicYear[],
    calendarEvents: AcademicCalendarEvent[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    const id = makeSafeId('ay');
    const created: AcademicYear = { ...yearData, id };
    try {
      const batch = writeBatch(db);
      if (created.isActive) {
        currentYears.forEach((y) => {
          if (y.isActive) {
            batch.update(doc(db, 'academic_years', y.id), {
              isActive: false,
              updatedAt: serverTimestamp(),
            });
          }
        });
      }
      batch.set(doc(db, 'academic_years', id), {
        id,
        year: clampStr(created.year, 30),
        semester: created.semester,
        isActive: created.isActive,
        startDate: clampStr(created.startDate, 20),
        endDate: clampStr(created.endDate, 20),
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();

      const nextYears = [
        created,
        ...currentYears.map((y) => (created.isActive ? { ...y, isActive: false } : y)),
      ];
      await this.syncAcademicSnapshot(nextYears, calendarEvents, actorUid);
      await this.addAuditLog(
        'Tambah Tahun Pelajaran',
        `TA ${created.year} Semester ${created.semester} ditambahkan`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `academic_years/${id}`);
    }
  },

  async setActiveAcademicYear(
    id: string,
    currentYears: AcademicYear[],
    calendarEvents: AcademicCalendarEvent[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      currentYears.forEach((y) => {
        batch.update(doc(db, 'academic_years', y.id), {
          isActive: y.id === id,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();

      const nextYears = currentYears.map((y) => ({ ...y, isActive: y.id === id }));
      await this.syncAcademicSnapshot(nextYears, calendarEvents, actorUid);
      const active = nextYears.find((y) => y.id === id);
      if (active) {
        await this.addAuditLog(
          'Aktivasi Tahun Pelajaran',
          `TA ${active.year} (${active.semester}) diaktifkan`,
          actor,
          actorUid
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `academic_years/${id}`);
    }
  },

  async deleteAcademicYear(
    target: AcademicYear,
    currentYears: AcademicYear[],
    calendarEvents: AcademicCalendarEvent[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, 'academic_years', target.id));
      const nextYears = currentYears.filter((y) => y.id !== target.id);
      await this.syncAcademicSnapshot(nextYears, calendarEvents, actorUid);
      await this.addAuditLog(
        'Hapus Tahun Pelajaran',
        `TA ${target.year} (${target.semester}) dihapus`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `academic_years/${target.id}`);
    }
  },

  // === CALENDAR EVENTS CRUD ===
  async addCalendarEvent(
    event: Omit<AcademicCalendarEvent, 'id'>,
    academicYears: AcademicYear[],
    currentEvents: AcademicCalendarEvent[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    const id = makeSafeId('cal');
    const created: AcademicCalendarEvent = { ...event, id };
    try {
      await setDoc(doc(db, 'calendar_events', id), {
        id,
        date: clampStr(created.date, 10),
        title: clampStr(created.title, 200),
        type: created.type,
        isEffective: created.isEffective,
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await this.syncAcademicSnapshot(academicYears, [...currentEvents, created], actorUid);
      await this.addAuditLog(
        'Tambah Kalender Akademik',
        `${created.date}: ${created.title}`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `calendar_events/${id}`);
    }
  },

  async updateCalendarEvent(
    ev: AcademicCalendarEvent,
    academicYears: AcademicYear[],
    currentEvents: AcademicCalendarEvent[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'calendar_events', ev.id), {
        date: clampStr(ev.date, 10),
        title: clampStr(ev.title, 200),
        type: ev.type,
        isEffective: ev.isEffective,
        updatedAt: serverTimestamp(),
      });
      const nextEvents = currentEvents.map((e) => (e.id === ev.id ? ev : e));
      await this.syncAcademicSnapshot(academicYears, nextEvents, actorUid);
      await this.addAuditLog(
        'Edit Kalender Akademik',
        `${ev.date}: ${ev.title}`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `calendar_events/${ev.id}`);
    }
  },

  async deleteCalendarEvent(
    target: AcademicCalendarEvent,
    academicYears: AcademicYear[],
    currentEvents: AcademicCalendarEvent[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, 'calendar_events', target.id));
      const nextEvents = currentEvents.filter((e) => e.id !== target.id);
      await this.syncAcademicSnapshot(academicYears, nextEvents, actorUid);
      await this.addAuditLog(
        'Hapus Kalender Akademik',
        `${target.date}: ${target.title}`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `calendar_events/${target.id}`);
    }
  },

  // === CLASSES + QR REGISTRY CRUD ===
  async addClass(
    newClass: Omit<SchoolClass, 'id'>,
    users: User[],
    actor: User,
    actorUid: string
  ): Promise<SchoolClass> {
    const id = makeSafeId('cls');
    const teacher = users.find((u) => u.id === newClass.homeroomTeacherId);
    const homeroomTeacherEmail = teacher?.email || newClass.homeroomTeacherEmail || '';
    const homeroomTeacherUid = teacher?.authUid || newClass.homeroomTeacherUid || '';
    const qrToken = newClass.qrToken || generateQrToken();
    const qrGeneratedAt = newClass.qrGeneratedAt || new Date().toISOString();

    const created: SchoolClass = {
      ...newClass,
      id,
      homeroomTeacherEmail,
      homeroomTeacherUid,
      qrToken,
      qrGeneratedAt,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'classes', id), {
        id,
        name: clampStr(created.name, 80),
        grade: clampStr(created.grade, 20),
        academicYearId: clampStr(created.academicYearId, 128),
        homeroomTeacherId: clampStr(created.homeroomTeacherId, 128),
        homeroomTeacherName: clampStr(created.homeroomTeacherName, 160),
        homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
        homeroomTeacherUid: clampStr(homeroomTeacherUid, 128),
        qrToken,
        qrGeneratedAt,
        isActive: created.isActive,
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, 'class_qr_codes', id), {
        classId: id,
        className: clampStr(created.name, 80),
        grade: clampStr(created.grade, 20),
        homeroomTeacherName: clampStr(created.homeroomTeacherName, 160),
        homeroomTeacherUid: clampStr(homeroomTeacherUid, 128),
        qrToken,
        isActive: created.isActive,
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (created.homeroomTeacherId && teacher) {
        batch.update(doc(db, 'users', created.homeroomTeacherId), {
          assignedClassId: id,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      await this.addAuditLog(
        'Tambah Kelas & QR Barcode',
        `Kelas ${created.name} beserta barcode QR ditambahkan`,
        actor,
        actorUid
      );
      return created;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `classes/${id}`);
    }
  },

  async updateClass(
    updatedClass: SchoolClass,
    users: User[],
    students: Student[],
    attendanceRecords: DailyAttendanceRecord[],
    teachingRecords: TeachingAttendanceRecord[],
    archives: ReportArchiveItem[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    const teacher = users.find((u) => u.id === updatedClass.homeroomTeacherId);
    const homeroomTeacherEmail = teacher?.email || updatedClass.homeroomTeacherEmail || '';
    const homeroomTeacherUid = teacher?.authUid || updatedClass.homeroomTeacherUid || '';
    const qrToken = updatedClass.qrToken || generateQrToken();
    const qrGeneratedAt = updatedClass.qrGeneratedAt || new Date().toISOString();

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'classes', updatedClass.id), {
        name: clampStr(updatedClass.name, 80),
        grade: clampStr(updatedClass.grade, 20),
        academicYearId: clampStr(updatedClass.academicYearId, 128),
        homeroomTeacherId: clampStr(updatedClass.homeroomTeacherId, 128),
        homeroomTeacherName: clampStr(updatedClass.homeroomTeacherName, 160),
        homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
        homeroomTeacherUid: clampStr(homeroomTeacherUid, 128),
        qrToken,
        qrGeneratedAt,
        isActive: updatedClass.isActive,
        updatedAt: serverTimestamp(),
      });

      // Ensure class_qr_codes registry stays synchronized
      const qrRef = doc(db, 'class_qr_codes', updatedClass.id);
      const qrSnap = await getDoc(qrRef);
      if (qrSnap.exists()) {
        batch.update(qrRef, {
          className: clampStr(updatedClass.name, 80),
          grade: clampStr(updatedClass.grade, 20),
          homeroomTeacherName: clampStr(updatedClass.homeroomTeacherName, 160),
          homeroomTeacherUid: clampStr(homeroomTeacherUid, 128),
          qrToken,
          isActive: updatedClass.isActive,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(qrRef, {
          classId: updatedClass.id,
          className: clampStr(updatedClass.name, 80),
          grade: clampStr(updatedClass.grade, 20),
          homeroomTeacherName: clampStr(updatedClass.homeroomTeacherName, 160),
          homeroomTeacherUid: clampStr(homeroomTeacherUid, 128),
          qrToken,
          isActive: updatedClass.isActive,
          createdByUid: actorUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Update user assignedClassId references
      users.forEach((u) => {
        if (u.id === updatedClass.homeroomTeacherId) {
          batch.update(doc(db, 'users', u.id), {
            assignedClassId: updatedClass.id,
            updatedAt: serverTimestamp(),
          });
        } else if (u.assignedClassId === updatedClass.id) {
          batch.update(doc(db, 'users', u.id), {
            assignedClassId: '',
            updatedAt: serverTimestamp(),
          });
        }
      });

      // Propagate homeroomTeacherEmail / homeroomTeacherUid to related docs for class-scoped access
      students
        .filter((s) => s.classId === updatedClass.id && s.homeroomTeacherEmail !== homeroomTeacherEmail)
        .forEach((s) => {
          batch.update(doc(db, 'students', s.id), {
            homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
            updatedAt: serverTimestamp(),
          });
        });

      attendanceRecords
        .filter((a) => a.classId === updatedClass.id && a.homeroomTeacherEmail !== homeroomTeacherEmail)
        .forEach((a) => {
          batch.update(doc(db, 'daily_attendance', a.id), {
            homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
            updatedAt: serverTimestamp(),
          });
        });

      teachingRecords
        .filter(
          (t) =>
            t.classId === updatedClass.id &&
            (t.homeroomTeacherEmail !== homeroomTeacherEmail ||
              t.homeroomTeacherUid !== homeroomTeacherUid)
        )
        .forEach((t) => {
          batch.update(doc(db, 'teaching_attendance', t.id), {
            homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
            homeroomTeacherUid: clampStr(homeroomTeacherUid, 128),
            updatedAt: serverTimestamp(),
          });
        });

      archives
        .filter((ar) => ar.classId === updatedClass.id && ar.homeroomTeacherEmail !== homeroomTeacherEmail)
        .forEach((ar) => {
          batch.update(doc(db, 'report_archives', ar.id), {
            homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
            updatedAt: serverTimestamp(),
          });
        });

      await batch.commit();
      await this.addAuditLog(
        'Edit Kelas',
        `Kelas ${updatedClass.name} diperbarui`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${updatedClass.id}`);
    }
  },

  async regenerateClassQr(
    schoolClass: SchoolClass,
    actor: User,
    actorUid: string
  ): Promise<string> {
    const newToken = generateQrToken();
    const nowIso = new Date().toISOString();
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'classes', schoolClass.id), {
        qrToken: newToken,
        qrGeneratedAt: nowIso,
        updatedAt: serverTimestamp(),
      });
      const qrRef = doc(db, 'class_qr_codes', schoolClass.id);
      const qrSnap = await getDoc(qrRef);
      if (qrSnap.exists()) {
        batch.update(qrRef, {
          qrToken: newToken,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(qrRef, {
          classId: schoolClass.id,
          className: clampStr(schoolClass.name, 80),
          grade: clampStr(schoolClass.grade, 20),
          homeroomTeacherName: clampStr(schoolClass.homeroomTeacherName, 160),
          homeroomTeacherUid: clampStr(schoolClass.homeroomTeacherUid, 128),
          qrToken: newToken,
          isActive: schoolClass.isActive,
          createdByUid: actorUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await this.addAuditLog(
        'Generate Ulang Barcode Kelas',
        `Barcode QR Kelas ${schoolClass.name} diperbarui`,
        actor,
        actorUid
      );
      return newToken;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `class_qr_codes/${schoolClass.id}`);
    }
  },

  async deleteClass(target: SchoolClass, actor: User, actorUid: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'classes', target.id));
      batch.delete(doc(db, 'class_qr_codes', target.id));
      await batch.commit();
      await this.addAuditLog('Hapus Kelas', `Kelas ${target.name} dihapus`, actor, actorUid);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `classes/${target.id}`);
    }
  },

  // === STUDENTS CRUD ===
  async addStudent(
    student: Omit<Student, 'id'>,
    classes: SchoolClass[],
    actor: User,
    actorUid: string
  ): Promise<Student> {
    const id = makeSafeId('std');
    const cls = classes.find((c) => c.id === student.classId);
    const homeroomTeacherEmail = cls?.homeroomTeacherEmail || student.homeroomTeacherEmail || '';
    const created: Student = { ...student, id, homeroomTeacherEmail };
    try {
      await setDoc(doc(db, 'students', id), {
        id,
        nis: clampStr(created.nis, 40),
        nisn: clampStr(created.nisn || '-', 40),
        name: clampStr(created.name, 160),
        gender: created.gender,
        classId: created.classId,
        homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
        parentName: clampStr(created.parentName, 160),
        parentWhatsapp: clampStr(created.parentWhatsapp, 30),
        address: clampStr(created.address, 400),
        isActive: created.isActive,
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await this.addAuditLog(
        'Tambah Siswa',
        `Siswa "${created.name}" (NIS: ${created.nis}) ditambahkan`,
        actor,
        actorUid
      );
      return created;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `students/${id}`);
    }
  },

  async updateStudent(
    student: Student,
    classes: SchoolClass[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    const cls = classes.find((c) => c.id === student.classId);
    const homeroomTeacherEmail = cls?.homeroomTeacherEmail || student.homeroomTeacherEmail || '';
    try {
      await updateDoc(doc(db, 'students', student.id), {
        nis: clampStr(student.nis, 40),
        nisn: clampStr(student.nisn || '-', 40),
        name: clampStr(student.name, 160),
        gender: student.gender,
        classId: student.classId,
        homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
        parentName: clampStr(student.parentName, 160),
        parentWhatsapp: clampStr(student.parentWhatsapp, 30),
        address: clampStr(student.address, 400),
        isActive: student.isActive,
        updatedAt: serverTimestamp(),
      });
      await this.addAuditLog(
        'Edit Siswa',
        `Data siswa "${student.name}" diperbarui`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
    }
  },

  async deleteStudent(target: Student, actor: User, actorUid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'students', target.id));
      await this.addAuditLog(
        'Hapus Siswa',
        `Data siswa "${target.name}" dihapus`,
        actor,
        actorUid
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${target.id}`);
    }
  },

  async importStudentsBatch(
    newStudents: Omit<Student, 'id'>[],
    existingStudents: Student[],
    classes: SchoolClass[],
    actor: User,
    actorUid: string
  ): Promise<{ added: number; skipped: number }> {
    const existingNis = new Set(existingStudents.map((s) => s.nis.trim()));
    const toAdd: Student[] = [];
    let skipped = 0;

    newStudents.forEach((s, idx) => {
      if (!s.name.trim() || !s.nis.trim() || existingNis.has(s.nis.trim())) {
        skipped++;
        return;
      }
      existingNis.add(s.nis.trim());
      const cls = classes.find((c) => c.id === s.classId);
      toAdd.push({
        ...s,
        id: makeSafeId(`std_imp_${idx}`),
        homeroomTeacherEmail: cls?.homeroomTeacherEmail || '',
      });
    });

    try {
      // Chunk batches at 400 writes per batch
      for (let i = 0; i < toAdd.length; i += 400) {
        const batch = writeBatch(db);
        toAdd.slice(i, i + 400).forEach((st) => {
          batch.set(doc(db, 'students', st.id), {
            id: st.id,
            nis: clampStr(st.nis, 40),
            nisn: clampStr(st.nisn || '-', 40),
            name: clampStr(st.name, 160),
            gender: st.gender,
            classId: st.classId,
            homeroomTeacherEmail: clampStr(st.homeroomTeacherEmail, 200),
            parentName: clampStr(st.parentName, 160),
            parentWhatsapp: clampStr(st.parentWhatsapp, 30),
            address: clampStr(st.address, 400),
            isActive: st.isActive,
            createdByUid: actorUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      await this.addAuditLog(
        'Impor Data Siswa',
        `${toAdd.length} siswa diimpor (${skipped} duplikat/dilewati)`,
        actor,
        actorUid
      );
      return { added: toAdd.length, skipped };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students');
    }
  },

  // === DAILY STUDENT ATTENDANCE ===
  async setStudentAttendance(
    studentId: string,
    classId: string,
    date: string,
    status: AttendanceStatus,
    actor: User,
    actorUid: string,
    classes: SchoolClass[],
    students: Student[],
    existingRecords: DailyAttendanceRecord[],
    options?: {
      reason?: string;
      note?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      removeAttachment?: boolean;
    }
  ): Promise<void> {
    const safeStudentId = studentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDate = date.replace(/[^a-zA-Z0-9_-]/g, '-');
    const id = `att_${safeStudentId}_${safeDate}`.slice(0, 128);

    const prevRecord = existingRecords.find((r) => r.studentId === studentId && r.date === date);
    const cls = classes.find((c) => c.id === classId);
    const student = students.find((s) => s.id === studentId);
    const homeroomTeacherEmail = cls?.homeroomTeacherEmail || student?.homeroomTeacherEmail || '';
    const nowIso = new Date().toISOString();

    try {
      if (prevRecord) {
        if (prevRecord.status !== status) {
          const logId = makeSafeId('corr');
          await setDoc(doc(db, 'correction_logs', logId), {
            id: logId,
            studentId,
            studentName: clampStr(student?.name || studentId, 160),
            classId,
            homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
            date,
            previousStatus: prevRecord.status,
            newStatus: status,
            reason: clampStr(options?.reason || `Perubahan status oleh ${actor.name}`, 400),
            changedBy: clampStr(actor.id, 128),
            changedByName: clampStr(actor.name, 160),
            changedByUid: actorUid,
            timestamp: nowIso,
            createdAt: serverTimestamp(),
          });
        }

        const nextAttachmentUrl = options?.removeAttachment
          ? ''
          : options?.attachmentUrl !== undefined
          ? options.attachmentUrl
          : prevRecord.attachmentUrl || '';
        const nextAttachmentName = options?.removeAttachment
          ? ''
          : options?.attachmentName !== undefined
          ? options.attachmentName
          : prevRecord.attachmentName || '';
        const nextAttachmentUploadedAt = options?.removeAttachment
          ? ''
          : options?.attachmentUrl
          ? nowIso
          : prevRecord.attachmentUploadedAt || '';

        await updateDoc(doc(db, 'daily_attendance', prevRecord.id), {
          status,
          note: clampStr(options?.note !== undefined ? options.note : prevRecord.note || '', 500),
          attachmentUrl: clampStr(nextAttachmentUrl, 750000),
          attachmentName: clampStr(nextAttachmentName, 200),
          attachmentUploadedAt: clampStr(nextAttachmentUploadedAt, 40),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'daily_attendance', id), {
          id,
          studentId,
          classId,
          homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
          date,
          status,
          note: clampStr(options?.note || '', 500),
          attachmentUrl: clampStr(options?.attachmentUrl || '', 750000),
          attachmentName: clampStr(options?.attachmentName || '', 200),
          attachmentUploadedAt: options?.attachmentUrl ? nowIso : '',
          recordedBy: clampStr(actor.id, 128),
          recordedByUid: actorUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `daily_attendance/${id}`);
    }
  },

  async bulkSetClassAttendance(
    classId: string,
    date: string,
    status: AttendanceStatus,
    actor: User,
    actorUid: string,
    classes: SchoolClass[],
    students: Student[],
    existingRecords: DailyAttendanceRecord[]
  ): Promise<number> {
    const classStudents = students.filter((s) => s.classId === classId && s.isActive);
    const cls = classes.find((c) => c.id === classId);
    const homeroomTeacherEmail = cls?.homeroomTeacherEmail || '';
    const nowIso = new Date().toISOString();

    try {
      const batch = writeBatch(db);
      classStudents.forEach((student) => {
        const prev = existingRecords.find((r) => r.studentId === student.id && r.date === date);
        if (prev) {
          if (prev.status !== status) {
            const logId = makeSafeId('corr');
            batch.set(doc(db, 'correction_logs', logId), {
              id: logId,
              studentId: student.id,
              studentName: clampStr(student.name, 160),
              classId,
              homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
              date,
              previousStatus: prev.status,
              newStatus: status,
              reason: 'Input cepat kehadiran kelas',
              changedBy: clampStr(actor.id, 128),
              changedByName: clampStr(actor.name, 160),
              changedByUid: actorUid,
              timestamp: nowIso,
              createdAt: serverTimestamp(),
            });
          }
          batch.update(doc(db, 'daily_attendance', prev.id), {
            status,
            updatedAt: serverTimestamp(),
          });
        } else {
          const safeStudentId = student.id.replace(/[^a-zA-Z0-9_-]/g, '_');
          const safeDate = date.replace(/[^a-zA-Z0-9_-]/g, '-');
          const id = `att_${safeStudentId}_${safeDate}`.slice(0, 128);
          batch.set(doc(db, 'daily_attendance', id), {
            id,
            studentId: student.id,
            classId,
            homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
            date,
            status,
            note: '',
            attachmentUrl: '',
            attachmentName: '',
            attachmentUploadedAt: '',
            recordedBy: clampStr(actor.id, 128),
            recordedByUid: actorUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();

      await this.addAuditLog(
        'Input Presensi Massal',
        `${classStudents.length} siswa kelas diset berstatus ${status} pada ${date}`,
        actor,
        actorUid
      );
      return classStudents.length;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'daily_attendance');
    }
  },

  // === REPORT ARCHIVES ===
  async saveArchiveItem(
    item: ReportArchiveItem,
    existingArchives: ReportArchiveItem[],
    classes: SchoolClass[],
    actorUid: string
  ): Promise<void> {
    const id = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    let existing = existingArchives.find(
      (a) => a.studentId === item.studentId && a.month === item.month && a.year === item.year
    );
    const cls = classes.find((c) => c.id === item.classId);
    let homeroomTeacherEmail = cls?.homeroomTeacherEmail || item.homeroomTeacherEmail || '';

    try {
      if (!existing) {
        const snap = await getDoc(doc(db, 'report_archives', id));
        if (snap.exists()) {
          existing = snap.data() as ReportArchiveItem;
        }
      }
      if (!homeroomTeacherEmail && item.classId) {
        const clsSnap = await getDoc(doc(db, 'classes', item.classId));
        if (clsSnap.exists()) {
          homeroomTeacherEmail = (clsSnap.data() as SchoolClass).homeroomTeacherEmail || '';
        }
      }

      if (existing) {
        await updateDoc(doc(db, 'report_archives', existing.id), {
          effectiveDays: item.effectiveDays,
          hadir: item.hadir,
          sakit: item.sakit,
          izin: item.izin,
          alpa: item.alpa,
          percentage: item.percentage,
          version: (existing.version || 1) + 1,
          customNote: clampStr(item.customNote, 600),
          deliveryStatus: item.deliveryStatus,
          lastDeliveredAt: clampStr(item.lastDeliveredAt, 40),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'report_archives', id), {
          id,
          studentId: item.studentId,
          studentName: clampStr(item.studentName, 160),
          classId: item.classId,
          className: clampStr(item.className, 80),
          homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
          month: item.month,
          year: item.year,
          academicYear: clampStr(item.academicYear || '-', 40),
          effectiveDays: item.effectiveDays,
          hadir: item.hadir,
          sakit: item.sakit,
          izin: item.izin,
          alpa: item.alpa,
          percentage: item.percentage,
          createdAt: item.createdAt || new Date().toISOString(),
          createdByName: clampStr(item.createdByName || 'Wali Kelas', 160),
          createdByUid: actorUid,
          version: 1,
          customNote: clampStr(item.customNote, 600),
          deliveryStatus: item.deliveryStatus,
          lastDeliveredAt: clampStr(item.lastDeliveredAt, 40),
          parentWhatsapp: clampStr(item.parentWhatsapp, 30),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `report_archives/${id}`);
    }
  },

  async updateDeliveryStatus(
    studentId: string,
    month: number,
    year: number,
    status: 'terkirim' | 'gagal'
  ): Promise<void> {
    const id = `rep_${studentId}_${month}_${year}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    try {
      const ref = doc(db, 'report_archives', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, {
          deliveryStatus: status,
          lastDeliveredAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `report_archives/${id}`);
    }
  },

  // === CLASS QR VERIFICATION & TEACHER TEACHING ATTENDANCE ===
  async verifyClassQrCode(
    classId: string,
    qrToken: string
  ): Promise<ClassQrCodeRegistry | null> {
    const cleanId = classId.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) return null;
    try {
      const snap = await getDoc(doc(db, 'class_qr_codes', cleanId));
      if (!snap.exists()) return null;
      const data = snap.data() as ClassQrCodeRegistry;
      if (!data.isActive || data.qrToken !== qrToken.trim()) {
        return null;
      }
      return data;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `class_qr_codes/${cleanId}`);
    }
  },

  async getMyActiveTeachingSessionsForClass(
    uid: string,
    classId: string,
    date: string
  ): Promise<TeachingAttendanceRecord[]> {
    try {
      const q = query(
        collection(db, 'teaching_attendance'),
        where('recordedByUid', '==', uid)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ ...(d.data() as TeachingAttendanceRecord), id: d.id }))
        .filter((r) => r.classId === classId && r.date === date && r.status === 'mengajar')
        .sort((a, b) => (b.arrivalTimestampMs || 0) - (a.arrivalTimestampMs || 0));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'teaching_attendance');
    }
  },

  async getMyRecentTeachingHistory(uid: string): Promise<TeachingAttendanceRecord[]> {
    try {
      const q = query(
        collection(db, 'teaching_attendance'),
        where('recordedByUid', '==', uid)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({ ...(d.data() as TeachingAttendanceRecord), id: d.id }))
        .sort((a, b) => (b.arrivalTimestampMs || 0) - (a.arrivalTimestampMs || 0))
        .slice(0, 15);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'teaching_attendance');
    }
  },

  async checkInTeacher(params: {
    qrRegistry: ClassQrCodeRegistry;
    teacherName: string;
    teacherNip?: string;
    subject: string;
    lessonPeriod?: string;
    arrivalNote?: string;
    authUser: FirebaseAuthUser;
  }): Promise<TeachingAttendanceRecord> {
    const id = makeSafeId('teach');
    const now = new Date();
    const date = formatDateYYYYMMDD(now);
    const arrivalTime = formatTimeHHMM(now);
    const arrivalTimestampMs = now.getTime();
    const recordedByEmail = params.authUser.email || '';

    const payload: TeachingAttendanceRecord = {
      id,
      classId: params.qrRegistry.classId,
      className: params.qrRegistry.className,
      qrToken: params.qrRegistry.qrToken,
      homeroomTeacherUid: params.qrRegistry.homeroomTeacherUid || '',
      homeroomTeacherEmail: '',
      teacherName: clampStr(params.teacherName.trim(), 160),
      teacherNip: clampStr(params.teacherNip?.trim() || '', 60),
      subject: clampStr(params.subject.trim(), 160),
      lessonPeriod: clampStr(params.lessonPeriod?.trim() || '', 40),
      date,
      arrivalTime,
      completedTime: '',
      arrivalTimestampMs,
      completedTimestampMs: 0,
      durationMinutes: 0,
      status: 'mengajar',
      arrivalNote: clampStr(params.arrivalNote?.trim() || '', 500),
      closingNote: '',
      recordedByUid: params.authUser.uid,
      recordedByEmail,
    };

    try {
      await setDoc(doc(db, 'teaching_attendance', id), {
        ...payload,
        arrivalAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return payload;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `teaching_attendance/${id}`);
    }
  },

  async checkOutTeacher(
    session: TeachingAttendanceRecord,
    closingNote?: string
  ): Promise<TeachingAttendanceRecord> {
    const now = new Date();
    const completedTime = formatTimeHHMM(now);
    const completedTimestampMs = now.getTime();
    const durationMinutes = Math.min(
      1440,
      Math.max(0, Math.round((completedTimestampMs - session.arrivalTimestampMs) / 60000))
    );

    try {
      await updateDoc(doc(db, 'teaching_attendance', session.id), {
        status: 'selesai',
        completedTime,
        completedTimestampMs,
        durationMinutes,
        closingNote: clampStr(closingNote?.trim() || '', 500),
        updatedAt: serverTimestamp(),
      });
      return {
        ...session,
        status: 'selesai',
        completedTime,
        completedTimestampMs,
        durationMinutes,
        closingNote: closingNote?.trim() || '',
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teaching_attendance/${session.id}`);
    }
  },

  /**
   * Backfill homeroomTeacherUid on teaching_attendance records if teacher scanned before Wali Kelas first login
   */
  async syncMissingTeachingHomeroomUid(
    classes: SchoolClass[],
    teachingRecords: TeachingAttendanceRecord[]
  ): Promise<void> {
    const updates: { id: string; uid: string; email: string }[] = [];
    teachingRecords.forEach((rec) => {
      const cls = classes.find((c) => c.id === rec.classId);
      if (cls && cls.homeroomTeacherUid && rec.homeroomTeacherUid !== cls.homeroomTeacherUid) {
        updates.push({
          id: rec.id,
          uid: cls.homeroomTeacherUid,
          email: cls.homeroomTeacherEmail || '',
        });
      }
    });
    if (updates.length === 0) return;

    try {
      const batch = writeBatch(db);
      updates.slice(0, 300).forEach((u) => {
        batch.update(doc(db, 'teaching_attendance', u.id), {
          homeroomTeacherUid: u.uid,
          homeroomTeacherEmail: clampStr(u.email, 200),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch {
      // ignore background sync failures
    }
  },

  /**
   * Ensure all existing classes also have qrToken & class_qr_codes registry (for classes created prior to QR feature)
   */
  async ensureClassQrRegistries(classes: SchoolClass[], actorUid: string): Promise<void> {
    for (const cls of classes) {
      const qrToken = cls.qrToken || generateQrToken();
      try {
        const qrSnap = await getDoc(doc(db, 'class_qr_codes', cls.id));
        if (!cls.qrToken || !qrSnap.exists()) {
          const batch = writeBatch(db);
          if (!cls.qrToken) {
            batch.update(doc(db, 'classes', cls.id), {
              qrToken,
              qrGeneratedAt: new Date().toISOString(),
              updatedAt: serverTimestamp(),
            });
          }
          if (!qrSnap.exists()) {
            batch.set(doc(db, 'class_qr_codes', cls.id), {
              classId: cls.id,
              className: clampStr(cls.name, 80),
              grade: clampStr(cls.grade, 20),
              homeroomTeacherName: clampStr(cls.homeroomTeacherName, 160),
              homeroomTeacherUid: clampStr(cls.homeroomTeacherUid, 128),
              qrToken,
              isActive: cls.isActive,
              createdByUid: actorUid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
      } catch {
        // non-blocking
      }
    }
  },

  /**
   * Reset all cloud data (Admin only)
   */
  async resetAllCloudData(): Promise<void> {
    const collections = [
      'students',
      'daily_attendance',
      'teaching_attendance',
      'correction_logs',
      'report_archives',
      'classes',
      'class_qr_codes',
      'academic_years',
      'calendar_events',
      'audit_logs',
    ];
    for (const colName of collections) {
      try {
        const snap = await getDocs(collection(db, colName));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, colName);
      }
    }
    try {
      await deleteDoc(doc(db, 'madrasah_config', 'main'));
      await deleteDoc(doc(db, 'madrasah_config', 'academic_snapshot'));
    } catch {
      // ignore if absent
    }
    try {
      localStorage.removeItem('presensi_public_hint');
    } catch {
      // ignore
    }
  },
};
