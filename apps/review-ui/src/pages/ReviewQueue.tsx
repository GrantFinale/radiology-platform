import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Hand,
  HandMetal,
  Eye,
  Clock,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { getReviewQueue, claimReview, unclaimReview, submitReview, type ReviewItem } from '../api/reviews';
import OrderStatusBadge from '../components/OrderStatusBadge';
import ConfidenceBar from '../components/ConfidenceBar';
import { useAuth } from '../hooks/useAuth';

const PRIORITY_ORDER = { stat: 0, urgent: 1, routine: 2 };

const DEMO_REVIEWS: ReviewItem[] = [
  {
    id: 'rev-1',
    orderId: '1',
    order: {
      id: '1', patientName: 'John Smith', patientMrn: 'MRN-001234', dateOfBirth: '1965-03-15',
      provider: 'Dr. Williams', orderDate: '2026-03-13T09:30:00Z', examType: 'CT Abdomen w/ Contrast',
      source: 'fax', status: 'pending_review', priority: 'urgent', confidenceScore: 0.82,
      validationErrors: ['Insurance auth pending'], createdAt: '2026-03-13T09:30:00Z', updatedAt: '2026-03-13T10:15:00Z',
    },
    priority: 'urgent',
    reason: 'Low confidence extraction + insurance authorization pending',
    createdAt: '2026-03-13T09:36:00Z',
  },
  {
    id: 'rev-2',
    orderId: '5',
    order: {
      id: '5', patientName: 'James Wilson', patientMrn: 'MRN-007890', dateOfBirth: '1970-09-12',
      provider: 'Dr. Davis', orderDate: '2026-03-12T14:10:00Z', examType: 'CT Head w/o Contrast',
      source: 'fax', status: 'pending_review', priority: 'stat', confidenceScore: 0.71,
      validationErrors: ['Clinical indication missing', 'Patient DOB mismatch'],
      createdAt: '2026-03-12T14:10:00Z', updatedAt: '2026-03-12T15:00:00Z',
    },
    priority: 'stat',
    reason: 'Multiple validation failures, low OCR confidence',
    createdAt: '2026-03-12T15:00:00Z',
  },
  {
    id: 'rev-3',
    orderId: '8',
    order: {
      id: '8', patientName: 'Emma Thompson', patientMrn: 'MRN-004567', dateOfBirth: '1990-05-20',
      provider: 'Dr. Martinez', orderDate: '2026-03-13T07:00:00Z', examType: 'MRI Lumbar Spine w/ Contrast',
      source: 'portal', status: 'pending_review', priority: 'routine', confidenceScore: 0.88,
      createdAt: '2026-03-13T07:00:00Z', updatedAt: '2026-03-13T07:45:00Z',
    },
    priority: 'routine',
    reason: 'Contrast allergy history requires verification',
    createdAt: '2026-03-13T07:45:00Z',
  },
  {
    id: 'rev-4',
    orderId: '12',
    order: {
      id: '12', patientName: 'David Lee', patientMrn: 'MRN-008901', dateOfBirth: '1948-12-01',
      provider: 'Dr. Nguyen', orderDate: '2026-03-12T11:30:00Z', examType: 'PET/CT Whole Body',
      source: 'ehr', status: 'pending_review', priority: 'urgent', confidenceScore: 0.76,
      validationErrors: ['Prior auth required for PET/CT'],
      createdAt: '2026-03-12T11:30:00Z', updatedAt: '2026-03-12T12:15:00Z',
    },
    priority: 'urgent',
    reason: 'High-cost exam requires prior authorization verification',
    createdAt: '2026-03-12T12:15:00Z',
  },
];

export default function ReviewQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const reviewsQuery = useQuery({
    queryKey: ['reviewQueue', priorityFilter],
    queryFn: () => getReviewQueue(priorityFilter ? { priority: priorityFilter } : undefined),
    placeholderData: DEMO_REVIEWS,
  });

  const claimMutation = useMutation({
    mutationFn: claimReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviewQueue'] }),
  });

  const unclaimMutation = useMutation({
    mutationFn: unclaimReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviewQueue'] }),
  });

  const quickActionMutation = useMutation({
    mutationFn: ({ reviewId, action }: { reviewId: string; action: 'approve' | 'reject' }) =>
      submitReview(reviewId, { action, notes: 'Quick action from review queue' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviewQueue'] }),
  });

  const reviews = (reviewsQuery.data || []).sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {reviews.length} order{reviews.length !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            className="input w-auto"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="stat">STAT</option>
            <option value="urgent">Urgent</option>
            <option value="routine">Routine</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-500">No orders pending review</p>
          </div>
        ) : (
          reviews.map((review) => {
            const isClaimed = !!review.assignedTo;
            const isClaimedByMe = review.assignedTo === user?.username;

            return (
              <div
                key={review.id}
                className={`card border-l-4 ${
                  review.priority === 'stat'
                    ? 'border-l-red-500'
                    : review.priority === 'urgent'
                    ? 'border-l-amber-500'
                    : 'border-l-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <Link
                        to={`/orders/${review.orderId}`}
                        className="text-base font-semibold text-gray-900 hover:text-clinical-600"
                      >
                        {review.order.patientName}
                      </Link>
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                        review.priority === 'stat'
                          ? 'bg-red-100 text-red-700'
                          : review.priority === 'urgent'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {review.priority}
                      </span>
                      <OrderStatusBadge status={review.order.status} />
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {review.order.examType} | {review.order.patientMrn} | {review.order.provider}
                    </p>
                    <p className="text-sm text-amber-700 bg-amber-50 inline-block rounded px-2 py-0.5">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      {review.reason}
                    </p>

                    {review.order.confidenceScore !== undefined && (
                      <div className="mt-3 max-w-xs">
                        <ConfidenceBar value={review.order.confidenceScore} label="Confidence" />
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(review.createdAt), 'MMM d, h:mm a')}
                      </span>
                      {isClaimed && (
                        <span className="flex items-center gap-1 text-clinical-600">
                          <Hand className="w-3 h-3" />
                          Claimed by {isClaimedByMe ? 'you' : review.assignedTo}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link
                      to={`/orders/${review.orderId}`}
                      className="btn-primary flex items-center gap-1.5 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Review
                    </Link>

                    {!isClaimed ? (
                      <button
                        className="btn-secondary flex items-center gap-1.5 text-xs"
                        onClick={() => claimMutation.mutate(review.id)}
                        disabled={claimMutation.isPending}
                      >
                        <Hand className="w-3.5 h-3.5" />
                        Claim
                      </button>
                    ) : isClaimedByMe ? (
                      <button
                        className="btn-secondary flex items-center gap-1.5 text-xs"
                        onClick={() => unclaimMutation.mutate(review.id)}
                        disabled={unclaimMutation.isPending}
                      >
                        <HandMetal className="w-3.5 h-3.5" />
                        Unclaim
                      </button>
                    ) : null}

                    <div className="flex gap-1">
                      <button
                        className="flex-1 btn-success py-1 px-2 text-xs"
                        onClick={() => quickActionMutation.mutate({ reviewId: review.id, action: 'approve' })}
                        disabled={quickActionMutation.isPending}
                        title="Quick approve"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="flex-1 btn-danger py-1 px-2 text-xs"
                        onClick={() => quickActionMutation.mutate({ reviewId: review.id, action: 'reject' })}
                        disabled={quickActionMutation.isPending}
                        title="Quick reject"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
