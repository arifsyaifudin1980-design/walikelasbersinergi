import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const BOOTSTRAPPED_ADMIN_EMAIL = 'arifsyaifudin1980@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export interface AuthErrorInfo {
  code: string;
  title: string;
  message: string;
  hostname?: string;
  consoleAuthSettingsUrl?: string;
  canTryRedirect?: boolean;
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function formatFirebaseAuthError(err: unknown): AuthErrorInfo {
  const code = (err as { code?: string })?.code || '';
  const rawMessage =
    err instanceof Error ? err.message : 'Terjadi kendala saat menghubungkan akun Google.';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const projectId = firebaseConfig.projectId;
  const inIframe = isRunningInIframe();

  if (code === 'auth/unauthorized-domain') {
    return {
      code,
      title: 'Domain Belum Diizinkan di Firebase Authentication',
      message: `Domain "${hostname || 'aplikasi ini'}" belum terdaftar di daftar Authorized Domains proyek Firebase (${projectId}). Tambahkan "${hostname}" di Firebase Console → Authentication → Settings → Authorized domains, lalu coba login lagi.`,
      hostname: hostname || undefined,
      consoleAuthSettingsUrl: `https://console.firebase.google.com/project/${projectId}/authentication/settings`,
      canTryRedirect: false,
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      title: 'Pop-up Login Google Diblokir Browser',
      message: inIframe
        ? 'Browser memblokir jendela pop-up login Google. Izinkan pop-up untuk situs ini di pengaturan browser lalu klik login kembali.'
        : 'Browser memblokir jendela pop-up login Google. Izinkan pop-up di ikon address bar browser, atau gunakan Login Mode Pengalihan (Redirect) di bawah.',
      canTryRedirect: !inIframe,
    };
  }

  if (code === 'auth/cancelled-popup-request') {
    return {
      code,
      title: 'Permintaan Login Sebelumnya Dibatalkan',
      message:
        'Jendela login Google sebelumnya belum selesai diproses. Klik tombol login satu kali lalu tunggu jendela Google terbuka.',
      canTryRedirect: !inIframe,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      title: 'Login Google Belum Diaktifkan',
      message: `Metode sign-in Google belum diaktifkan pada proyek Firebase (${projectId}). Aktifkan Google Provider di Firebase Console → Authentication → Sign-in method.`,
      consoleAuthSettingsUrl: `https://console.firebase.google.com/project/${projectId}/authentication/providers`,
      canTryRedirect: false,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      title: 'Koneksi Jaringan Bermasalah',
      message:
        'Tidak dapat terhubung ke server autentikasi Google. Periksa koneksi internet Anda lalu coba login kembali.',
      canTryRedirect: false,
    };
  }

  if (code === 'auth/user-disabled') {
    return {
      code,
      title: 'Akun Google Dinonaktifkan',
      message:
        'Akun Google ini sedang dinonaktifkan pada layanan autentikasi. Hubungi administrator madrasah.',
      canTryRedirect: false,
    };
  }

  return {
    code: code || 'auth/unknown',
    title: 'Kendala Autentikasi Google',
    message: code
      ? `Login Google gagal (${code}). ${inIframe ? 'Pastikan pop-up & cookie pihak ketiga diizinkan browser, lalu coba lagi.' : 'Coba izinkan pop-up atau gunakan Login Mode Pengalihan di bawah.'}`
      : rawMessage,
    canTryRedirect: !inIframe,
  };
}

