import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getOrderStats, getOrders } from '../api/orders';
import OrderStatusBadge from '../components/OrderStatusBadge';
import { format } from 'date-fns';

const SOURCE_COLORS: Record<string, string> = {
  fax: '#6366f1',
  hl7: '#06b6d4',
  portal: '#8b5cf6',
  ehr: '#f59e0b',
};

const STATUS_PIPELINE = [
  { key: 'received', label: 'Received', color: '#9ca3af' },
  { key: 'processing', label: 'Processing', color: '#3b82f6' },
  { key: 'ocr_complete', label: 'OCR', color: '#6366f1' },
  { key: 'nlp_complete', label: 'NLP', color: '#8b5cf6' },
  { key: 'validated', label: 'Validated', color: '#06b6d4' },
  { key: 'pending_review', label: 'Review', color: '#f59e0b' },
  { key: 'approved', label: 'Approved', color: '#10b981' },
];

export default function Dashboard() {
  const statsQuery = useQuery({
    queryKey: ['orderStats'],
    queryFn: getOrderStats,
    // Provide fallback data for demo
    placeholderData: {
      total: 1247,
      pendingReview: 23,
      validated: 1189,
      errors: 12,
      bySource: [
        { source: 'fax', count: 487 },
        { source: 'hl7', count: 412 },
        { source: 'portal', count: 234 },
        { source: 'ehr', count: 114 },
      ],
      byStatus: [
        { status: 'received', count: 15 },
        { status: 'processing', count: 8 },
        { status: 'ocr_complete', count: 5 },
        { status: 'nlp_complete', count: 3 },
        { status: 'validated', count: 1189 },
        { status: 'pending_review', count: 23 },
        { status: 'approved', count: 992 },
      ],
    },
  });

  const recentOrdersQuery = useQuery({
    queryKey: ['recentOrders'],
    queryFn: () => getOrders({ limit: 8, sortBy: 'createdAt', sortOrder: 'desc' }),
    placeholderData: {
      data: [
        { id: '1', patientName: 'John Smith', patientMrn: 'MRN-001234', dateOfBirth: '1965-03-15', provider: 'Dr. Williams', orderDate: '2026-03-13T09:30:00Z', examType: 'CT Abdomen w/ Contrast', source: 'fax' as const, status: 'pending_review' as const, priority: 'urgent' as const, confidenceScore: 0.82, createdAt: '2026-03-13T09:30:00Z', updatedAt: '2026-03-13T10:15:00Z' },
        { id: '2', patientName: 'Maria Garcia', patientMrn: 'MRN-005678', dateOfBirth: '1978-11-22', provider: 'Dr. Patel', orderDate: '2026-03-13T08:45:00Z', examType: 'MRI Brain w/o Contrast', source: 'hl7' as const, status: 'approved' as const, priority: 'routine' as const, confidenceScore: 0.97, createdAt: '2026-03-13T08:45:00Z', updatedAt: '2026-03-13T09:20:00Z' },
        { id: '3', patientName: 'Robert Chen', patientMrn: 'MRN-009012', dateOfBirth: '1952-07-08', provider: 'Dr. Johnson', orderDate: '2026-03-13T08:00:00Z', examType: 'X-Ray Chest PA/Lat', source: 'portal' as const, status: 'validated' as const, priority: 'stat' as const, confidenceScore: 0.94, createdAt: '2026-03-13T08:00:00Z', updatedAt: '2026-03-13T08:30:00Z' },
        { id: '4', patientName: 'Susan Miller', patientMrn: 'MRN-003456', dateOfBirth: '1988-01-30', provider: 'Dr. Brown', orderDate: '2026-03-12T16:20:00Z', examType: 'Ultrasound Pelvis', source: 'ehr' as const, status: 'error' as const, priority: 'routine' as const, confidenceScore: 0.45, createdAt: '2026-03-12T16:20:00Z', updatedAt: '2026-03-12T17:00:00Z' },
        { id: '5', patientName: 'James Wilson', patientMrn: 'MRN-007890', dateOfBirth: '1970-09-12', provider: 'Dr. Davis', orderDate: '2026-03-12T14:10:00Z', examType: 'CT Head w/o Contrast', source: 'fax' as const, status: 'pending_review' as const, priority: 'stat' as const, confidenceScore: 0.71, createdAt: '2026-03-12T14:10:00Z', updatedAt: '2026-03-12T15:00:00Z' },
      ],
      total: 5,
      page: 1,
      limit: 8,
      totalPages: 1,
    },
  });

  const stats = statsQuery.data;
  const recentOrders = recentOrdersQuery.data?.data || [];

  const statCards = [
    { label: 'Total Orders', value: stats?.total ?? 0, icon: ClipboardList, color: 'text-clinical-600', bg: 'bg-clinical-50' },
    { label: 'Pending Review', value: stats?.pendingReview ?? 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Validated', value: stats?.validated ?? 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Errors', value: stats?.errors ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Radiology order processing overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="card flex items-center gap-4">
            <div className={`p-3 rounded-xl ${card.bg}`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Source Distribution */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Order Sources</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.bySource || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="source"
                  label={({ source, percent }) => `${source.toUpperCase()} ${(percent * 100).toFixed(0)}%`}
                >
                  {(stats?.bySource || []).map((entry) => (
                    <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pipeline */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Processing Pipeline</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.byStatus || []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={100}
                  tickFormatter={(s) =>
                    STATUS_PIPELINE.find((p) => p.key === s)?.label || s
                  }
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString()}
                  labelFormatter={(s) =>
                    STATUS_PIPELINE.find((p) => p.key === s)?.label || s
                  }
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(stats?.byStatus || []).map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_PIPELINE.find((p) => p.key === entry.status)?.color || '#94a3b8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Recent Orders</h3>
          <Link
            to="/orders"
            className="text-sm text-clinical-600 hover:text-clinical-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Exam</th>
                <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-2">
                    <Link to={`/orders/${order.id}`} className="hover:text-clinical-600">
                      <p className="font-medium text-gray-900">{order.patientName}</p>
                      <p className="text-xs text-gray-500">{order.patientMrn}</p>
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-gray-600">{order.examType}</td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                      {order.source}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="py-3 px-2 text-gray-500 text-xs">
                    {format(new Date(order.createdAt), 'MMM d, h:mm a')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
