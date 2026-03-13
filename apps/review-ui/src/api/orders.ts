import apiClient from './client';

export interface Order {
  id: string;
  patientName: string;
  patientMrn: string;
  dateOfBirth: string;
  provider: string;
  orderDate: string;
  examType: string;
  source: 'fax' | 'hl7' | 'portal' | 'ehr';
  status: 'received' | 'processing' | 'ocr_complete' | 'nlp_complete' | 'validated' | 'pending_review' | 'approved' | 'rejected' | 'error';
  priority: 'stat' | 'urgent' | 'routine';
  assignedTo?: string;
  confidenceScore?: number;
  validationErrors?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  total: number;
  pendingReview: number;
  validated: number;
  errors: number;
  bySource: { source: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export interface OrderListParams {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getOrders(params: OrderListParams = {}): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get('/api/orders', { params });
  return data;
}

export async function getOrder(id: string): Promise<Order> {
  const { data } = await apiClient.get(`/api/orders/${id}`);
  return data;
}

export async function getOrderStats(): Promise<OrderStats> {
  const { data } = await apiClient.get('/api/orders/stats');
  return data;
}

export async function updateOrderStatus(id: string, status: string, notes?: string): Promise<Order> {
  const { data } = await apiClient.patch(`/api/orders/${id}/status`, { status, notes });
  return data;
}

export async function getOrderHistory(id: string): Promise<{ status: string; changedBy: string; timestamp: string; notes?: string }[]> {
  const { data } = await apiClient.get(`/api/orders/${id}/history`);
  return data;
}
