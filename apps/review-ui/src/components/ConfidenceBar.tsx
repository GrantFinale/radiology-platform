import React from 'react';

interface Props {
  value: number; // 0-1
  label?: string;
  showPercent?: boolean;
}

export default function ConfidenceBar({ value, label, showPercent = true }: Props) {
  const percent = Math.round(value * 100);
  let barColor = 'bg-emerald-500';
  if (percent < 70) barColor = 'bg-red-500';
  else if (percent < 85) barColor = 'bg-amber-500';

  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm text-gray-600 min-w-[100px]">{label}</span>}
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showPercent && (
        <span className={`text-sm font-medium min-w-[40px] text-right ${
          percent >= 85 ? 'text-emerald-700' : percent >= 70 ? 'text-amber-700' : 'text-red-700'
        }`}>
          {percent}%
        </span>
      )}
    </div>
  );
}
