import apiClient from './client';
import type { Order } from './orders';

export interface ReviewItem {
  id: string;
  orderId: string;
  order: Order;
  priority: 'stat' | 'urgent' | 'routine';
  reason: string;
  assignedTo?: string;
  claimedAt?: string;
  createdAt: string;
}

export interface ReviewDecision {
  action: 'approve' | 'reject' | 'escalate';
  notes: string;
  corrections?: Record<string, unknown>;
}

export async function getReviewQueue(params?: {
  priority?: string;
  assignedTo?: string;
}): Promise<ReviewItem[]> {
  const { data } = await apiClient.get('/api/reviews/queue', { params });
  return data;
}

export async function claimReview(reviewId: string): Promise<ReviewItem> {
  const { data } = await apiClient.post(`/api/reviews/${reviewId}/claim`);
  return data;
}

export async function unclaimReview(reviewId: string): Promise<ReviewItem> {
  const { data } = await apiClient.post(`/api/reviews/${reviewId}/unclaim`);
  return data;
}

export async function submitReview(reviewId: string, decision: ReviewDecision): Promise<void> {
  await apiClient.post(`/api/reviews/${reviewId}/submit`, decision);
}

export async function getReviewStats(): Promise<{
  totalPending: number;
  myClaimed: number;
  completedToday: number;
  averageReviewTime: number;
}> {
  const { data } = await apiClient.get('/api/reviews/stats');
  return data;
}
