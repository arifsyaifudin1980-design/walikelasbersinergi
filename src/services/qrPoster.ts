import QRCode from 'qrcode';
import { MadrasahProfile, SchoolClass } from '../types';

export interface ParsedClassQrPayload {
  classId: string;
  qrToken: string;
}

/**
 * Format classroom QR string embedded in physical classroom posters.
 */
export function buildClassQrPayload(classId: string, qrToken: string): string {
  return `PPM-KELAS:${classId}:${qrToken}`;
}

/**
 * Parse scanned QR string (supports PPM-KELAS:<id>:<token> or JSON).
 */
export function parseClassQrPayload(raw: string): ParsedClassQrPayload | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('PPM-KELAS:')) {
    const parts = trimmed.split(':');
    if (parts.length >= 3) {
      const classId = parts[1].trim();
      const qrToken = parts.slice(2).join(':').trim();
      if (classId && qrToken) {
        return { classId, qrToken };
      }
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<ParsedClassQrPayload>;
    if (parsed.classId && parsed.qrToken) {
      return {
        classId: String(parsed.classId).trim(),
        qrToken: String(parsed.qrToken).trim(),
      };
    }
  } catch {
    // not JSON
  }

  return null;
}

export async function generateClassQrDataUrl(
  classId: string,
  qrToken: string,
  width = 480
): Promise<string> {
  const payload = buildClassQrPayload(classId, qrToken);
  return QRCode.toDataURL(payload, {
    width,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#0B192C',
      light: '#FFFFFF',
    },
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Generate printable portrait Classroom QR Poster JPG (1080 x 1440 px) to post inside classroom.
 */
export async function generateClassQrPosterDataUrl(
  schoolClass: SchoolClass,
  madrasah: MadrasahProfile
): Promise<string> {
  const qrToken = schoolClass.qrToken || '';
  const width = 1080;
  const height = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');

  // Background
  ctx.fillStyle = '#F6F8FB';
  ctx.fillRect(0, 0, width, height);

  // Outer card frame
  drawRoundedRect(ctx, 48, 48, width - 96, height - 96, 36);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // Top Deep Navy Header Band
  ctx.save();
  drawRoundedRect(ctx, 48, 48, width - 96, 260, 36);
  ctx.clip();
  ctx.fillStyle = '#0B192C';
  ctx.fillRect(48, 48, width - 96, 260);
  // Emerald accent stripe at bottom of header
  ctx.fillStyle = '#059669';
  ctx.fillRect(48, 294, width - 96, 14);
  ctx.restore();

  // Logo container in header if available
  const hasLogo = Boolean(madrasah.logoUrl);
  let textStartX = 104;
  if (hasLogo) {
    try {
      const logoImg = await loadImage(madrasah.logoUrl);
      drawRoundedRect(ctx, 100, 102, 136, 136, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.drawImage(logoImg, 114, 116, 108, 108);
      textStartX = 268;
    } catch {
      textStartX = 104;
    }
  }

  // Header Institution Info
  ctx.fillStyle = '#34D399';
  ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BARCODE PRESENSI GURU MENGAJAR', textStartX, 142);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 40px "Plus Jakarta Sans", sans-serif';
  const schoolTitle = madrasah.name.trim() || 'Presensi Pintar Madrasah';
  ctx.fillText(schoolTitle.slice(0, 34), textStartX, 198);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
  const subText = madrasah.nsm ? `NSM ${madrasah.nsm}` : 'Sistem Monitoring Kehadiran Mengajar';
  ctx.fillText(subText, textStartX, 240);

  // Class Banner
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('RUANG KELAS', width / 2, 386);

  ctx.fillStyle = '#0B192C';
  ctx.font = '800 84px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`KELAS ${schoolClass.name}`, width / 2, 476);

  ctx.fillStyle = '#059669';
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  const waliText = schoolClass.homeroomTeacherName
    ? `Wali Kelas: ${schoolClass.homeroomTeacherName}`
    : `Tingkat ${schoolClass.grade}`;
  ctx.fillText(waliText, width / 2, 526);

  // QR Code Frame
  const qrBoxSize = 540;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = 574;

  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0B192C';
  ctx.stroke();

  const qrDataUrl = await generateClassQrDataUrl(schoolClass.id, qrToken, 480);
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, qrBoxX + 30, qrBoxY + 30, qrBoxSize - 60, qrBoxSize - 60);

  // Token Reference
  ctx.fillStyle = '#475569';
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillText(`KODE: ${schoolClass.id} · ${qrToken}`, width / 2, qrBoxY + qrBoxSize + 46);

  // Two-Step Instructions Card at bottom
  drawRoundedRect(ctx, 108, 1200, width - 216, 146, 22);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  ctx.fillStyle = '#0B192C';
  ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('PETUNJUK PEMINDAIAN GURU MENGAJAR', width / 2, 1244);

  ctx.fillStyle = '#334155';
  ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('1. Buka menu Kamera Scan lalu pindai saat MULAI NGAJAR', width / 2, 1286);
  ctx.fillText('2. Pindai kembali saat SELESAI NGAJAR untuk rekap Wali Kelas', width / 2, 1322);

  return canvas.toDataURL('image/jpeg', 0.94);
}

export async function downloadClassQrPosterJPG(
  schoolClass: SchoolClass,
  madrasah: MadrasahProfile
): Promise<void> {
  const dataUrl = await generateClassQrPosterDataUrl(schoolClass, madrasah);
  const a = document.createElement('a');
  const cleanName = schoolClass.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = dataUrl;
  a.download = `QR_Kelas_${cleanName}.jpg`;
  a.click();
}
