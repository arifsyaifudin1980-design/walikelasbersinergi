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
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../firebase';
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
  WaliSession,
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

export function generateSecretToken(prefix: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) {
      rand += chars[arr[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 24; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `${prefix}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic pure-JS fallback (SHA-256)
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = input.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  let ascii = input + '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export async function computeWaliCredHash(username: string, accessPin: string): Promise<string> {
  const normalizedUser = username.trim().toLowerCase();
  const normalizedPin = accessPin.trim();
  const hex = await sha256Hex(`ppm_wali_v1:${normalizedUser}:${normalizedPin}`);
  return `wc_${hex.slice(0, 40)}`;
}

export function getYearMonthStr(dateStr: string): string {
  const clean = dateStr.trim();
  if (clean.length >= 7) {
    return `${clean.slice(0, 4)}_${clean.slice(5, 7)}`;
  }
  const now = new Date();
  return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getYearMonthFromNumbers(year: number, month: number): string {
  return `${year}_${String(month).padStart(2, '0')}`;
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

function stripAttendanceForBundle(rec: DailyAttendanceRecord): DailyAttendanceRecord {
  const { attachmentUrl: _ignored, ...rest } = rec;
  void _ignored;
  return {
    ...rest,
    attachmentUrl: '',
  };
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
    const isBootstrapped = authUser.emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL;

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

      await setDoc(doc(db, 'staff_bindings', authUser.uid), {
        uid: authUser.uid,
        userId: activeDoc.id,
        email: clampStr(email, 200),
        role: staffData.role,
        assignedClassId: clampStr(assignedClassId, 128),
        updatedAt: serverTimestamp(),
      });

      if (staffData.authUid !== authUser.uid) {
        await updateDoc(doc(db, 'users', activeDoc.id), {
          authUid: authUser.uid,
          updatedAt: serverTimestamp(),
        });
      }

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
          // non-blocking
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
   * Direct credential login for Wali Kelas (Username + PIN/Password created by Admin, without Google)
   */
  async loginWaliKelasWithCredentials(
    username: string,
    accessPin: string
  ): Promise<{ session: WaliSession | null; reason?: string }> {
    const cleanUser = username.trim().toLowerCase();
    const cleanPin = accessPin.trim();
    if (!cleanUser || !cleanPin) {
      return { session: null, reason: 'Username dan PIN/Password wajib diisi.' };
    }

    const credHash = await computeWaliCredHash(cleanUser, cleanPin);
    try {
      const snap = await getDoc(doc(db, 'wali_access', credHash));
      if (!snap.exists()) {
        return {
          session: null,
          reason: 'Username atau PIN/Password salah. Pastikan Admin telah membuat akun & menetapkan PIN.',
        };
      }
      const data = snap.data() as {
        credHash: string;
        userId: string;
        username: string;
        name: string;
        nip?: string;
        role: 'wali_kelas';
        assignedClassId: string;
        classSecret: string;
        madrasahKey: string;
        qrToken: string;
        className?: string;
        isActive: boolean;
      };

      if (!data.isActive) {
        return {
          session: null,
          reason: 'Akun Wali Kelas Anda sedang dinonaktifkan oleh Admin.',
        };
      }

      let qrToken = data.qrToken || '';
      let className = data.className || '';
      if (data.classSecret) {
        try {
          const bundleSnap = await getDoc(doc(db, 'wali_class_bundles', data.classSecret));
          if (bundleSnap.exists()) {
            const bundle = bundleSnap.data() as { classData?: SchoolClass };
            if (bundle.classData) {
              qrToken = bundle.classData.qrToken || qrToken;
              className = bundle.classData.name || className;
            }
          }
        } catch {
          // fallback to data on wali_access
        }
      }

      const session: WaliSession = {
        credHash: data.credHash,
        userId: data.userId,
        username: data.username,
        name: data.name,
        nip: data.nip || '',
        assignedClassId: data.assignedClassId || '',
        classSecret: data.classSecret || '',
        madrasahKey: data.madrasahKey || '',
        qrToken,
        className,
        loggedInAt: new Date().toISOString(),
      };
      return { session };
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `wali_access/${credHash}`);
    }
  },

  /**
   * Lazy-load base64 attendance photo attachment for a Wali Kelas session
   */
  async fetchWaliAttachment(classSecret: string, attId: string): Promise<string | null> {
    if (!classSecret || !attId) return null;
    const docId = `${classSecret}_${attId}`;
    try {
      const snap = await getDoc(doc(db, 'wali_attachments', docId));
      if (!snap.exists()) return null;
      const data = snap.data() as { attachmentUrl?: string };
      return data.attachmentUrl || null;
    } catch {
      return null;
    }
  },

  /**
   * Single-doc real-time subscription for credential-based Wali Kelas login
   */
  subscribeWaliPortalData(
    session: WaliSession,
    month: number,
    year: number,
    handlers: {
      onMadrasah: (profile: MadrasahProfile) => void;
      onUsers: (users: User[]) => void;
      onAcademicYears: (years: AcademicYear[]) => void;
      onCalendarEvents: (events: AcademicCalendarEvent[]) => void;
      onClasses: (classes: SchoolClass[]) => void;
      onStudents: (students: Student[]) => void;
      onAttendance: (records: DailyAttendanceRecord[]) => void;
      onTeachingAttendance: (records: TeachingAttendanceRecord[]) => void;
      onArchives: (items: ReportArchiveItem[]) => void;
      onSessionRevoked?: () => void;
      onSessionPatch?: (patch: Partial<WaliSession>) => void;
      onError: (err: Error) => void;
    }
  ): Unsubscribe {
    const unsubs: Unsubscribe[] = [];
    let teachingUnsub: Unsubscribe | null = null;
    let activeQrToken = session.qrToken || '';
    const yearMonth = getYearMonthFromNumbers(year, month);

    const waliUser: User = {
      id: session.userId,
      username: session.username,
      name: session.name,
      role: 'wali_kelas',
      nip: session.nip || '',
      assignedClassId: session.assignedClassId,
      isActive: true,
    };
    handlers.onUsers([waliUser]);

    // 0. Live check on wali_access/{credHash} (detect deactivation, credential change, or class reassignment)
    unsubs.push(
      onSnapshot(
        doc(db, 'wali_access', session.credHash),
        (snap) => {
          if (!snap.exists()) {
            handlers.onSessionRevoked?.();
            return;
          }
          const d = snap.data() as {
            isActive?: boolean;
            assignedClassId?: string;
            classSecret?: string;
            madrasahKey?: string;
            qrToken?: string;
            className?: string;
            name?: string;
            nip?: string;
          };
          if (d.isActive === false) {
            handlers.onSessionRevoked?.();
            return;
          }
          if (
            (d.classSecret && d.classSecret !== session.classSecret) ||
            (d.assignedClassId !== undefined && d.assignedClassId !== session.assignedClassId) ||
            (d.madrasahKey && d.madrasahKey !== session.madrasahKey) ||
            (d.qrToken && d.qrToken !== session.qrToken)
          ) {
            handlers.onSessionPatch?.({
              assignedClassId: d.assignedClassId || '',
              classSecret: d.classSecret || '',
              madrasahKey: d.madrasahKey || '',
              qrToken: d.qrToken || '',
              className: d.className || '',
              name: d.name || session.name,
              nip: d.nip || session.nip,
            });
          }
        },
        (err) => handlers.onError(err)
      )
    );

    // 1. Madrasah Profile + Academic Years + Calendar Events
    if (session.madrasahKey) {
      unsubs.push(
        onSnapshot(
          doc(db, 'wali_madrasah', session.madrasahKey),
          (snap) => {
            if (!snap.exists()) return;
            const d = snap.data() as {
              profile?: MadrasahProfile;
              academicYears?: AcademicYear[];
              calendarEvents?: AcademicCalendarEvent[];
            };
            const prof = { ...EMPTY_MADRASAH, ...(d.profile || {}) };
            handlers.onMadrasah(prof);
            handlers.onAcademicYears(d.academicYears || []);
            handlers.onCalendarEvents(
              (d.calendarEvents || []).slice().sort((a, b) => a.date.localeCompare(b.date))
            );
            try {
              localStorage.setItem(
                'presensi_public_hint',
                JSON.stringify({ name: prof.name || '', logoUrl: prof.logoUrl || '' })
              );
            } catch {
              // ignore
            }
          },
          (err) => handlers.onError(err)
        )
      );
    }

    const subscribeTeachingMonth = (qrToken: string) => {
      if (teachingUnsub) {
        teachingUnsub();
        teachingUnsub = null;
      }
      if (!session.assignedClassId || !qrToken) {
        handlers.onTeachingAttendance([]);
        return;
      }
      const teachDocId = `${session.assignedClassId}_${qrToken}_${yearMonth}`;
      teachingUnsub = onSnapshot(
        doc(db, 'wali_teaching_months', teachDocId),
        (snap) => {
          if (!snap.exists()) {
            handlers.onTeachingAttendance([]);
            return;
          }
          const d = snap.data() as { sessionsMap?: Record<string, TeachingAttendanceRecord> };
          const list = Object.values(d.sessionsMap || {}).sort(
            (a, b) => (b.arrivalTimestampMs || 0) - (a.arrivalTimestampMs || 0)
          );
          handlers.onTeachingAttendance(list);
        },
        (err) => handlers.onError(err)
      );
    };

    subscribeTeachingMonth(activeQrToken);

    // 2. Class Bundle (Class Metadata + Students)
    if (session.classSecret) {
      unsubs.push(
        onSnapshot(
          doc(db, 'wali_class_bundles', session.classSecret),
          (snap) => {
            if (!snap.exists()) {
              handlers.onClasses([]);
              handlers.onStudents([]);
              return;
            }
            const d = snap.data() as { classData?: SchoolClass; students?: Student[] };
            if (d.classData) {
              handlers.onClasses([d.classData]);
              if (d.classData.qrToken && d.classData.qrToken !== activeQrToken) {
                activeQrToken = d.classData.qrToken;
                subscribeTeachingMonth(activeQrToken);
                handlers.onSessionPatch?.({
                  qrToken: d.classData.qrToken,
                  className: d.classData.name,
                });
              }
            }
            handlers.onStudents(d.students || []);
          },
          (err) => handlers.onError(err)
        )
      );

      // 3. Monthly Attendance Records
      const attDocId = `${session.classSecret}_${yearMonth}`;
      unsubs.push(
        onSnapshot(
          doc(db, 'wali_attendance_months', attDocId),
          (snap) => {
            if (!snap.exists()) {
              handlers.onAttendance([]);
              return;
            }
            const d = snap.data() as { recordsMap?: Record<string, DailyAttendanceRecord> };
            handlers.onAttendance(Object.values(d.recordsMap || {}));
          },
          (err) => handlers.onError(err)
        )
      );

      // 4. Archives
      unsubs.push(
        onSnapshot(
          doc(db, 'wali_archives', session.classSecret),
          (snap) => {
            if (!snap.exists()) {
              handlers.onArchives([]);
              return;
            }
            const d = snap.data() as { archivesMap?: Record<string, ReportArchiveItem> };
            const list = Object.values(d.archivesMap || {}).sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            );
            handlers.onArchives(list);
          },
          (err) => handlers.onError(err)
        )
      );
    } else {
      handlers.onClasses([]);
      handlers.onStudents([]);
      handlers.onAttendance([]);
      handlers.onArchives([]);
    }

    return () => {
      unsubs.forEach((fn) => fn());
      if (teachingUnsub) teachingUnsub();
    };
  },

  /**
   * Real-time subscriptions for Admin/OPM (all collections) and Google-Bound Wali Kelas
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
    if (!auth.currentUser) return;
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
  async saveMadrasahProfile(
    profile: MadrasahProfile,
    actor: User,
    actorUid: string,
    academicYears: AcademicYear[] = [],
    calendarEvents: AcademicCalendarEvent[] = []
  ): Promise<void> {
    const path = 'madrasah_config/main';
    let madrasahKey = profile.madrasahKey || '';
    try {
      if (!madrasahKey) {
        const snap = await getDoc(doc(db, 'madrasah_config', 'main'));
        madrasahKey = (snap.data()?.madrasahKey as string) || generateSecretToken('mad');
      }

      const cleanProfile: MadrasahProfile = {
        ...profile,
        madrasahKey,
      };

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
        madrasahKey,
        updatedByUid: actorUid,
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'wali_madrasah', madrasahKey), {
        madrasahKey,
        profile: cleanProfile,
        academicYears,
        calendarEvents,
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
    actorUid: string,
    madrasah?: MadrasahProfile
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

      let madrasahKey = madrasah?.madrasahKey || '';
      let profileToSync = madrasah;
      if (!madrasahKey || !profileToSync) {
        const snap = await getDoc(doc(db, 'madrasah_config', 'main'));
        if (snap.exists()) {
          const data = snap.data() as MadrasahProfile;
          madrasahKey = data.madrasahKey || generateSecretToken('mad');
          profileToSync = { ...EMPTY_MADRASAH, ...data, madrasahKey };
          if (!data.madrasahKey) {
            await updateDoc(doc(db, 'madrasah_config', 'main'), {
              madrasahKey,
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          madrasahKey = generateSecretToken('mad');
          profileToSync = { ...EMPTY_MADRASAH, madrasahKey };
          await setDoc(doc(db, 'madrasah_config', 'main'), {
            ...profileToSync,
            updatedByUid: actorUid,
            updatedAt: serverTimestamp(),
          });
        }
      }
      if (madrasahKey && profileToSync) {
        await setDoc(doc(db, 'wali_madrasah', madrasahKey), {
          madrasahKey,
          profile: profileToSync,
          academicYears: years,
          calendarEvents: events,
          updatedByUid: actorUid,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'madrasah_config/academic_snapshot');
    }
  },

  // === HELPER: REFRESH CLASS BUNDLE FOR WALI KELAS ===
  async refreshWaliClassBundle(
    cls: SchoolClass,
    allStudents: Student[],
    actorUid: string
  ): Promise<string> {
    const classSecret = cls.waliSecret || generateSecretToken('cls');
    const qrToken = cls.qrToken || generateQrToken();
    const classStudents = allStudents.filter((s) => s.classId === cls.id && s.isActive);
    const cleanClass: SchoolClass = {
      ...cls,
      waliSecret: classSecret,
      qrToken,
    };
    await setDoc(doc(db, 'wali_class_bundles', classSecret), {
      classSecret,
      classId: cls.id,
      classData: cleanClass,
      students: classStudents,
      updatedByUid: actorUid,
      updatedAt: serverTimestamp(),
    });
    return classSecret;
  },

  // === USERS CRUD ===
  async addUser(
    user: Omit<User, 'id'>,
    actor: User,
    actorUid: string,
    context?: {
      classes: SchoolClass[];
      students: Student[];
      madrasahKey?: string;
    }
  ): Promise<User> {
    const id = makeSafeId('usr');
    const cleanPin = (user.accessPin || '').trim();
    const credHash =
      user.role === 'wali_kelas' && user.username.trim() && cleanPin
        ? await computeWaliCredHash(user.username, cleanPin)
        : '';

    const created: User = {
      ...user,
      id,
      accessPin: cleanPin,
      waliCredHash: credHash,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', id), {
        id,
        username: clampStr(created.username, 80),
        name: clampStr(created.name, 160),
        role: created.role,
        nip: clampStr(created.nip, 60),
        email: clampStr(created.email, 200),
        authUid: clampStr(created.authUid, 128),
        assignedClassId: clampStr(created.assignedClassId, 128),
        accessPin: clampStr(cleanPin, 40),
        waliCredHash: clampStr(credHash, 128),
        isActive: created.isActive,
        createdByUid: actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      let assignedCls = context?.classes.find((c) => c.id === created.assignedClassId);
      let classSecret = assignedCls?.waliSecret || '';
      const qrToken = assignedCls?.qrToken || '';

      if (created.role === 'wali_kelas' && assignedCls) {
        if (!classSecret) {
          classSecret = generateSecretToken('cls');
        }
        batch.update(doc(db, 'classes', assignedCls.id), {
          homeroomTeacherId: id,
          homeroomTeacherName: clampStr(created.name, 160),
          homeroomTeacherEmail: clampStr(created.email, 200),
          waliSecret: classSecret,
          updatedAt: serverTimestamp(),
        });
        batch.set(
          doc(db, 'class_qr_codes', assignedCls.id),
          {
            classId: assignedCls.id,
            className: clampStr(assignedCls.name, 80),
            grade: clampStr(assignedCls.grade, 20),
            homeroomTeacherName: clampStr(created.name, 160),
            homeroomTeacherUid: clampStr(assignedCls.homeroomTeacherUid, 128),
            qrToken: assignedCls.qrToken || generateQrToken(),
            isActive: assignedCls.isActive,
            createdByUid: actorUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        assignedCls = {
          ...assignedCls,
          homeroomTeacherId: id,
          homeroomTeacherName: created.name,
          homeroomTeacherEmail: created.email || '',
          waliSecret: classSecret,
        };
      }

      if (credHash) {
        batch.set(doc(db, 'wali_access', credHash), {
          credHash,
          userId: id,
          username: clampStr(created.username, 80),
          name: clampStr(created.name, 160),
          nip: clampStr(created.nip, 60),
          role: 'wali_kelas',
          assignedClassId: clampStr(created.assignedClassId, 128),
          classSecret: clampStr(classSecret, 128),
          madrasahKey: clampStr(context?.madrasahKey || '', 128),
          qrToken: clampStr(qrToken, 128),
          className: clampStr(assignedCls?.name || '', 80),
          isActive: created.isActive,
          createdByUid: actorUid,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      if (assignedCls && context) {
        await this.refreshWaliClassBundle(assignedCls, context.students, actorUid);
      }

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

  async updateUser(
    updatedUser: User,
    previousUser: User | undefined,
    actor: User,
    actorUid: string,
    context?: {
      classes: SchoolClass[];
      students: Student[];
      madrasahKey?: string;
    }
  ): Promise<void> {
    const cleanPin = (updatedUser.accessPin || '').trim();
    const newCredHash =
      updatedUser.role === 'wali_kelas' && updatedUser.username.trim() && cleanPin
        ? await computeWaliCredHash(updatedUser.username, cleanPin)
        : '';
    const oldCredHash = previousUser?.waliCredHash || '';

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', updatedUser.id), {
        username: clampStr(updatedUser.username, 80),
        name: clampStr(updatedUser.name, 160),
        role: updatedUser.role,
        nip: clampStr(updatedUser.nip, 60),
        email: clampStr(updatedUser.email, 200),
        authUid: clampStr(updatedUser.authUid, 128),
        assignedClassId: clampStr(updatedUser.assignedClassId, 128),
        accessPin: clampStr(cleanPin, 40),
        waliCredHash: clampStr(newCredHash, 128),
        isActive: updatedUser.isActive,
        updatedAt: serverTimestamp(),
      });

      if (oldCredHash && oldCredHash !== newCredHash) {
        batch.delete(doc(db, 'wali_access', oldCredHash));
      }

      // Synchronize class assignment if changed
      let assignedCls = context?.classes.find((c) => c.id === updatedUser.assignedClassId);
      const classesToRefresh: SchoolClass[] = [];

      if (context) {
        context.classes.forEach((cls) => {
          if (updatedUser.role === 'wali_kelas' && cls.id === updatedUser.assignedClassId) {
            const secret = cls.waliSecret || generateSecretToken('cls');
            batch.update(doc(db, 'classes', cls.id), {
              homeroomTeacherId: updatedUser.id,
              homeroomTeacherName: clampStr(updatedUser.name, 160),
              homeroomTeacherEmail: clampStr(updatedUser.email, 200),
              waliSecret: secret,
              updatedAt: serverTimestamp(),
            });
            assignedCls = {
              ...cls,
              homeroomTeacherId: updatedUser.id,
              homeroomTeacherName: updatedUser.name,
              homeroomTeacherEmail: updatedUser.email || '',
              waliSecret: secret,
            };
            classesToRefresh.push(assignedCls);
          } else if (cls.homeroomTeacherId === updatedUser.id && cls.id !== updatedUser.assignedClassId) {
            batch.update(doc(db, 'classes', cls.id), {
              homeroomTeacherId: '',
              homeroomTeacherName: '',
              homeroomTeacherEmail: '',
              updatedAt: serverTimestamp(),
            });
            classesToRefresh.push({
              ...cls,
              homeroomTeacherId: '',
              homeroomTeacherName: '',
              homeroomTeacherEmail: '',
            });
          }
        });
      }

      if (newCredHash) {
        batch.set(doc(db, 'wali_access', newCredHash), {
          credHash: newCredHash,
          userId: updatedUser.id,
          username: clampStr(updatedUser.username, 80),
          name: clampStr(updatedUser.name, 160),
          nip: clampStr(updatedUser.nip, 60),
          role: 'wali_kelas',
          assignedClassId: clampStr(updatedUser.assignedClassId, 128),
          classSecret: clampStr(assignedCls?.waliSecret || '', 128),
          madrasahKey: clampStr(context?.madrasahKey || '', 128),
          qrToken: clampStr(assignedCls?.qrToken || '', 128),
          className: clampStr(assignedCls?.name || '', 80),
          isActive: updatedUser.isActive,
          createdByUid: actorUid,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      if (context) {
        for (const cls of classesToRefresh) {
          await this.refreshWaliClassBundle(cls, context.students, actorUid);
        }
      }

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
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', target.id));
      if (target.waliCredHash) {
        batch.delete(doc(db, 'wali_access', target.waliCredHash));
      }
      await batch.commit();
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
    actorUid: string,
    madrasah?: MadrasahProfile
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
      await this.syncAcademicSnapshot(nextYears, calendarEvents, actorUid, madrasah);
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
    actorUid: string,
    madrasah?: MadrasahProfile
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
      await this.syncAcademicSnapshot(nextYears, calendarEvents, actorUid, madrasah);
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
    actorUid: string,
    madrasah?: MadrasahProfile
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, 'academic_years', target.id));
      const nextYears = currentYears.filter((y) => y.id !== target.id);
      await this.syncAcademicSnapshot(nextYears, calendarEvents, actorUid, madrasah);
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
    actorUid: string,
    madrasah?: MadrasahProfile
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
      await this.syncAcademicSnapshot(academicYears, [...currentEvents, created], actorUid, madrasah);
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
    actorUid: string,
    madrasah?: MadrasahProfile
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
      await this.syncAcademicSnapshot(academicYears, nextEvents, actorUid, madrasah);
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
    actorUid: string,
    madrasah?: MadrasahProfile
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, 'calendar_events', target.id));
      const nextEvents = currentEvents.filter((e) => e.id !== target.id);
      await this.syncAcademicSnapshot(academicYears, nextEvents, actorUid, madrasah);
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
    actorUid: string,
    madrasahKey?: string
  ): Promise<SchoolClass> {
    const id = makeSafeId('cls');
    const teacher = users.find((u) => u.id === newClass.homeroomTeacherId);
    const homeroomTeacherEmail = teacher?.email || newClass.homeroomTeacherEmail || '';
    const homeroomTeacherUid = teacher?.authUid || newClass.homeroomTeacherUid || '';
    const qrToken = newClass.qrToken || generateQrToken();
    const qrGeneratedAt = newClass.qrGeneratedAt || new Date().toISOString();
    const waliSecret = newClass.waliSecret || generateSecretToken('cls');

    const created: SchoolClass = {
      ...newClass,
      id,
      homeroomTeacherEmail,
      homeroomTeacherUid,
      qrToken,
      qrGeneratedAt,
      waliSecret,
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
        waliSecret,
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

      batch.set(doc(db, 'wali_class_bundles', waliSecret), {
        classSecret: waliSecret,
        classId: id,
        classData: created,
        students: [],
        updatedByUid: actorUid,
        updatedAt: serverTimestamp(),
      });

      if (created.homeroomTeacherId && teacher) {
        batch.update(doc(db, 'users', created.homeroomTeacherId), {
          assignedClassId: id,
          updatedAt: serverTimestamp(),
        });
        if (teacher.waliCredHash) {
          batch.set(
            doc(db, 'wali_access', teacher.waliCredHash),
            {
              credHash: teacher.waliCredHash,
              userId: teacher.id,
              username: clampStr(teacher.username, 80),
              name: clampStr(teacher.name, 160),
              nip: clampStr(teacher.nip, 60),
              role: 'wali_kelas',
              assignedClassId: id,
              classSecret: waliSecret,
              madrasahKey: clampStr(madrasahKey || '', 128),
              qrToken,
              className: clampStr(created.name, 80),
              isActive: teacher.isActive,
              createdByUid: actorUid,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
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
    actorUid: string,
    madrasahKey?: string
  ): Promise<void> {
    const teacher = users.find((u) => u.id === updatedClass.homeroomTeacherId);
    const homeroomTeacherEmail = teacher?.email || updatedClass.homeroomTeacherEmail || '';
    const homeroomTeacherUid = teacher?.authUid || updatedClass.homeroomTeacherUid || '';
    const qrToken = updatedClass.qrToken || generateQrToken();
    const qrGeneratedAt = updatedClass.qrGeneratedAt || new Date().toISOString();
    const waliSecret = updatedClass.waliSecret || generateSecretToken('cls');

    const fullClass: SchoolClass = {
      ...updatedClass,
      homeroomTeacherEmail,
      homeroomTeacherUid,
      qrToken,
      qrGeneratedAt,
      waliSecret,
    };

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
        waliSecret,
        isActive: updatedClass.isActive,
        updatedAt: serverTimestamp(),
      });

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

      users.forEach((u) => {
        if (u.id === updatedClass.homeroomTeacherId) {
          batch.update(doc(db, 'users', u.id), {
            assignedClassId: updatedClass.id,
            updatedAt: serverTimestamp(),
          });
          if (u.waliCredHash) {
            batch.set(
              doc(db, 'wali_access', u.waliCredHash),
              {
                credHash: u.waliCredHash,
                userId: u.id,
                username: clampStr(u.username, 80),
                name: clampStr(u.name, 160),
                nip: clampStr(u.nip, 60),
                role: 'wali_kelas',
                assignedClassId: updatedClass.id,
                classSecret: waliSecret,
                madrasahKey: clampStr(madrasahKey || '', 128),
                qrToken,
                className: clampStr(updatedClass.name, 80),
                isActive: u.isActive,
                createdByUid: actorUid,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        } else if (u.assignedClassId === updatedClass.id) {
          batch.update(doc(db, 'users', u.id), {
            assignedClassId: '',
            updatedAt: serverTimestamp(),
          });
          if (u.waliCredHash) {
            batch.set(
              doc(db, 'wali_access', u.waliCredHash),
              {
                credHash: u.waliCredHash,
                userId: u.id,
                username: clampStr(u.username, 80),
                name: clampStr(u.name, 160),
                nip: clampStr(u.nip, 60),
                role: 'wali_kelas',
                assignedClassId: '',
                classSecret: '',
                madrasahKey: clampStr(madrasahKey || '', 128),
                qrToken: '',
                className: '',
                isActive: u.isActive,
                createdByUid: actorUid,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        }
      });

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

      await this.refreshWaliClassBundle(fullClass, students, actorUid);

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
    students: Student[],
    users: User[],
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

      users
        .filter((u) => u.assignedClassId === schoolClass.id && u.waliCredHash)
        .forEach((u) => {
          batch.update(doc(db, 'wali_access', u.waliCredHash!), {
            qrToken: newToken,
            updatedAt: serverTimestamp(),
          });
        });

      await batch.commit();

      await this.refreshWaliClassBundle(
        { ...schoolClass, qrToken: newToken, qrGeneratedAt: nowIso },
        students,
        actorUid
      );

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
      if (target.waliSecret) {
        batch.delete(doc(db, 'wali_class_bundles', target.waliSecret));
        batch.delete(doc(db, 'wali_archives', target.waliSecret));
      }
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
    existingStudents: Student[],
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

      if (cls) {
        await this.refreshWaliClassBundle(cls, [...existingStudents, created], actorUid);
      }

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
    existingStudents: Student[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    const prevStudent = existingStudents.find((s) => s.id === student.id);
    const cls = classes.find((c) => c.id === student.classId);
    const homeroomTeacherEmail = cls?.homeroomTeacherEmail || student.homeroomTeacherEmail || '';
    const updated = { ...student, homeroomTeacherEmail };
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

      const nextList = existingStudents.map((s) => (s.id === student.id ? updated : s));
      if (cls) {
        await this.refreshWaliClassBundle(cls, nextList, actorUid);
      }
      if (prevStudent && prevStudent.classId !== student.classId) {
        const oldCls = classes.find((c) => c.id === prevStudent.classId);
        if (oldCls) {
          await this.refreshWaliClassBundle(oldCls, nextList, actorUid);
        }
      }

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

  async deleteStudent(
    target: Student,
    classes: SchoolClass[],
    existingStudents: Student[],
    actor: User,
    actorUid: string
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, 'students', target.id));
      const cls = classes.find((c) => c.id === target.classId);
      if (cls) {
        await this.refreshWaliClassBundle(
          cls,
          existingStudents.filter((s) => s.id !== target.id),
          actorUid
        );
      }
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

      const affectedClassIds = new Set(toAdd.map((s) => s.classId));
      const allStudents = [...existingStudents, ...toAdd];
      for (const cid of affectedClassIds) {
        const cls = classes.find((c) => c.id === cid);
        if (cls) {
          await this.refreshWaliClassBundle(cls, allStudents, actorUid);
        }
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
      waliSecret?: string;
    }
  ): Promise<void> {
    const safeStudentId = studentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDate = date.replace(/[^a-zA-Z0-9_-]/g, '-');
    const id = `att_${safeStudentId}_${safeDate}`.slice(0, 128);

    const prevRecord = existingRecords.find((r) => r.studentId === studentId && r.date === date);
    const cls = classes.find((c) => c.id === classId);
    const student = students.find((s) => s.id === studentId);
    const homeroomTeacherEmail = cls?.homeroomTeacherEmail || student?.homeroomTeacherEmail || '';
    const waliSecret = options?.waliSecret || cls?.waliSecret || '';
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
            ...(waliSecret ? { waliSecret } : {}),
            timestamp: nowIso,
            createdAt: serverTimestamp(),
          });
        }

        const hasPhotoUpdate = Boolean(
          options?.removeAttachment || options?.attachmentUrl !== undefined
        );
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
        const nextNote = options?.note !== undefined ? options.note : prevRecord.note || '';

        const updatePayload: Record<string, unknown> = {
          status,
          note: clampStr(nextNote, 500),
          recordedBy: clampStr(actor.id, 128),
          ...(waliSecret ? { waliSecret } : {}),
          updatedAt: serverTimestamp(),
        };

        if (hasPhotoUpdate) {
          updatePayload.attachmentUrl = clampStr(nextAttachmentUrl, 750000);
          updatePayload.attachmentName = clampStr(nextAttachmentName, 200);
          updatePayload.attachmentUploadedAt = clampStr(nextAttachmentUploadedAt, 40);
        }

        await updateDoc(doc(db, 'daily_attendance', prevRecord.id), updatePayload);

        if (waliSecret) {
          const ym = getYearMonthStr(date);
          const monthDocId = `${waliSecret}_${ym}`;
          const bundleRecord = stripAttendanceForBundle({
            ...prevRecord,
            status,
            note: clampStr(nextNote, 500),
            attachmentName: clampStr(nextAttachmentName, 200),
            attachmentUploadedAt: clampStr(nextAttachmentUploadedAt, 40),
            recordedBy: clampStr(actor.id, 128),
          });
          await setDoc(
            doc(db, 'wali_attendance_months', monthDocId),
            {
              classSecret: waliSecret,
              classId,
              yearMonth: ym,
              recordsMap: { [prevRecord.id]: bundleRecord },
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          if (hasPhotoUpdate) {
            await setDoc(doc(db, 'wali_attachments', `${waliSecret}_${prevRecord.id}`), {
              classSecret: waliSecret,
              classId,
              attId: prevRecord.id,
              attachmentUrl: clampStr(nextAttachmentUrl, 750000),
              attachmentName: clampStr(nextAttachmentName, 200),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } else {
        const attachmentUrl = clampStr(options?.attachmentUrl || '', 750000);
        const attachmentName = clampStr(options?.attachmentName || '', 200);
        const attachmentUploadedAt = attachmentUrl ? nowIso : '';
        const note = clampStr(options?.note || '', 500);

        await setDoc(doc(db, 'daily_attendance', id), {
          id,
          studentId,
          classId,
          homeroomTeacherEmail: clampStr(homeroomTeacherEmail, 200),
          date,
          status,
          note,
          attachmentUrl,
          attachmentName,
          attachmentUploadedAt,
          recordedBy: clampStr(actor.id, 128),
          recordedByUid: actorUid,
          ...(waliSecret ? { waliSecret } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (waliSecret) {
          const ym = getYearMonthStr(date);
          const monthDocId = `${waliSecret}_${ym}`;
          const bundleRecord = stripAttendanceForBundle({
            id,
            studentId,
            classId,
            homeroomTeacherEmail,
            date,
            status,
            note,
            attachmentName,
            attachmentUploadedAt,
            recordedBy: actor.id,
            createdAt: nowIso,
          });
          await setDoc(
            doc(db, 'wali_attendance_months', monthDocId),
            {
              classSecret: waliSecret,
              classId,
              yearMonth: ym,
              recordsMap: { [id]: bundleRecord },
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          if (attachmentUrl) {
            await setDoc(doc(db, 'wali_attachments', `${waliSecret}_${id}`), {
              classSecret: waliSecret,
              classId,
              attId: id,
              attachmentUrl,
              attachmentName,
              updatedAt: serverTimestamp(),
            });
          }
        }
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
    existingRecords: DailyAttendanceRecord[],
    waliSecretOverride?: string
  ): Promise<number> {
    const classStudents = students.filter((s) => s.classId === classId && s.isActive);
    const cls = classes.find((c) => c.id === classId);
    const homeroomTeacherEmail = cls?.homeroomTeacherEmail || '';
    const waliSecret = waliSecretOverride || cls?.waliSecret || '';
    const nowIso = new Date().toISOString();
    const bundleRecordsMap: Record<string, DailyAttendanceRecord> = {};

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
              ...(waliSecret ? { waliSecret } : {}),
              timestamp: nowIso,
              createdAt: serverTimestamp(),
            });
          }
          batch.update(doc(db, 'daily_attendance', prev.id), {
            status,
            recordedBy: clampStr(actor.id, 128),
            ...(waliSecret ? { waliSecret } : {}),
            updatedAt: serverTimestamp(),
          });
          bundleRecordsMap[prev.id] = stripAttendanceForBundle({
            ...prev,
            status,
            recordedBy: actor.id,
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
            ...(waliSecret ? { waliSecret } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          bundleRecordsMap[id] = stripAttendanceForBundle({
            id,
            studentId: student.id,
            classId,
            homeroomTeacherEmail,
            date,
            status,
            note: '',
            attachmentName: '',
            attachmentUploadedAt: '',
            recordedBy: actor.id,
            createdAt: nowIso,
          });
        }
      });

      if (waliSecret && Object.keys(bundleRecordsMap).length > 0) {
        const ym = getYearMonthStr(date);
        const monthDocId = `${waliSecret}_${ym}`;
        batch.set(
          doc(db, 'wali_attendance_months', monthDocId),
          {
            classSecret: waliSecret,
            classId,
            yearMonth: ym,
            recordsMap: bundleRecordsMap,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

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
    actorUid: string,
    waliSecretOverride?: string
  ): Promise<void> {
    const id = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    let existing = existingArchives.find(
      (a) => a.studentId === item.studentId && a.month === item.month && a.year === item.year
    );
    const cls = classes.find((c) => c.id === item.classId);
    let homeroomTeacherEmail = cls?.homeroomTeacherEmail || item.homeroomTeacherEmail || '';
    const waliSecret = waliSecretOverride || cls?.waliSecret || '';

    try {
      if (!existing && auth.currentUser) {
        const snap = await getDoc(doc(db, 'report_archives', id));
        if (snap.exists()) {
          existing = snap.data() as ReportArchiveItem;
        }
      }
      if (!homeroomTeacherEmail && item.classId && auth.currentUser) {
        const clsSnap = await getDoc(doc(db, 'classes', item.classId));
        if (clsSnap.exists()) {
          homeroomTeacherEmail = (clsSnap.data() as SchoolClass).homeroomTeacherEmail || '';
        }
      }

      let savedItem: ReportArchiveItem;

      if (existing) {
        const nextVersion = (existing.version || 1) + 1;
        await updateDoc(doc(db, 'report_archives', existing.id), {
          effectiveDays: item.effectiveDays,
          hadir: item.hadir,
          sakit: item.sakit,
          izin: item.izin,
          alpa: item.alpa,
          percentage: item.percentage,
          version: nextVersion,
          customNote: clampStr(item.customNote, 600),
          deliveryStatus: item.deliveryStatus,
          lastDeliveredAt: clampStr(item.lastDeliveredAt, 40),
          ...(waliSecret ? { waliSecret } : {}),
          updatedAt: serverTimestamp(),
        });
        savedItem = {
          ...existing,
          effectiveDays: item.effectiveDays,
          hadir: item.hadir,
          sakit: item.sakit,
          izin: item.izin,
          alpa: item.alpa,
          percentage: item.percentage,
          version: nextVersion,
          customNote: item.customNote,
          deliveryStatus: item.deliveryStatus,
          lastDeliveredAt: item.lastDeliveredAt,
        };
      } else {
        const createdAt = item.createdAt || new Date().toISOString();
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
          createdAt,
          createdByName: clampStr(item.createdByName || 'Wali Kelas', 160),
          createdByUid: actorUid,
          ...(waliSecret ? { waliSecret } : {}),
          version: 1,
          customNote: clampStr(item.customNote, 600),
          deliveryStatus: item.deliveryStatus,
          lastDeliveredAt: clampStr(item.lastDeliveredAt, 40),
          parentWhatsapp: clampStr(item.parentWhatsapp, 30),
          updatedAt: serverTimestamp(),
        });
        savedItem = {
          ...item,
          id,
          homeroomTeacherEmail,
          createdAt,
          version: 1,
        };
      }

      if (waliSecret) {
        await setDoc(
          doc(db, 'wali_archives', waliSecret),
          {
            classSecret: waliSecret,
            classId: item.classId,
            archivesMap: { [savedItem.id]: savedItem },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `report_archives/${id}`);
    }
  },

  async updateDeliveryStatus(
    studentId: string,
    month: number,
    year: number,
    status: 'terkirim' | 'gagal',
    waliSecret?: string,
    classId?: string,
    existingArchive?: ReportArchiveItem
  ): Promise<void> {
    const id = `rep_${studentId}_${month}_${year}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    const nowIso = new Date().toISOString();
    try {
      const ref = doc(db, 'report_archives', id);
      if (auth.currentUser) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, {
            deliveryStatus: status,
            lastDeliveredAt: nowIso,
            updatedAt: serverTimestamp(),
          });
        }
      } else if (waliSecret && existingArchive) {
        await updateDoc(ref, {
          deliveryStatus: status,
          lastDeliveredAt: nowIso,
          waliSecret,
          updatedAt: serverTimestamp(),
        });
      }
      if (waliSecret && classId && existingArchive) {
        await setDoc(
          doc(db, 'wali_archives', waliSecret),
          {
            classSecret: waliSecret,
            classId,
            archivesMap: {
              [existingArchive.id]: {
                ...existingArchive,
                deliveryStatus: status,
                lastDeliveredAt: nowIso,
              },
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
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
    actorUid: string;
    actorEmail?: string;
  }): Promise<TeachingAttendanceRecord> {
    const id = makeSafeId('teach');
    const now = new Date();
    const date = formatDateYYYYMMDD(now);
    const arrivalTime = formatTimeHHMM(now);
    const arrivalTimestampMs = now.getTime();
    const recordedByEmail = clampStr(params.actorEmail || '', 200);

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
      recordedByUid: clampStr(params.actorUid, 128),
      recordedByEmail,
    };

    try {
      await setDoc(doc(db, 'teaching_attendance', id), {
        ...payload,
        arrivalAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const ym = getYearMonthStr(date);
      const teachDocId = `${payload.classId}_${payload.qrToken}_${ym}`;
      await setDoc(
        doc(db, 'wali_teaching_months', teachDocId),
        {
          classId: payload.classId,
          qrToken: payload.qrToken,
          yearMonth: ym,
          sessionsMap: { [id]: payload },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

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
    const cleanClosingNote = clampStr(closingNote?.trim() || '', 500);

    try {
      await updateDoc(doc(db, 'teaching_attendance', session.id), {
        status: 'selesai',
        completedTime,
        completedTimestampMs,
        durationMinutes,
        closingNote: cleanClosingNote,
        updatedAt: serverTimestamp(),
      });

      const updated: TeachingAttendanceRecord = {
        ...session,
        status: 'selesai',
        completedTime,
        completedTimestampMs,
        durationMinutes,
        closingNote: cleanClosingNote,
      };

      try {
        const ym = getYearMonthStr(session.date);
        const teachDocId = `${session.classId}_${session.qrToken}_${ym}`;
        await setDoc(
          doc(db, 'wali_teaching_months', teachDocId),
          {
            classId: session.classId,
            qrToken: session.qrToken,
            yearMonth: ym,
            sessionsMap: { [session.id]: updated },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch {
        // non-blocking if QR token was rotated after check-in
      }

      return updated;
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
   * Ensure all existing classes also have qrToken & class_qr_codes registry
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
   * Backfill & keep Wali Kelas capability bundles synchronized for pre-existing records
   */
  async ensureWaliPortalSync(params: {
    madrasah: MadrasahProfile;
    academicYears: AcademicYear[];
    calendarEvents: AcademicCalendarEvent[];
    classes: SchoolClass[];
    students: Student[];
    users: User[];
    attendanceRecords: DailyAttendanceRecord[];
    teachingRecords: TeachingAttendanceRecord[];
    archives: ReportArchiveItem[];
    adminUid: string;
  }): Promise<void> {
    const {
      madrasah,
      academicYears,
      calendarEvents,
      classes,
      students,
      users,
      attendanceRecords,
      teachingRecords,
      archives,
      adminUid,
    } = params;

    try {
      // 1. Ensure madrasahKey & wali_madrasah
      let madrasahKey = madrasah.madrasahKey || '';
      if (!madrasahKey) {
        const mainSnap = await getDoc(doc(db, 'madrasah_config', 'main'));
        madrasahKey = (mainSnap.data()?.madrasahKey as string) || generateSecretToken('mad');
        await setDoc(
          doc(db, 'madrasah_config', 'main'),
          {
            ...EMPTY_MADRASAH,
            ...madrasah,
            madrasahKey,
            updatedByUid: adminUid,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await setDoc(doc(db, 'wali_madrasah', madrasahKey), {
        madrasahKey,
        profile: { ...madrasah, madrasahKey },
        academicYears,
        calendarEvents,
        updatedByUid: adminUid,
        updatedAt: serverTimestamp(),
      });

      // 2. Ensure waliSecret on every class & build wali_class_bundles
      const classSecretByClassId = new Map<string, { secret: string; cls: SchoolClass }>();
      for (const cls of classes) {
        let secret = cls.waliSecret || '';
        const qrToken = cls.qrToken || generateQrToken();
        if (!secret) {
          secret = generateSecretToken('cls');
          await updateDoc(doc(db, 'classes', cls.id), {
            waliSecret: secret,
            qrToken,
            updatedAt: serverTimestamp(),
          });
        }
        const updatedCls = { ...cls, waliSecret: secret, qrToken };
        classSecretByClassId.set(cls.id, { secret, cls: updatedCls });
        await this.refreshWaliClassBundle(updatedCls, students, adminUid);
      }

      // 3. Ensure waliCredHash & wali_access on every active Wali Kelas with PIN
      for (const u of users) {
        if (u.role === 'wali_kelas' && u.username.trim() && (u.accessPin || '').trim()) {
          const credHash = u.waliCredHash || (await computeWaliCredHash(u.username, u.accessPin!));
          const classInfo = u.assignedClassId
            ? classSecretByClassId.get(u.assignedClassId)
            : undefined;
          if (u.waliCredHash !== credHash) {
            await updateDoc(doc(db, 'users', u.id), {
              waliCredHash: credHash,
              updatedAt: serverTimestamp(),
            });
          }
          await setDoc(doc(db, 'wali_access', credHash), {
            credHash,
            userId: u.id,
            username: clampStr(u.username, 80),
            name: clampStr(u.name, 160),
            nip: clampStr(u.nip, 60),
            role: 'wali_kelas',
            assignedClassId: clampStr(u.assignedClassId, 128),
            classSecret: clampStr(classInfo?.secret || '', 128),
            madrasahKey,
            qrToken: clampStr(classInfo?.cls.qrToken || '', 128),
            className: clampStr(classInfo?.cls.name || '', 80),
            isActive: u.isActive,
            createdByUid: adminUid,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 4. Mirror attendance months + attachments
      const attMonths = new Map<
        string,
        { classSecret: string; classId: string; yearMonth: string; recordsMap: Record<string, DailyAttendanceRecord> }
      >();
      for (const rec of attendanceRecords) {
        const info = classSecretByClassId.get(rec.classId);
        if (!info) continue;
        const ym = getYearMonthStr(rec.date);
        const key = `${info.secret}_${ym}`;
        if (!attMonths.has(key)) {
          attMonths.set(key, {
            classSecret: info.secret,
            classId: rec.classId,
            yearMonth: ym,
            recordsMap: {},
          });
        }
        attMonths.get(key)!.recordsMap[rec.id] = stripAttendanceForBundle(rec);
        if (rec.attachmentUrl) {
          await setDoc(doc(db, 'wali_attachments', `${info.secret}_${rec.id}`), {
            classSecret: info.secret,
            classId: rec.classId,
            attId: rec.id,
            attachmentUrl: clampStr(rec.attachmentUrl, 750000),
            attachmentName: clampStr(rec.attachmentName || '', 200),
            updatedAt: serverTimestamp(),
          });
        }
      }
      for (const [docId, payload] of attMonths.entries()) {
        await setDoc(
          doc(db, 'wali_attendance_months', docId),
          {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // 5. Mirror teaching months
      const teachMonths = new Map<
        string,
        { classId: string; qrToken: string; yearMonth: string; sessionsMap: Record<string, TeachingAttendanceRecord> }
      >();
      for (const rec of teachingRecords) {
        const info = classSecretByClassId.get(rec.classId);
        const token = rec.qrToken || info?.cls.qrToken;
        if (!token) continue;
        const ym = getYearMonthStr(rec.date);
        const key = `${rec.classId}_${token}_${ym}`;
        if (!teachMonths.has(key)) {
          teachMonths.set(key, {
            classId: rec.classId,
            qrToken: token,
            yearMonth: ym,
            sessionsMap: {},
          });
        }
        teachMonths.get(key)!.sessionsMap[rec.id] = rec;
      }
      for (const [docId, payload] of teachMonths.entries()) {
        await setDoc(
          doc(db, 'wali_teaching_months', docId),
          {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // 6. Mirror archives
      const archivesBySecret = new Map<
        string,
        { classSecret: string; classId: string; archivesMap: Record<string, ReportArchiveItem> }
      >();
      for (const ar of archives) {
        const info = classSecretByClassId.get(ar.classId);
        if (!info) continue;
        if (!archivesBySecret.has(info.secret)) {
          archivesBySecret.set(info.secret, {
            classSecret: info.secret,
            classId: ar.classId,
            archivesMap: {},
          });
        }
        archivesBySecret.get(info.secret)!.archivesMap[ar.id] = ar;
      }
      for (const [secret, payload] of archivesBySecret.entries()) {
        await setDoc(
          doc(db, 'wali_archives', secret),
          {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch {
      // non-blocking background sync
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
      'wali_access',
      'wali_madrasah',
      'wali_class_bundles',
      'wali_attendance_months',
      'wali_attachments',
      'wali_teaching_months',
      'wali_archives',
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
