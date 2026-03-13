import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit3,
  User,
  Calendar,
  FileText,
  Stethoscope,
} from 'lucide-react';
import { format } from 'date-fns';
import { getOrder, getOrderHistory, updateOrderStatus } from '../api/orders';
import { getDocuments, getNlpExtractions, type NlpExtraction } from '../api/documents';
import OrderStatusBadge from '../components/OrderStatusBadge';
import DocumentViewer from '../components/DocumentViewer';
import ConfidenceBar from '../components/ConfidenceBar';
import StatusTimeline from '../components/StatusTimeline';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionNotes, setActionNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'document' | 'extractions' | 'history'>('document');

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: !!id,
    placeholderData: {
      id: id || '1',
      patientName: 'John Smith',
      patientMrn: 'MRN-001234',
      dateOfBirth: '1965-03-15',
      provider: 'Dr. Williams',
      orderDate: '2026-03-13T09:30:00Z',
      examType: 'CT Abdomen w/ Contrast',
      source: 'fax' as const,
      status: 'pending_review' as const,
      priority: 'urgent' as const,
      assignedTo: 'Dr. Sarah Chen',
      confidenceScore: 0.82,
      validationErrors: ['Insurance authorization not confirmed', 'Contrast allergy flag requires review'],
      createdAt: '2026-03-13T09:30:00Z',
      updatedAt: '2026-03-13T10:15:00Z',
    },
  });

  const documentsQuery = useQuery({
    queryKey: ['documents', id],
    queryFn: () => getDocuments(id!),
    enabled: !!id,
    placeholderData: [
      {
        id: 'doc-1',
        orderId: id || '1',
        fileName: 'order_fax_20260313.pdf',
        mimeType: 'application/pdf',
        size: 245000,
        ocrText: 'RADIOLOGY ORDER\n\nPatient: John Smith\nDOB: 03/15/1965\nMRN: 001234\n\nOrdering Physician: Dr. Williams\nSpecialty: Internal Medicine\n\nExam Requested: CT Abdomen and Pelvis with IV Contrast\n\nClinical History: 58-year-old male with abdominal pain, weight loss, and elevated LFTs. Rule out hepatic mass.\n\nPriority: URGENT\n\nAllergies: Penicillin\nContrast Allergy: NONE REPORTED\n\nInsurance: Blue Cross PPO\nAuth #: Pending\n\nPhysician Signature: [Signed]\nDate: 03/13/2026',
        ocrConfidence: 0.91,
        uploadedAt: '2026-03-13T09:30:00Z',
      },
    ],
  });

  const extractionsQuery = useQuery({
    queryKey: ['extractions', id],
    queryFn: () => getNlpExtractions(documentsQuery.data?.[0]?.id || ''),
    enabled: !!documentsQuery.data?.[0]?.id,
    placeholderData: [
      { field: 'Patient Name', value: 'John Smith', confidence: 0.98, source: 'ocr' },
      { field: 'Date of Birth', value: '03/15/1965', confidence: 0.95, source: 'ocr' },
      { field: 'MRN', value: '001234', confidence: 0.97, source: 'ocr' },
      { field: 'Ordering Physician', value: 'Dr. Williams', confidence: 0.94, source: 'ocr' },
      { field: 'Exam Type', value: 'CT Abdomen and Pelvis with IV Contrast', confidence: 0.92, source: 'nlp' },
      { field: 'Clinical History', value: 'Abdominal pain, weight loss, elevated LFTs. R/O hepatic mass.', confidence: 0.88, source: 'nlp' },
      { field: 'Priority', value: 'Urgent', confidence: 0.96, source: 'nlp' },
      { field: 'Contrast Required', value: 'Yes - IV', confidence: 0.90, source: 'nlp' },
      { field: 'Allergies', value: 'Penicillin', confidence: 0.93, source: 'ocr' },
      { field: 'Insurance', value: 'Blue Cross PPO', confidence: 0.87, source: 'ocr' },
      { field: 'Authorization', value: 'Pending', confidence: 0.72, source: 'nlp' },
    ] as NlpExtraction[],
  });

  const historyQuery = useQuery({
    queryKey: ['orderHistory', id],
    queryFn: () => getOrderHistory(id!),
    enabled: !!id,
    placeholderData: [
      { status: 'received', changedBy: 'System', timestamp: '2026-03-13T09:30:00Z', notes: 'Fax received and queued for processing' },
      { status: 'processing', changedBy: 'System', timestamp: '2026-03-13T09:31:00Z' },
      { status: 'ocr_complete', changedBy: 'OCR Engine', timestamp: '2026-03-13T09:33:00Z', notes: 'Text extraction complete, confidence: 91%' },
      { status: 'nlp_complete', changedBy: 'NLP Engine', timestamp: '2026-03-13T09:35:00Z', notes: '11 fields extracted' },
      { status: 'pending_review', changedBy: 'Validation Engine', timestamp: '2026-03-13T09:36:00Z', notes: 'Flagged: insurance auth pending, contrast allergy check needed' },
    ],
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) =>
      updateOrderStatus(id!, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orderHistory', id] });
      setActionNotes('');
    },
  });

  const order = orderQuery.data;
  const documents = documentsQuery.data || [];
  const extractions = extractionsQuery.data || [];
  const history = historyQuery.data || [];

  if (!order) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{order.patientName}</h1>
            <OrderStatusBadge status={order.status} size="md" />
            <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
              order.priority === 'stat' ? 'bg-red-100 text-red-700' :
              order.priority === 'urgent' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {order.priority}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {order.patientMrn} | {order.examType}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Order Info + Actions */}
        <div className="space-y-6">
          {/* Patient Info */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Order Information</h3>
            <dl className="space-y-3">
              {[
                { icon: User, label: 'Patient', value: order.patientName },
                { icon: FileText, label: 'MRN', value: order.patientMrn },
                { icon: Calendar, label: 'DOB', value: format(new Date(order.dateOfBirth), 'MMM d, yyyy') },
                { icon: Stethoscope, label: 'Provider', value: order.provider },
                { icon: FileText, label: 'Exam', value: order.examType },
                { icon: Calendar, label: 'Order Date', value: format(new Date(order.orderDate), 'MMM d, yyyy h:mm a') },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2">
                  <item.icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-500">{item.label}</dt>
                    <dd className="text-sm font-medium text-gray-900">{item.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {order.confidenceScore !== undefined && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Overall Confidence</p>
                <ConfidenceBar value={order.confidenceScore} />
              </div>
            )}
          </div>

          {/* Validation Errors */}
          {order.validationErrors && order.validationErrors.length > 0 && (
            <div className="card border-amber-200 bg-amber-50/50">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                Validation Flags
              </h3>
              <ul className="space-y-2">
                {order.validationErrors.map((err, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {(order.status === 'pending_review' || order.status === 'validated') && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Review Actions</h3>
              <textarea
                className="input mb-3"
                rows={3}
                placeholder="Add review notes (optional)..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-success flex items-center gap-1.5"
                  onClick={() => statusMutation.mutate({ status: 'approved', notes: actionNotes })}
                  disabled={statusMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  className="btn-danger flex items-center gap-1.5"
                  onClick={() => statusMutation.mutate({ status: 'rejected', notes: actionNotes })}
                  disabled={statusMutation.isPending}
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5"
                  onClick={() => statusMutation.mutate({ status: 'pending_review', notes: `Escalated: ${actionNotes}` })}
                  disabled={statusMutation.isPending}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Escalate
                </button>
                <button
                  className="btn-secondary flex items-center gap-1.5"
                  onClick={() => {/* open edit modal */}}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center + Right: Document + Extractions */}
        <div className="xl:col-span-2">
          {/* Tab navigation */}
          <div className="flex border-b border-gray-200 mb-4">
            {[
              { key: 'document' as const, label: 'Document & OCR' },
              { key: 'extractions' as const, label: 'NLP Extractions' },
              { key: 'history' as const, label: 'Status History' },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-clinical-600 text-clinical-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'document' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Document Viewer */}
              <div className="min-h-[500px]">
                {documents.length > 0 ? (
                  <DocumentViewer
                    documentId={documents[0].id}
                    fileName={documents[0].fileName}
                    mimeType={documents[0].mimeType}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                    No documents available
                  </div>
                )}
              </div>

              {/* OCR Text */}
              <div className="card max-h-[500px] overflow-auto scrollbar-thin">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Extracted Text (OCR)</h3>
                  {documents[0]?.ocrConfidence && (
                    <span className="text-xs text-gray-500">
                      Confidence: {Math.round(documents[0].ocrConfidence * 100)}%
                    </span>
                  )}
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 rounded-lg p-4">
                  {documents[0]?.ocrText || 'No OCR text available'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'extractions' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                NLP Extracted Fields
              </h3>
              <div className="space-y-4">
                {extractions.map((ext, i) => (
                  <div key={i} className="flex items-start gap-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900">{ext.field}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          ext.source === 'ocr' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {ext.source.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{ext.value}</p>
                    </div>
                    <div className="w-40 flex-shrink-0">
                      <ConfidenceBar value={ext.confidence} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6">
                Status History
              </h3>
              <StatusTimeline entries={history} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
