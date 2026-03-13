import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, FileText, Radio, Globe, Monitor } from 'lucide-react';
import { getOrders, type OrderListParams } from '../api/orders';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { format } from 'date-fns';

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  fax: <FileText className="w-4 h-4" />,
  hl7: <Radio className="w-4 h-4" />,
  portal: <Globe className="w-4 h-4" />,
  ehr: <Monitor className="w-4 h-4" />,
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'received', label: 'Received' },
  { value: 'processing', label: 'Processing' },
  { value: 'ocr_complete', label: 'OCR Complete' },
  { value: 'nlp_complete', label: 'NLP Complete' },
  { value: 'validated', label: 'Validated' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'error', label: 'Error' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'fax', label: 'Fax' },
  { value: 'hl7', label: 'HL7' },
  { value: 'portal', label: 'Portal' },
  { value: 'ehr', label: 'EHR' },
];

const PRIORITY_COLORS: Record<string, string> = {
  stat: 'text-red-600',
  urgent: 'text-amber-600',
  routine: 'text-gray-500',
};

export default function OrderList() {
  const [params, setParams] = useState<OrderListParams>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', params],
    queryFn: () => getOrders(params),
    placeholderData: (prev) => prev,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams((p) => ({ ...p, search, page: 1 }));
  };

  const handleSort = (field: string) => {
    setParams((p) => ({
      ...p,
      sortBy: field,
      sortOrder: p.sortBy === field && p.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const orders = data?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and track radiology orders</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Search by patient name, MRN, or provider..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>
          <select
            className="input w-auto"
            value={params.status || ''}
            onChange={(e) => setParams((p) => ({ ...p, status: e.target.value || undefined, page: 1 }))}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={params.source || ''}
            onChange={(e) => setParams((p) => ({ ...p, source: e.target.value || undefined, page: 1 }))}
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[
                  { key: 'patientName', label: 'Patient' },
                  { key: 'examType', label: 'Exam Type' },
                  { key: 'provider', label: 'Provider' },
                  { key: 'source', label: 'Source' },
                  { key: 'priority', label: 'Priority' },
                  { key: 'status', label: 'Status' },
                  { key: 'createdAt', label: 'Date' },
                ].map((col) => (
                  <th
                    key={col.key}
                    className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No orders found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <Link to={`/orders/${order.id}`} className="hover:text-clinical-600">
                        <p className="font-medium text-gray-900">{order.patientName}</p>
                        <p className="text-xs text-gray-500">{order.patientMrn}</p>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{order.examType}</td>
                    <td className="py-3 px-4 text-gray-600">{order.provider}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-gray-600">
                        {SOURCE_ICONS[order.source]}
                        <span className="uppercase text-xs font-medium">{order.source}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold uppercase ${PRIORITY_COLORS[order.priority] || 'text-gray-500'}`}>
                        {order.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500">
            Showing page {params.page} of {totalPages}
            {data?.total !== undefined && ` (${data.total.toLocaleString()} total)`}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary py-1.5 px-3"
              disabled={params.page === 1}
              onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) - 1 }))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="btn-secondary py-1.5 px-3"
              disabled={params.page === totalPages}
              onClick={() => setParams((p) => ({ ...p, page: (p.page || 1) + 1 }))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
