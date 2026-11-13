import { StudentMonthlyRecap } from '../types';
import { generateStudentReportBlob } from './canvasReport';
import { storageService } from './storage';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export interface WhatsAppSharePayload {
  recap: StudentMonthlyRecap;
  madrasahName: string;
  className: string;
  homeroomTeacherName: string;
  customNote?: string;
}

/**
 * Format polite, official Indonesian WhatsApp message for parents
 */
export function formatWhatsAppMessage(payload: WhatsAppSharePayload): string {
  const { recap, madrasahName, className, homeroomTeacherName, customNote } = payload;
  const monthName = MONTH_NAMES[recap.month - 1] || 'Bulan';

  const defaultNote =
    recap.attendancePercentage >= 95
      ? 'Alhamdulillah, kehadiran Ananda sangat baik. Mohon terus dipertahankan dan didukung dari rumah.'
      : recap.attendancePercentage >= 85
      ? 'Kehadiran Ananda cukup baik. Mohon kerjasama Bapak/Ibu untuk terus memotivasi kedisiplinan Ananda.'
      : 'Kehadiran Ananda memerlukan perhatian khusus. Mohon Bapak/Ibu dapat berkomunikasi dengan pihak madrasah.';

  const noteToUse = customNote || defaultNote;

  return `*LAPORAN REKAP PRESENSI SISWA*
*${madrasahName}*
Periode: *${monthName} ${recap.year}*

Kepada Yth. Bapak/Ibu Orang Tua/Wali dari:
👤 *Nama Siswa:* ${recap.student.name}
🔢 *NIS/NISN:* ${recap.student.nis} / ${recap.student.nisn}
🏫 *Kelas:* ${className}

Berikut adalah ringkasan kehadiran ananda selama bulan *${monthName} ${recap.year}*:
• 🟢 *Hadir (H):* ${recap.hadir} hari
• 🟡 *Sakit (S):* ${recap.sakit} hari
• 🔵 *Izin (I):* ${recap.izin} hari
• 🔴 *Alpa (A):* ${recap.alpa} hari
• 📅 *Total Hari Efektif:* ${recap.effectiveDays} hari
• 📊 *Tingkat Kehadiran:* *${recap.attendancePercentage}%*

📝 *Catatan Wali Kelas:*
_${noteToUse}_

Infografis resmi berformat JPG terlampir telah digenerate otomatis oleh sistem. Terima kasih atas perhatian dan kerjasama Bapak/Ibu.

Wassalamu'alaikum Wr. Wb.
Hormat kami,
*${homeroomTeacherName}*
(Wali Kelas ${className})`;
}

/**
 * Clean and format Indonesian phone number to international format (62xxx)
 */
export function formatIndonesianPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Trigger Web Share API if supported, or open WhatsApp Web / App
 */
export async function shareReportToWhatsApp(
  payload: WhatsAppSharePayload,
  renderOptions: Parameters<typeof generateStudentReportBlob>[0]
): Promise<{ success: boolean; method: 'web_share' | 'wa_link' }> {
  const { recap } = payload;
  const message = formatWhatsAppMessage(payload);
  const rawPhone = recap.student.parentWhatsapp;
  const targetPhone = formatIndonesianPhoneNumber(rawPhone);

  const cleanStudentName = recap.student.name.replace(/[^a-zA-Z0-9]/g, '_');
  const monthName = MONTH_NAMES[recap.month - 1] || 'Bulan';
  const filename = `Laporan_Presensi_${cleanStudentName}_${monthName}.jpg`;

  // 1. Try Web Share API (supports file sharing directly on mobile / Chrome)
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await generateStudentReportBlob(renderOptions);
      const file = new File([blob], filename, { type: 'image/jpeg' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Laporan Presensi ${recap.student.name}`,
          text: message,
          files: [file],
        });

        // Record delivery
        storageService.updateDeliveryStatus(recap.student.id, recap.month, recap.year, 'terkirim');
        storageService.addAuditLog(
          'Distribusi WhatsApp',
          `Laporan ${recap.student.name} dibagikan via Web Share API ke ${targetPhone}`
        );
        return { success: true, method: 'web_share' };
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        // User cancelled picker
        return { success: false, method: 'web_share' };
      }
      // If error, fallback to wa.me link
      console.warn('Web Share API error, falling back to WhatsApp link:', err);
    }
  }

  // 2. Fallback: Direct WhatsApp Link
  const encodedText = encodeURIComponent(message);
  const waUrl = `https://wa.me/${targetPhone}?text=${encodedText}`;

  // Open in new tab or popup
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  // Record delivery status as sent
  storageService.updateDeliveryStatus(recap.student.id, recap.month, recap.year, 'terkirim');
  storageService.addAuditLog(
    'Distribusi WhatsApp',
    `Laporan ${recap.student.name} dibuka di WhatsApp menuju ${targetPhone}`
  );

  return { success: true, method: 'wa_link' };
}
