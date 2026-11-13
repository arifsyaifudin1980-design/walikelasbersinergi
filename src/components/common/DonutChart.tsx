import React from 'react';
import { ATTENDANCE_COLORS } from '../../services/canvasReport';

interface DonutChartProps {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  effectiveDays: number;
  percentage: number;
  unrecordedDays?: number;
  size?: number;
  strokeWidth?: number;
  showLegend?: boolean;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  hadir,
  sakit,
  izin,
  alpa,
  effectiveDays,
  percentage,
  unrecordedDays = 0,
  size = 180,
  strokeWidth = 24,
  showLegend = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const recorded = hadir + sakit + izin + alpa;
  const denominator = Math.max(effectiveDays, recorded, 1);

  const slices = [
    { key: 'H', label: 'Hadir', count: hadir, color: ATTENDANCE_COLORS.H },
    { key: 'S', label: 'Sakit', count: sakit, color: ATTENDANCE_COLORS.S },
    { key: 'I', label: 'Izin', count: izin, color: ATTENDANCE_COLORS.I },
    { key: 'A', label: 'Alpa', count: alpa, color: ATTENDANCE_COLORS.A },
  ];

  if (unrecordedDays > 0) {
    slices.push({
      key: 'U',
      label: 'Belum Terisi',
      count: unrecordedDays,
      color: ATTENDANCE_COLORS.track,
    });
  }

  let accumulatedRatio = 0;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
          />

          {slices.map((slice) => {
            if (slice.count <= 0) return null;
            const ratio = slice.count / denominator;
            const strokeDasharray = `${ratio * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedRatio * circumference;
            accumulatedRatio += ratio;

            return (
              <circle
                key={slice.key}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-opacity duration-150 hover:opacity-80 cursor-pointer"
              >
                <title>{`${slice.label}: ${slice.count} hari (${((slice.count / denominator) * 100).toFixed(1)}%)`}</title>
              </circle>
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none tabular-nums">
            {percentage}%
          </span>
          <span className="text-[11px] font-medium text-slate-500 mt-1">
            Kehadiran
          </span>
        </div>
      </div>

      {showLegend && (
        <div className="grid grid-cols-4 gap-2 w-full mt-3 pt-3 border-t border-slate-100 text-center">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: ATTENDANCE_COLORS.H }} />
              <span className="text-[11px] font-medium text-slate-500">H</span>
            </div>
            <span className="text-sm font-bold text-emerald-700 tabular-nums mt-0.5">{hadir}</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: ATTENDANCE_COLORS.S }} />
              <span className="text-[11px] font-medium text-slate-500">S</span>
            </div>
            <span className="text-sm font-bold text-amber-600 tabular-nums mt-0.5">{sakit}</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: ATTENDANCE_COLORS.I }} />
              <span className="text-[11px] font-medium text-slate-500">I</span>
            </div>
            <span className="text-sm font-bold text-blue-600 tabular-nums mt-0.5">{izin}</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: ATTENDANCE_COLORS.A }} />
              <span className="text-[11px] font-medium text-slate-500">A</span>
            </div>
            <span className="text-sm font-bold text-rose-600 tabular-nums mt-0.5">{alpa}</span>
          </div>
        </div>
      )}
    </div>
  );
};
