import React from 'react';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  received: { label: 'Received', className: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700' },
  ocr_complete: { label: 'OCR Complete', className: 'bg-indigo-100 text-indigo-700' },
  nlp_complete: { label: 'NLP Complete', className: 'bg-purple-100 text-purple-700' },
  validated: { label: 'Validated', className: 'bg-cyan-100 text-cyan-700' },
  pending_review: { label: 'Pending Review', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  error: { label: 'Error', className: 'bg-red-100 text-red-700' },
};

interface Props {
  status: string;
  size?: 'sm' | 'md';
}

export default function OrderStatusBadge({ status, size = 'sm' }: Props) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.className} ${sizeClass}`}>
      {config.label}
    </span>
  );
}
