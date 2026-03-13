import React from 'react';
import { format } from 'date-fns';
import { CheckCircle, Clock, AlertCircle, User } from 'lucide-react';

interface TimelineEntry {
  status: string;
  changedBy: string;
  timestamp: string;
  notes?: string;
}

interface Props {
  entries: TimelineEntry[];
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  received: <Clock className="w-4 h-4" />,
  processing: <Clock className="w-4 h-4" />,
  approved: <CheckCircle className="w-4 h-4" />,
  rejected: <AlertCircle className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
};

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-gray-400',
  processing: 'bg-blue-500',
  ocr_complete: 'bg-indigo-500',
  nlp_complete: 'bg-purple-500',
  validated: 'bg-cyan-500',
  pending_review: 'bg-amber-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-red-500',
  error: 'bg-red-500',
};

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function StatusTimeline({ entries }: Props) {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {entries.map((entry, idx) => {
          const isLast = idx === entries.length - 1;
          const color = STATUS_COLORS[entry.status] || 'bg-gray-400';

          return (
            <li key={idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-3 top-6 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start gap-3">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full ${color} text-white ring-4 ring-white`}>
                    {STATUS_ICONS[entry.status] || <Clock className="w-3 h-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {formatStatusLabel(entry.status)}
                      </p>
                      <time className="text-xs text-gray-500">
                        {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
                      </time>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                      <User className="w-3 h-3" />
                      {entry.changedBy}
                    </div>
                    {entry.notes && (
                      <p className="mt-1 text-sm text-gray-600 bg-gray-50 rounded px-2 py-1">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
