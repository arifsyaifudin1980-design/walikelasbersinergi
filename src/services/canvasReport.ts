import JSZip from 'jszip';
import { MadrasahProfile, StudentMonthlyRecap } from '../types';

export const ATTENDANCE_COLORS = {
  H: '#10B981', // Emerald green
  S: '#F59E0B', // Amber yellow
  I: '#3B82F6', // Sky blue
  A: '#EF4444', // Rose red
  track: '#E2E8F0', // Neutral track
};

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

export interface ReportRenderOptions {
  recap: StudentMonthlyRecap;
  madrasah: MadrasahProfile;
  className: string;
  homeroomTeacherName: string;
  homeroomTeacherNip?: string;
  academicYear: string;
  semester: string;
  customNote?: string;
}

/**
 * High-definition 1080x1350 canvas renderer for student attendance infographic
 */
export async function renderStudentReportCanvas(
  options: ReportRenderOptions
): Promise<HTMLCanvasElement> {
  const {
    recap,
    madrasah,
    className,
    homeroomTeacherName,
    homeroomTeacherNip,
    academicYear,
    semester,
    customNote,
  } = options;

  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // 1. Background gradient (Elegant warm parchment / clean modern slate)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#FFFFFF');
  bgGrad.addColorStop(0.5, '#F8FAFC');
  bgGrad.addColorStop(1, '#F1F5F9');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Islamic geometric accent border
  ctx.strokeStyle = '#059669'; // Emerald
  ctx.lineWidth = 14;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  ctx.strokeStyle = '#D97706'; // Gold inner border
  ctx.lineWidth = 2.5;
  ctx.strokeRect(34, 34, width - 68, height - 68);

  // Corner decorative flourishes
  const drawCornerFlourish = (x: number, y: number, angle: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };
  drawCornerFlourish(42, 42, 0);
  drawCornerFlourish(width - 42, 42, 0);
  drawCornerFlourish(42, height - 42, 0);
  drawCornerFlourish(width - 42, height - 42, 0);

  // 3. Official Kop Madrasah (Letterhead)
  // Render uploaded logo if present, otherwise clean empty logo container (wadah logo)
  const logoSize = 110;
  const logoX = 70;
  const logoY = 60;

  if (madrasah.logoUrl) {
    try {
      const logoImg = await loadImage(madrasah.logoUrl);
      const scale = Math.min(logoSize / logoImg.width, logoSize / logoImg.height);
      const drawW = logoImg.width * scale;
      const drawH = logoImg.height * scale;
      const offsetX = logoX + (logoSize - drawW) / 2;
      const offsetY = logoY + (logoSize - drawH) / 2;
      ctx.drawImage(logoImg, offsetX, offsetY, drawW, drawH);
    } catch {
      drawEmptyLogoContainer(ctx, logoX, logoY, logoSize);
    }
  } else {
    drawEmptyLogoContainer(ctx, logoX, logoY, logoSize);
  }

  // Header Texts
  const displayMadrasahName = madrasah.name.trim()
    ? madrasah.name.toUpperCase()
    : 'NAMA MADRASAH / SEKOLAH';
  const displayMeta = [
    madrasah.nsm ? `NSM: ${madrasah.nsm}` : null,
    madrasah.npsn ? `NPSN: ${madrasah.npsn}` : null,
    madrasah.phone ? `Telp: ${madrasah.phone}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');

  ctx.textAlign = 'left';
  ctx.fillStyle = '#065F46';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 205, 80);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(displayMadrasahName, 205, 118);

  ctx.fillStyle = '#475569';
  ctx.font = '500 17px "Plus Jakarta Sans", sans-serif';
  if (displayMeta) {
    ctx.fillText(displayMeta, 205, 144);
  }
  if (madrasah.address) {
    ctx.fillText(madrasah.address, 205, 168);
  }

  // Kop Separator Double Line
  ctx.strokeStyle = '#059669';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(56, 190);
  ctx.lineTo(width - 56, 190);
  ctx.stroke();

  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(56, 196);
  ctx.lineTo(width - 56, 196);
  ctx.stroke();

  // 4. Report Title Banner
  const titleY = 224;
  const titleBoxGrad = ctx.createLinearGradient(120, titleY, width - 120, titleY);
  titleBoxGrad.addColorStop(0, '#047857');
  titleBoxGrad.addColorStop(0.5, '#059669');
  titleBoxGrad.addColorStop(1, '#047857');

  drawRoundedRect(ctx, 160, titleY, width - 320, 52, 26);
  ctx.fillStyle = titleBoxGrad;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAPORAN PRESENSI SISWA', width / 2, titleY + 34);

  // Month & Academic Year Subtitle
  const monthName = MONTH_NAMES[recap.month - 1] || 'Bulan';
  ctx.fillStyle = '#065F46';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Bulan: ${monthName.toUpperCase()} ${recap.year}  •  Semester ${semester} TA ${academicYear}`,
    width / 2,
    306
  );

  // 5. Student Identity Card Box
  const idBoxY = 328;
  const idBoxH = 120;
  drawRoundedRect(ctx, 60, idBoxY, width - 120, idBoxH, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Left Green Accent Bar
  drawRoundedRect(ctx, 60, idBoxY, 12, idBoxH, 6);
  ctx.fillStyle = '#059669';
  ctx.fill();

  // Student Details inside Card
  ctx.textAlign = 'left';
  // Column 1
  ctx.fillStyle = '#64748B';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Nama Siswa', 95, idBoxY + 36);
  ctx.fillText('NIS / NISN', 95, idBoxY + 88);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(recap.student.name, 220, idBoxY + 36);
  ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${recap.student.nis} / ${recap.student.nisn}`, 220, idBoxY + 88);

  // Column 2
  ctx.fillStyle = '#64748B';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Kelas', 650, idBoxY + 36);
  ctx.fillText('Wali Kelas', 650, idBoxY + 88);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(className, 770, idBoxY + 36);
  ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(homeroomTeacherName, 770, idBoxY + 88);

  // 6. Visual Presentation: Large Central Donut Chart
  const chartCenterX = width / 2;
  const chartCenterY = 620;
  const outerRadius = 142;
  const innerRadius = 92;

  const totalRecorded = recap.hadir + recap.sakit + recap.izin + recap.alpa;
  const effectiveTotal = Math.max(recap.effectiveDays, totalRecorded, 1);

  // Slices: Hadir (green), Sakit (yellow), Izin (blue), Alpa (red), Unrecorded (neutral)
  const slices = [
    { label: 'Hadir', count: recap.hadir, color: ATTENDANCE_COLORS.H },
    { label: 'Sakit', count: recap.sakit, color: ATTENDANCE_COLORS.S },
    { label: 'Izin', count: recap.izin, color: ATTENDANCE_COLORS.I },
    { label: 'Alpa', count: recap.alpa, color: ATTENDANCE_COLORS.A },
  ];

  if (recap.unrecordedDays > 0) {
    slices.push({
      label: 'Belum Terisi',
      count: recap.unrecordedDays,
      color: ATTENDANCE_COLORS.track,
    });
  }

  // Draw background ring track
  ctx.beginPath();
  ctx.arc(chartCenterX, chartCenterY, outerRadius, 0, Math.PI * 2);
  ctx.arc(chartCenterX, chartCenterY, innerRadius, Math.PI * 2, 0, true);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();

  let startAngle = -Math.PI / 2; // start from top
  slices.forEach((slice) => {
    if (slice.count <= 0) return;
    const sliceAngle = (slice.count / effectiveTotal) * (Math.PI * 2);
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(chartCenterX, chartCenterY, outerRadius, startAngle, endAngle);
    ctx.arc(chartCenterX, chartCenterY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();

    // Subtle slice border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    startAngle = endAngle;
  });

  // Center percentage and label
  ctx.textAlign = 'center';
  ctx.fillStyle = '#065F46';
  ctx.font = '800 46px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${recap.attendancePercentage}%`, chartCenterX, chartCenterY + 4);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('KEHADIRAN', chartCenterX, chartCenterY + 32);

  // Status Badge below chart (e.g., "Sangat Baik", "Baik", "Perlu Perhatian")
  let statusBadgeText = 'SANGAT BAIK';
  let statusBadgeColor = '#059669';
  if (recap.attendancePercentage < 75) {
    statusBadgeText = 'PERLU PERHATIAN KHUSUS';
    statusBadgeColor = '#DC2626';
  } else if (recap.attendancePercentage < 85) {
    statusBadgeText = 'CUKUP';
    statusBadgeColor = '#D97706';
  } else if (recap.attendancePercentage < 95) {
    statusBadgeText = 'BAIK';
    statusBadgeColor = '#2563EB';
  }

  drawRoundedRect(ctx, width / 2 - 130, 786, 260, 36, 18);
  ctx.fillStyle = statusBadgeColor + '20'; // 12% opacity
  ctx.fill();
  ctx.strokeStyle = statusBadgeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = statusBadgeColor;
  ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(statusBadgeText, width / 2, 810);

  // 7. Key Attendance Statistics Metric Cards (4 Cards Grid)
  const cardY = 844;
  const cardW = 216;
  const cardH = 112;
  const cardSpacing = 16;
  const startX = (width - (cardW * 4 + cardSpacing * 3)) / 2;

  const metricCards = [
    {
      code: 'H',
      title: 'Hadir',
      val: `${recap.hadir}`,
      unit: 'Hari',
      desc: 'Mengikuti KBM',
      color: ATTENDANCE_COLORS.H,
      bg: '#ECFDF5',
    },
    {
      code: 'S',
      title: 'Sakit',
      val: `${recap.sakit}`,
      unit: 'Hari',
      desc: 'Keterangan Sakit',
      color: ATTENDANCE_COLORS.S,
      bg: '#FFFBEB',
    },
    {
      code: 'I',
      title: 'Izin',
      val: `${recap.izin}`,
      unit: 'Hari',
      desc: 'Izin Sah Tertulis',
      color: ATTENDANCE_COLORS.I,
      bg: '#EFF6FF',
    },
    {
      code: 'A',
      title: 'Alpa',
      val: `${recap.alpa}`,
      unit: 'Hari',
      desc: 'Tanpa Keterangan',
      color: ATTENDANCE_COLORS.A,
      bg: '#FEF2F2',
    },
  ];

  metricCards.forEach((c, idx) => {
    const x = startX + idx * (cardW + cardSpacing);
    drawRoundedRect(ctx, x, cardY, cardW, cardH, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top small badge
    drawRoundedRect(ctx, x + 16, cardY + 14, 28, 28, 8);
    ctx.fillStyle = c.bg;
    ctx.fill();
    ctx.fillStyle = c.color;
    ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.code, x + 30, cardY + 34);

    // Title
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(c.title, x + 54, cardY + 34);

    // Value
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(c.val, x + 18, cardY + 80);

    ctx.fillStyle = '#64748B';
    ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(c.unit, x + 18 + ctx.measureText(c.val).width + 8, cardY + 77);

    // Subtitle
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(c.desc, x + 18, cardY + 100);
  });

  // Effective days info bar
  const effY = 974;
  drawRoundedRect(ctx, 60, effY, width - 120, 46, 12);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#334155';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Total Hari Efektif Belajar: ${recap.effectiveDays} Hari   |   Tercatat: ${totalRecorded} Hari   |   Belum Diisi: ${recap.unrecordedDays} Hari`,
    width / 2,
    effY + 29
  );

  // 8. Catatan Wali Kelas Box
  const noteY = 1034;
  const noteH = 94;
  drawRoundedRect(ctx, 60, noteY, width - 120, noteH, 14);
  ctx.fillStyle = '#F0FDF4'; // light emerald tint
  ctx.fill();
  ctx.strokeStyle = '#86EFAC';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#065F46';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Catatan & Evaluasi Wali Kelas:', 85, noteY + 30);

  const defaultGuidance =
    recap.attendancePercentage >= 95
      ? 'Alhamdulillah, kehadiran ananda sangat luar biasa! Terus pertahankan semangat ibadah dan kedisiplinan belajar.'
      : recap.attendancePercentage >= 85
      ? 'Kehadiran ananda cukup baik. Mohon terus ditingkatkan kedisiplinannya agar prestasi akademik kian optimal.'
      : 'Perlu peningkatan kehadiran dan komunikasi aktif dengan madrasah jika berhalangan hadir. Mohon kerjasama Bapak/Ibu.';

  const finalNote = customNote || defaultGuidance;
  ctx.fillStyle = '#1E293B';
  ctx.font = 'italic 16px "Plus Jakarta Sans", sans-serif';

  // Word wrap note text (max 2 lines)
  wrapText(ctx, `"${finalNote}"`, 85, noteY + 58, width - 170, 24);

  // 9. Signatures Block (Footer)
  const signY = 1146;
  const lastDay = new Date(recap.year, recap.month, 0).getDate();
  const cityPrefix = madrasah.city ? `${madrasah.city}, ` : '';
  const dateFormatted = `${cityPrefix}${lastDay} ${monthName} ${recap.year}`;

  // Left: Official Stamp Mockup & QR code
  const qrX = 90;
  const qrY = signY + 12;
  drawRoundedRect(ctx, qrX, qrY, 96, 96, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw simulated security QR code pattern
  drawSimulatedQR(ctx, qrX + 8, qrY + 8, 80);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Verifikasi Resmi Dokumen', qrX + 110, qrY + 34);
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`ID: REG-${recap.student.nis}-${recap.month}${recap.year}`, qrX + 110, qrY + 54);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Aplikasi Monitoring Presensi Madrasah', qrX + 110, qrY + 72);

  // Right: Wali Kelas Signature
  ctx.textAlign = 'center';
  const signRightX = width - 240;
  ctx.fillStyle = '#334155';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(dateFormatted, signRightX, signY + 24);
  ctx.fillText('Wali Kelas ' + className + ',', signRightX, signY + 48);

  // Signature line and Teacher Name
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(signRightX - 140, signY + 130);
  ctx.lineTo(signRightX + 140, signY + 130);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(homeroomTeacherName, signRightX, signY + 154);

  if (homeroomTeacherNip) {
    ctx.fillStyle = '#64748B';
    ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`NIP. ${homeroomTeacherNip}`, signRightX, signY + 174);
  }

  // Circular Digital Stamp Emblem over signature
  drawStampEmblem(ctx, signRightX - 80, signY + 86, madrasah.name);

  // 10. Bottom Micro-Footer
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Dokumen resmi ini digenerate secara otomatis melalui Presensi Pintar Madrasah • Format Khusus Laporan Orang Tua`,
    width / 2,
    height - 30
  );

  return canvas;
}

/**
 * Generate JPG Data URL (0.92 quality)
 */
export async function generateStudentReportJPG(options: ReportRenderOptions): Promise<string> {
  const canvas = await renderStudentReportCanvas(options);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Generate Blob for downloading or Web Share API
 */
export async function generateStudentReportBlob(options: ReportRenderOptions): Promise<Blob> {
  const canvas = await renderStudentReportCanvas(options);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create Blob'));
      },
      'image/jpeg',
      0.92
    );
  });
}

/**
 * Download single student JPG
 */
export async function downloadStudentReportJPG(options: ReportRenderOptions): Promise<void> {
  const blob = await generateStudentReportBlob(options);
  const monthName = MONTH_NAMES[options.recap.month - 1] || 'Bulan';
  const cleanStudentName = options.recap.student.name.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanClassName = options.className.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Laporan_Presensi_${cleanStudentName}_${cleanClassName}_${monthName}_${options.recap.year}.jpg`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Batch generate all student JPGs and download as a single ZIP file
 */
export async function downloadAllStudentReportsZIP(
  recaps: StudentMonthlyRecap[],
  baseOptions: Omit<ReportRenderOptions, 'recap'> & { month?: number; year?: number },
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const monthName = MONTH_NAMES[baseOptions.month ? baseOptions.month - 1 : 9] || 'Oktober';
  const folder = zip.folder(`Laporan_Presensi_${baseOptions.className}_${monthName}`);

  for (let i = 0; i < recaps.length; i++) {
    const recap = recaps[i];
    if (onProgress) onProgress(i + 1, recaps.length);

    const blob = await generateStudentReportBlob({
      ...baseOptions,
      recap,
    });

    const cleanName = recap.student.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${i + 1}_${cleanName}_NIS${recap.student.nis}.jpg`;
    if (folder) {
      folder.file(filename, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `Laporan_Presensi_Kelas_${baseOptions.className}_${monthName}_${baseOptions.year || 2026}.zip`;

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Helpers
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}

function drawSimulatedQR(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const step = size / 8;
  ctx.fillStyle = '#065F46';
  // Three finder patterns
  const drawFinder = (fx: number, fy: number) => {
    ctx.fillRect(fx, fy, step * 2.5, step * 2.5);
    ctx.clearRect(fx + step * 0.5, fy + step * 0.5, step * 1.5, step * 1.5);
    ctx.fillRect(fx + step * 0.8, fy + step * 0.8, step * 0.9, step * 0.9);
  };

  drawFinder(x, y);
  drawFinder(x + size - step * 2.5, y);
  drawFinder(x, y + size - step * 2.5);

  // Random matrix pixels for aesthetic barcode
  const seed = [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (seed[(r * 5 + c) % seed.length] === 1) {
        ctx.fillRect(x + (c + 2.5) * step, y + (r + 2.5) * step, step * 0.8, step * 0.8);
      }
    }
  }
}

function drawEmptyLogoContainer(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  drawRoundedRect(ctx, x, y, size, size, 16);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WADAH', x + size / 2, y + size / 2 - 4);
  ctx.fillText('LOGO', x + size / 2, y + size / 2 + 14);
  ctx.restore();
}

function drawStampEmblem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  madrasahName: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.15);
  ctx.strokeStyle = '#059669AA';
  ctx.lineWidth = 3.5;

  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#059669CC';
  ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const shortName = (madrasahName || 'MADRASAH').toUpperCase().slice(0, 20);
  ctx.fillText(shortName, 0, -20);
  ctx.fillText('DOKUMEN RESMI', 0, 26);

  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('TERVERIFIKASI', 0, 4);

  ctx.restore();
}
